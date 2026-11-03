# Proposal

## Why

The global orchestrator is the only cross-project control surface, but it currently returns an empty response as a successful turn as soon as it needs platform tools, and then keeps reusing the poisoned OpenCode session. A live test on 2026-11-02 showed three consecutive empty agent messages: a read-only cross-project report, a simple "which projects exist?" question, and even "hola". The control chat showed no progress, persisted blank replies, and reported HTTP success instead of an error.

The platform default and project model is `opencode-go/deepseek-v4.1-flash`; the orchestrator is running on `opencode-go/iceman-contributor-free` because the control session is created without a model and falls back to OpenCode's default. The global thread is now unusable until its session is replaced, and the spec promise that the orchestrator either answers with evidence or states what it could not verify is not met.

## What Changes

- Resolve the orchestrator model explicitly from `ORCHESTRATOR_MODEL` or the platform default model; fail the turn with an actionable configuration error when neither is set. Never silently fall back to OpenCode's default model.
- Treat an empty or whitespace-only assistant reply as a failed turn: do not persist an empty `agent` message; persist a `system` error and return an SSE `error` / HTTP `502`.
- Recover from an empty or stuck orchestrator session by creating a new session on the same global thread and retrying the prompt once; preserve exactly one user message per turn and persist the replacement session id.
- Add live progress to the control chat (text deltas, tool activity, elapsed time) using the existing chat progress pipeline, and normalize namespaced `platform_*` tool names so the activity is meaningful.
- Expose only read-only platform tools to the global scope. Mutation and side-effect tools (`workflow_upsert`, `workflow_trigger`, `subagent_upsert`, `db_query`, `notify`) are not part of the orchestrator inventory; the server's global non-GET rejection remains as defense in depth.
- Filter empty `agent` messages from the control chat history so existing blank replies from the poisoned thread are not rendered as empty bubbles.
- Document `ORCHESTRATOR_MODEL` and the orchestrator model-resolution order.
- Add regression coverage for model selection, empty replies, stuck-session recovery, no empty message persistence, control-chat progress, and the read-only global tool inventory.

### Out of scope

- Project primary-agent activity labels, workflow edit batching, and `codeFile` existence validation. Those findings belong to the separate project-agent change.
- Changing the transport timeout of project chat or replacing `experimental.session.wait`.
- Adding new orchestrator actions or allowing any mutation from the global scope.
- Deleting or rewriting existing chat history rows; empty messages are filtered from the read path.
- Adding a dedicated orchestrator model picker in Settings. The env override plus platform default are sufficient for this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `global-orchestrator`: add requirements for explicit tool-capable model resolution, empty-reply failure handling, stuck-session recovery, read-only tool inventory, and progress in the control chat.
- `observability-and-testing-harness`: add regression coverage for orchestrator empty/stuck turns, model propagation, and the read-only global tool set.

## Impact

- **Server use cases**: `apps/server/src/application/use-cases/orchestrator.ts` (model, empty reply, retry, progress), `chat-session.ts` (recoverable session replacement), `chat-progress.ts` (normalize `platform_*` names and tool detail).
- **HTTP/API**: `apps/server/src/app.ts` control-chat SSE (`delta`/`activity`/`error` events), non-stream error response, and config wiring for `ORCHESTRATOR_MODEL`; `apps/web/src/api.ts` and `apps/web/src/pages/OrchestratorPage.tsx` pass and render progress events.
- **Plugin**: `packages/opencode-plugin/src/index.ts` filters the global scope to read-only tools; no new tools.
- **Persistence**: no schema migration. Existing `chat_threads.opencode_session_id` is replaced on recovery; empty `agent` rows remain in SQLite but are excluded from `history()`.
- **Configuration/docs**: `.env.example` and `README.md` document `ORCHESTRATOR_MODEL` and the fallback to the platform default.
- **Tests**: `apps/server/test/orchestrator.test.ts`, `chat-recovery.test.ts`, `chat-progress.test.ts`, `app.http.test.ts`, `packages/opencode-plugin/test/tools.test.ts`, and web tests for `OrchestratorPage`/`api` progress.
- **Dependencies**: none.
