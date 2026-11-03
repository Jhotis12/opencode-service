# Tasks

## 1. Model resolution and session configuration

- [x] 1.1 Add `ORCHESTRATOR_MODEL` resolution in `apps/server/src/app.ts` and a model resolver dependency to `ChatWithOrchestratorUseCase`: trimmed env value first, platform default (`settings.default_model`) second, otherwise a typed configuration error naming both settings; verify with unit tests for env precedence, default fallback, and missing-model failure.
- [x] 1.2 Pass the resolved model to `createSession` and switch the model on an existing session through `ChatSessionFactory.model` / `ensureChatSession`; verify a unit test asserts the created session model and a `switchModel` call when a healthy session is reused.
- [x] 1.3 Append the orchestrator user message once before model and session resolution, so configuration or session failures preserve the original message; verify a missing-model test still finds exactly one user message plus a system error.
- [x] 1.4 Document `ORCHESTRATOR_MODEL` and the resolution order in `.env.example` and the README variable table; verify the documented values match `app.ts` and the tests.

## 2. Empty reply is a failed turn

- [x] 2.1 Add `EmptyAgentReplyError` and a `reply.trim()` check in `ChatWithOrchestratorUseCase`; on empty or whitespace, do not append an agent message, persist a system error, and rethrow; verify unit tests for empty and whitespace replies assert no `agent` row and one `system` row.
- [x] 2.2 Filter empty/whitespace `agent` messages from `ChatWithOrchestratorUseCase.history()`; verify a store seeded with old empty agent rows returns only non-empty messages.
- [x] 2.3 Add HTTP tests for the non-stream and SSE control-chat routes with a monkey-patched empty `application.agent.prompt`: non-stream returns `502`, SSE emits `error` and no `done` with an empty reply, and the persisted history contains a system error; verify with `bun test --cwd apps/server`.

## 3. Stuck-session recovery

- [x] 3.1 Implement one replacement-session retry when the first orchestrator reply is empty: create a new session, persist its id on the same thread, retry the prompt once, and stop after the second empty reply; verify unit tests for empty-then-text and empty-then-empty with exactly one user message and at most one agent response.
- [x] 3.2 Extend `ensureChatSession` to apply `switchModel` on a reused session and preserve the existing `Session not found` recovery; verify a unit test covers a healthy session model switch and a stale-session reconstruction.
- [x] 3.3 Add an orchestrator empty/stuck regression to `apps/server/test/chat-recovery.test.ts` that asserts the replacement session is persisted and the next turn uses it; verify with `bun test --cwd apps/server test/chat-recovery.test.ts`.

## 4. Control-chat progress

- [x] 4.1 Normalize a leading `platform_` or `platform.` in `createChatProgressHandler`, and map tool input for `edit`/`write` file paths and `bash`/`shell` commands; verify unit tests cover `platform_workflow_upsert`, `platform_workflow_get`, `platform_workflow_runs`, `platform_workflow_trigger`, a node edit, and a test command.
- [x] 4.2 Add an optional `onProgress` to `ChatWithOrchestratorUseCase.execute` and forward it to `promptWithSessionRecovery`; mirror the project-chat SSE route with `delta`, `activity`, `heartbeat`, `done`, and `error` events; verify HTTP/SSE tests assert a text delta, an activity, and an error on empty.
- [x] 4.3 Update `apps/web/src/api.ts` `controlChat` to forward `onEvent` and `OrchestratorPage` to pass the `ChatPanel` callback into the mutation; verify a web test with a mocked SSE body renders the activity and the error instead of an empty agent bubble, and run `bun run --cwd apps/web test`.
- [x] 4.4 Prevent duplicate streamed replies in `ChatPanel`: do not replace local messages while a turn is busy, clear the draft before appending the final agent message, add a web regression that simulates a history refetch mid-stream, and assert one rendered reply before and after reload in E2E; verify with `bun run --cwd apps/web test` and `bun run test:e2e`.

## 5. Read-only global tool inventory

- [x] 5.1 Filter `createPlatformTools` when `scope.global` is true to the read-only set (`workflow_list`, `workflow_get`, `workflow_runs`, `project_overview`, `subagent_list`, `kb_search`, `health_summary`); verify plugin tests assert the global list excludes `workflow_upsert`, `workflow_trigger`, `subagent_upsert`, `db_query`, and `notify`, while project scope retains the full set.
- [x] 5.2 Add an HTTP defense-in-depth test that a global token still receives `403` for a mutating project request and that the rejection is logged; verify with `bun test --cwd apps/server`.
- [x] 5.3 Document the read-only global tool inventory in the README orchestrator section; verify the documented names match the plugin filter test.

## 6. Orchestrator logging

- [x] 6.1 Emit structured logs for `orchestrator_model_missing`, `orchestrator_empty_reply`, and `orchestrator_session_replaced` with thread, session, and entry point fields but no prompt body; verify a unit test with a spy logger observes each event.
- [x] 6.2 Log the final turn failure once from `ChatWithOrchestratorUseCase.execute` after persisting the system error, without logging tokens, secrets, or message content; verify the spy sees one failure event per failed turn.

## 7. Integration verification

- [x] 7.1 Run `bun run typecheck`, `bun run test`, and `bun run build`; verify all pass.
- [x] 7.2 Add or extend an E2E orchestrator chat scenario using the fake runtime: send a question, assert progress and a non-empty reply, and reload to confirm no blank agent bubbles; verify with `bun run test:e2e`.
- [x] 7.3 On a running instance, send “¿Qué proyectos existen?” and then “hola” to the global thread; verify the existing poisoned session is replaced, both turns return non-empty answers, and the progress/elapsed UI is visible.
- [x] 7.4 Run `graphify update .` after the code changes and verify the graph refresh completes without errors.

## Workflow follow-up

- Create `change/fix-orchestrator-tool-turns` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan fix-orchestrator-tool-turns`.
- Create one atomic commit per numbered group using Conventional Commits: `<type>(fix-orchestrator-tool-turns): <summary>`.
- Push the branch and open a PR with `gh pr create` when implementation finishes; report the URL and never merge automatically.
- Wait for human review and merge; archive only after the PR is merged.
