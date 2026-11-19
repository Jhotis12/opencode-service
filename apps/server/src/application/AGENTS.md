# src/application — ports + use-case orchestration

Score 12 (38 files; Store 81 refs, AgentRuntimePort 36). Earned file: the hexagonal core every other layer depends on. use-cases/ has its own AGENTS.md; ports/ (13 files, pure interfaces, score 9) is covered here.

## OVERVIEW
ports/ = boundary contracts; use-cases/ = 30 orchestration classes. Imports only `../../domain/*` + `@platform/shared`; infrastructure implements the ports (dependency inversion at the IO boundary).

## PORTS (ports/, score 9 — covered here)
- Behavior ports: `<Domain>Port` (AgentRuntimePort, WorkspacePort, MediaStorePort, SpeechPort, TranscriptionPort, CodeWorkerPort, EmbeddingPort, IntegrationEgressPort...) plus EventBus, PasswordHasher, SecretVault.
- Persistence: 19 `<Aggregate>Repository` interfaces + the `Store` aggregate (store.ts, 267 lines). Repository methods are synchronous — zero Promises in the whole contract.
- Ports are pure interfaces; only runtime code: 6 error classes + 3 limits (SPEECH_MAX_CHARS, MEDIA_MAX_BYTES, MEDIA_MAX_DURATION_SECONDS).
- Known wart: ports/runtime.ts mixes AgentRuntimePort and ExternalDatabaseAdapter in one grab-bag file.

## CONVENTIONS
- DI: one deps object for 3+ collaborators, positional args for <=3; widest cases name their contract: ExecutorDeps, ChannelRouterDeps, BootstrapOptions, IngestDeps.
- Use-case-to-use-case calls go through `Pick<ConcreteUseCase, "method">` — never the concrete class.
- Naming: `<Verb><Noun>UseCase` with `execute(input)`; CRUD classes use named verbs (list/create/update/remove). Long-lived services drop the suffix: ChatTurnService, AlertService.
- Errors: dedicated class per domain with string-union `code`; plain `new Error()` lingers in projects.ts, project-settings.ts, send-notification.ts, orchestrator.ts.
- IDs `crypto.randomUUID()`; timestamps `new Date().toISOString()`; injectable clock only in ChatTurnService.
- EventBus.publish is synchronous, never awaited, never rolled back; events are plain `{ type: "run.updated" | ... }` objects.
- Cross-project isolation re-checked on every read: scope/projectSlug mismatch -> FORBIDDEN.
- Env: read in exactly one place, `resolveChatTurnPolicy(env = process.env)` (use-cases/chat-turn-policy.ts); all other config arrives as lazy getters in deps.
- `import type` for every type-only import; runtime imports limited to error classes, shared zod schemas, domain helpers.
- No transactions at this layer: atomicity is claim-based (store.runs.claim, store.queue.claimNext, store.timers.claimDue). External-DB transactions exist only via ExternalDatabaseAdapter.

## GOTCHAS
- 5 files import infrastructure (acknowledged layer violations): bootstrap.ts (loadOrCreateMasterKey), ingest-knowledge.ts (KnowledgeError, htmlToMarkdown), search-knowledge.ts (cosineSimilarity, KnowledgeError), manage-subagents.ts (MarkdownAgentAdapter type), projects.ts (WorkspaceError).
- execute-workflow.ts and bootstrap.ts import node:fs directly (temp code snapshot; master-key bootstrap).

Engine detail (execute-workflow, chat turns, channel routing): see use-cases/AGENTS.md.
