# src/application/use-cases — the engine

Score 12 (25 files, 6,395 LOC; ChatTurnService 26 refs, ExecuteWorkflowRunUseCase 23). Earned file: the hottest code in the repo lives here.

## WHERE TO LOOK
| Concern | File (LOC) |
|---------|-----------|
| Workflow run engine | execute-workflow.ts (1,408) — prepare -> runGraph -> node dispatch |
| Chat turn lifecycle | chat-turns.ts (919) — start / waitForTerminal / cancel / recover / shutdown |
| Inbound channel routing | route-channel-message.ts (812) — project + global routers sharing one ChannelRouterDeps |
| Integration CRUD + keys | manage-integrations.ts (351) — sha256 keyHash, constant-time verify |
| Project lifecycle | projects.ts (320) — incl. syncProjectsFromDisk |
| Orchestrator (global chat) | orchestrator.ts (297) — resolveOrchestratorModel |
| Bootstrap (first boot) | bootstrap.ts (111) — idempotent; never overwrites users/master key |
| Webhook sign/deliver | external-chat.ts (208) — `x-platform-signature: sha256=<hmac>`, assertSafeUrl on target |
| DB integrations | database-actions.ts (120) — read/write/ddl policy, row caps, auto-transaction >1 statement |
| Knowledge ingest/search | ingest-knowledge.ts (151) / search-knowledge.ts (117) |

## EXECUTION SEMANTICS
- Atomic claim: `store.runs.claim` -> `{ run, created }`; payloadHash mismatch -> IdempotencyMismatchError; already running -> RunInFlightError (both owned by domain/workflow/graph.ts).
- Concurrency: `maxConcurrentRuns ?? 2` per project; overflow enqueues to store.queue, dispatchQueued() drains it.
- Pure helpers at the bottom of execute-workflow.ts: evaluateCondition, executeTransform, executeHttpNode, parseAndValidateAgentOutput, buildNodePrompt.
- ExecuteWorkflowRunUseCase is the only class with `protected readonly deps` — it is subclassed.

## GUARDS BAKED INTO SERVICES
- chat-turns.ts: "A broken subscriber must not break the turn" — listener exceptions swallowed; per-turn event buffer capped at 200 entries.
- search-knowledge.ts: embedding failure degrades to full-text search, never throws.
- chat-session.ts: OpenCode session lost -> recreate + persist on the same thread so later turns work.
- workflow-resources.ts: validated on save AND before run so a stale reference cannot fail mid-graph.
- ingest-knowledge.ts: redirects forbidden (3xx -> UNSAFE_URL), content-type allowlist, 5MB cap, 20s timeout.
- route-channel-message.ts: max 5 attachments; oversized/unsupported media answered to the user, never thrown.
- send-notification.ts: actionKey mandatory, drives delivery dedup (store.deliveries.findByActionKey).
- alerts.ts: redact() strips DB URLs, Bearer tokens, sk_* keys, password= before an alert leaves the process.

## GOTCHAS
- Service-locator exception: TestDatabaseIntegrationUseCase constructed inline at database-actions.ts:52 and manage-integrations.ts:236 (not injected).
- execute-workflow.ts:564 writes a temp code snapshot with node:fs directly.
- execute-workflow.test.ts (1,742) mirrors this file's surface — wiring changes usually break it first.
