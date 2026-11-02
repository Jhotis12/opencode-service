# Design

## Context

See `proposal.md` for motivation and the live failure. The current control-plane path is:

```text
POST /api/control/chat
  -> ChatWithOrchestratorUseCase.execute
  -> ensureChatSession (reuses chat_threads.opencode_session_id)
  -> promptWithSessionRecovery
  -> OpenCodeV2Adapter.prompt
       session.prompt -> experimental.session.wait -> session.context
       -> extractAssistantText (last assistant message, text parts only)
  -> append agent message (even when reply is "")
```

Relevant current constraints:

- `ChatWithOrchestratorUseCase` creates sessions with `directory`, `title`, and `agent`, but no `model` (`apps/server/src/application/use-cases/orchestrator.ts`).
- `ensureChatSession` reuses a stored session and only switches the agent; it recovers only `Session not found` (`apps/server/src/application/use-cases/chat-session.ts`).
- The control-chat SSE route forwards `done` and `error` only; project chat forwards `delta` and `activity` through `createChatProgressHandler` (`apps/server/src/app.ts`, `apps/server/src/application/use-cases/chat-progress.ts`).
- The platform default model is stored in `settings.default_model` and is passed to project chat; the control workspace does not consume it.
- The plugin registers every platform tool for both scopes (`packages/opencode-plugin/src/index.ts`); global mutations are rejected by the server middleware but remain visible to the model.
- The web control chat calls `api.controlChat(message)` without an event callback, so there is no progress UI (`apps/web/src/api.ts`, `apps/web/src/pages/OrchestratorPage.tsx`).
- Existing tests cover stale-session recovery, project chat progress, orchestrator separation, plugin permissions, and HTTP chat. They do not cover empty assistant replies or a poisoned global session.

## Goals / Non-Goals

**Goals:**

- Make every orchestrator turn use an explicitly configured model and fail visibly when no model is configured.
- Never persist or render an empty orchestrator answer as a success.
- Recover an empty/stuck global session once, on the same thread, without duplicating the user message.
- Stream progress for the control chat with meaningful tool activity.
- Restrict the global tool inventory to read-only tools.
- Prove the behavior with unit, HTTP/SSE, plugin, and web tests that do not require a live OpenCode service.

**Non-Goals:**

- Changing the project primary-agent activity/validation behavior. That remains a separate change.
- Changing the meaning of `experimental.session.wait`, replacing the OpenCode transport, or increasing the platform chat timeout.
- Allowing any mutation from the global scope.
- Migrating, deleting, or rewriting existing chat rows. Empty rows are hidden on read.
- Adding a model picker to Settings. `ORCHESTRATOR_MODEL` and the existing platform default are enough.

## Decisions

### 1. Resolve the orchestrator model explicitly, with env first and platform default second

Add a model resolver dependency to `ChatWithOrchestratorUseCase`:

```text
model: () => env.ORCHESTRATOR_MODEL?.trim() || store.settings.get("default_model") || undefined
```

The use case resolves the model at the start of each turn. If it is empty, it throws a typed `OrchestratorConfigurationError` before creating or prompting a session. The error message names `ORCHESTRATOR_MODEL` and the platform default setting. The session factory passes the resolved model to `createSession`, and `ensureChatSession` calls `switchModel` when reusing an existing session so a model change applies without waiting for session expiry.

Alternatives considered:

- **Set the model only in `control/.opencode/agents/orchestrator/agente.md`.** `BootstrapSystemUseCase` uses `writeIfMissing`, so existing installations keep the old file. It also couples runtime configuration to a filesystem artifact that the administrator cannot change from Settings. Rejected.
- **Let OpenCode use its default.** This is the current failure: the control agent silently runs on `opencode-go/iceman-contributor-free` while the platform default is `opencode-go/deepseek-v4.1-flash`. Rejected.
- **Resolve a static string at app startup.** Simpler, but a Settings update would not apply until restart. The existing project chat uses a resolver function; follow that pattern.

The model must be a tool-capable model. The platform cannot introspect that capability reliably, so the design documents the recommended default and surfaces an actionable error when the model is missing or a turn fails. The test suite proves propagation, not provider capability.

### 2. Treat an empty final assistant message as a failed turn in the orchestrator use case

`ChatWithOrchestratorUseCase` checks `result.reply.trim()` after `promptWithSessionRecovery`. If it is empty:

1. Log `chat_empty_reply` with the thread id and session id (no prompt body).
2. Create a new session through the same factory, persist it on the thread, and retry the prompt once.
3. If the retry is also empty, throw `EmptyAgentReplyError("the orchestrator returned an empty response")`.
4. The existing `execute` catch stores a `system` message with `Error: <message>` and rethrows. No `agent` message is appended.

The first attempt and the retry call `promptWithSessionRecovery` separately. The helper already handles `Session not found` by creating a new session and retrying once; the empty retry is layered on top. This keeps the empty policy orchestrator-specific: project and channel chat keep their current behavior until a separate change.

Alternatives considered:

- **Change `extractAssistantText` to return the last non-empty assistant text.** This would turn the previous preamble ("Voy a buscar...") into a successful answer and hide a failed turn. Rejected.
- **Auto-retry empty replies for every chat caller.** Project chat prompts can mutate workflows; retrying could repeat side effects. Rejected. Only the read-only orchestrator opts in.
- **Return 200 with an empty string and let the UI show an empty bubble.** The current behavior; it hides failure and poisons the thread. Rejected.

### 3. Recover a stuck session once, on the same thread, and persist the replacement

The orchestrator uses a small recovery wrapper around `promptWithSessionRecovery`:

```text
sessionId = ensureChatSession(...)
first = promptWithSessionRecovery(..., sessionId, ...)
if first.reply.trim() == "":
  replacement = factory.create()          # includes resolved model and agent
  store.chatThreads.setSession(thread.id, replacement.id)
  second = promptWithSessionRecovery(..., replacement.id, ...)
  if second.reply.trim() == "": throw EmptyAgentReplyError
  return second
return first
```

The user message is appended once, before the first attempt, and never again. The replacement session id is persisted before the retry so a later turn does not fall back to the poisoned session. If the retry fails, the thread keeps the replacement session and the error is recoverable on the next user turn (another empty first attempt will trigger another replacement).

The first attempt may return empty instantly because the stuck session does not process prompts. The retry on a fresh session is the recovery path. A transport error (not empty) is not auto-retried here; it follows the existing error path and is visible to the user.

`ChatSessionFactory` gains an optional `model` field. `ensureChatSession` applies `switchAgent` and then `switchModel` when reusing a session, inside the existing `Session not found` catch. This makes the model resolver effective for an existing healthy session as well as a new one.

### 4. Filter blank agent messages from the control history

`ChatWithOrchestratorUseCase.history()` filters out `role === "agent"` rows whose `content.trim()` is empty. The web client receives only non-empty messages, so existing blank rows from the poisoned thread disappear from the rendered history without a migration. The live SSE path never appends a blank row after this change.

This filter is deliberately limited to the global orchestrator history. Project chat history is unchanged until the project-agent change; filtering it here would hide a different class of failures without the corresponding recovery policy.

### 5. Stream control-chat progress with the existing handler

Add an optional `onProgress` parameter to `ChatWithOrchestratorUseCase.execute`. When present, build `createChatProgressHandler(onProgress)` and pass it as the `onEvent` callback to `promptWithSessionRecovery`, matching the project chat path.

The control-chat SSE route mirrors the project route:

- `delta` for text events;
- `activity` for tool events;
- `heartbeat` every 15 seconds;
- `done` on success;
- `error` on `EmptyAgentReplyError`, configuration errors, or other failures.

The `writes` promise chain serializes stream writes and is awaited before `done`/`error`. The non-stream route keeps its HTTP `502` behavior and now uses the same error messages.

`createChatProgressHandler` normalizes a leading `platform_` before matching tool names. It also uses the tool input where available:

- `edit`/`write` with `filePath` -> the existing file-based labels (`workflow.json`, `nodes/*`, `.opencode/agents/*`, `AGENTS.md`);
- `bash`/`shell` with `command` -> test/typecheck/lint/execute categories;
- `platform_workflow_upsert` -> "Actualizando el flujo (N nodos)";
- `platform_workflow_get`/`platform_workflow_runs`/`platform_workflow_trigger` -> their existing labels.

The fallback remains "Trabajando en el proyecto" with the raw normalized tool name available in the event detail. This change does not add a new event schema field; the label itself is the observable behavior. The project-agent change can extend the schema with richer detail later.

### 6. Make the global tool inventory read-only at registration

`createPlatformTools` filters its raw set when `scope.global` is true. The global set is:

```text
workflow_list, workflow_get, workflow_runs, project_overview,
subagent_list, kb_search, health_summary
```

The following are excluded from the global scope: `workflow_upsert`, `workflow_trigger`, `subagent_upsert`, `db_query`, `notify`. `subagent_list` is read-only and remains. The server's global non-GET rejection remains as defense in depth, and the existing audit log for rejected mutations is unchanged.

Project scope is unchanged and still enforces per-agent permissions. The plugin's namespace registration continues to produce `platform_<tool>` names; filtering happens before registration, so the model never sees a mutating global tool.

### 7. Web wiring

`api.controlChat` accepts an optional `onEvent` and forwards it to `chatStream`. `OrchestratorPage` passes the `onEvent` argument from `ChatPanel` into the mutation, mirroring `ProjectPage`:

```text
onSend={(message, onEvent) => chat.mutateAsync({ message, onEvent }).then((result) => result.reply)}
```

`ChatPanel` already renders `delta`/`activity` events and shows elapsed time; no new UI component is required. The history query benefits from the blank-message filter.

### 8. Test strategy

The test pyramid for this change:

- **Unit (orchestrator use case):** model resolver precedence (env, platform default, missing), empty first reply then success, empty first and second reply, no empty agent message, one user message, replacement session persisted, history filter.
- **Unit (chat progress):** `platform_workflow_upsert`, `platform_workflow_get`, `platform_workflow_runs`, `platform_workflow_trigger`, and `platform_*` with input map to readable labels; unknown names fall back safely.
- **Adapter/HTTP:** control chat non-stream returns `502` on empty; SSE returns an `error` event and no `done` with `reply: ""`; successful SSE contains `delta`/`activity`; heartbeat remains.
- **Plugin contract:** `createPlatformTools(client, { global: true })` returns only the read-only set; project scope retains the full set; an empty global scope still has no mutating tools.
- **Web:** `api.controlChat` forwards events to the callback; `OrchestratorPage` passes the callback through; a mocked SSE stream renders an activity and an error instead of an empty agent bubble.
- **Regression:** existing project chat, channel recovery, orchestrator separation, and plugin permission tests continue to pass.

The tests use the in-process fake runtime or a small scripted `AgentRuntimePort`; no live OpenCode service is required. The fake needs a scripted reply queue and a way to assert the model used by a session. Add those as test-only capabilities to `FakeAgentRuntime` or use a local fake in the specific tests.

## Risks / Trade-offs

- **Retrying an empty turn could repeat a read.** The orchestrator is read-only by spec; the retry is safe. Project chat does not auto-retry empty turns. Mitigation: keep the retry in the orchestrator use case only.
- **A configured model may still be non-tool-capable.** The platform cannot prove capability. Mitigation: document a tool-capable default, fail visibly instead of returning empty, and surface the error in the control chat and logs.
- **Switching the model on an existing session can fail.** `ensureChatSession` already catches `Session not found`; other switch errors follow the normal error path. The next user turn can recover.
- **Progress labels remain heuristic.** Unknown tools fall back to "Trabajando en el proyecto". The normalized `platform_*` mapping covers the orchestrator's current read-only set; future tools need a mapping entry.
- **Hiding blank history rows does not delete them.** The database keeps the old rows. A future cleanup/migration can remove them; no user-visible blank bubbles remain.
- **Global tool filtering changes the model's available actions.** Any former attempt to use a mutating tool from the orchestrator was already rejected with 403; removing it is a safety improvement, not a capability loss.
- **The first turn after deployment on the existing poisoned thread will do one extra session creation and prompt.** That is the intended recovery; if the retry also fails, the user sees a clear error instead of a blank success.
- **SSE progress increases event volume.** The existing progress handler deduplicates repeated activity text and the route serializes writes; the heartbeat remains 15 seconds.

## Migration Plan

1. Deploy the server, plugin, and web build together. No database migration is required.
2. On the first orchestrator message after deployment, the model resolver applies. The existing poisoned session is replaced after its first empty reply, and the retry uses the configured model. If the platform default is missing, the user sees an actionable configuration error; set the default model in Settings or `ORCHESTRATOR_MODEL`.
3. Existing blank `agent` rows remain in SQLite but are filtered from the control history. No data is deleted.
4. Restart the platform/OpenCode service after the plugin change so the global tool inventory is re-registered.
5. Rollback is a server/web/plugin revert. Existing sessions and chat rows are unchanged; the old behavior returns. No data rollback is needed.

## Open Questions

None that change the approach, specs, or task breakdown. The project primary-agent activity/validation work is explicitly deferred to a separate change.
