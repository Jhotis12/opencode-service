# Graph Report - Opencode-server  (2026-11-03)

## Corpus Check
- 222 files · ~269,779 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2181 nodes · 5766 edges · 115 communities (90 shown, 25 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `79fde0f9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- agents.test.ts
- AgentRuntimePort
- App.tsx
- Store
- ChatTurnRecord
- EventBus
- channel-manager.ts
- IntegrationValidationError
- server/package.json
- WorkflowGraph
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- execute-workflow.test.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- SseEvent
- WorkflowRunRecord
- FakeRuntime
- environment
- knowledge.test.ts
- channel-router.test.ts
- web/tsconfig.json
- scripts
- ChatPanel.tsx
- devDependencies
- extractors.ts
- chat.ts
- web/src/api.ts
- steps
- contracts.test.ts
- opencode-adapter.ts
- WorkflowRunRepository
- opencode-plugin/package.json
- FakeAgentRuntime
- GrammyTransport
- ChatTurnService
- shared/src/index.ts
- NotebookRecord
- tools.ts
- app.ts
- cron.ts
- artifacts
- compilerOptions
- validation.ts
- FakeClient
- execute-workflow.ts
- ProjectPage.tsx
- BaileysTransport
- OpenCodeV2Adapter
- ChatThreadRecord
- graph.ts
- RunQueueRepository
- WorkflowCanvasProps
- NodeInspectorModal.tsx
- IntegrationManager
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- ProjectPage.tsx
- WorkflowTimerRecord
- KbSourceRecord
- ManageIntegrationsUseCase
- SqliteStore
- WorkflowDeliveryRecord
- ProjectPage
- FakeAgent
- IntegrationRecord
- telemetry.ts
- agents.ts
- WorkflowCanvas.tsx
- ChatMessageRecord
- entrypoint.sh
- config.yaml
- legacy-migration.ts
- AgentCatalog.tsx
- EmbeddingPort
- server/tsconfig.json
- web/package.json
- KnowledgeError
- scripts
- worker-entry.ts
- shared/src/api.ts
- search-knowledge.ts
- chat-progress.ts
- FakeAgent
- opencode-plugin/tsconfig.json
- ChatTurnStatus
- shared/tsconfig.json
- src/events.ts
- IntegrationValidationError
- CanvasActions
- RouteProjectIntegrationMessageUseCase
- setup.ts
- vite.config.ts
- app.http.test.ts
- notify-approval.test.ts
- WhatsAppCloudTransport
- renderTemplate
- .execute
- CodeEditor.tsx
- AgentMessage
- opencode-adapter.test.ts
- ConnectProviderUseCase
- createAgentRuntime
- .waitForTerminal
- server/src/index.ts
- ResizeObserverStub
- TurnTimeoutError

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 145 edges
2. `SqliteStore` - 64 edges
3. `Store` - 63 edges
4. `Logger` - 56 edges
5. `AgentRuntimePort` - 50 edges
6. `IntegrationRecord` - 47 edges
7. `WorkflowGraph` - 46 edges
8. `ChatTurnService` - 45 edges
9. `WorkspacePort` - 42 edges
10. `SafeFsWorkspaceAdapter` - 42 edges

## Surprising Connections (you probably didn't know these)
- `createApplication()` --calls--> `evaluateToolPermission()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/agents.ts
- `createApplication()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/api.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `IntegrationRecord` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts
- `IntegrationRecord` --references--> `IntegrationKind`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (115 total, 25 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.17
Nodes (8): LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, sanitizeSentryEvent(), SentryErrorTracker

### Community 2 - "auth-routes.ts"
Cohesion: 0.06
Nodes (34): integrationError(), PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, BootstrapResult (+26 more)

### Community 3 - "SqliteStore"
Cohesion: 0.07
Nodes (27): AgentModelInfo, Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, PROJECT_ISOLATION_PERMISSIONS, dirs, logger, dirs (+19 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.10
Nodes (13): WorkspacePort, ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter (+5 more)

### Community 5 - "AgentRuntimePort"
Cohesion: 0.09
Nodes (3): AgentRuntimePort, GetHealthUseCase, Metrics

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (28): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), ErrorBoundary, initialCollapsed() (+20 more)

### Community 7 - "Store"
Cohesion: 0.13
Nodes (11): AppConfig, Store, ExecutorDeps, ChannelRouterDeps, RouteGlobalIntegrationMessageUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase (+3 more)

### Community 9 - "EventBus"
Cohesion: 0.10
Nodes (10): EventBus, ProjectRepository, GetProjectSettingsUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, DeleteProjectUseCase (+2 more)

### Community 10 - "channel-manager.ts"
Cohesion: 0.16
Nodes (8): EgressSendResult, IntegrationEgressPort, ManagedIntegration, IntegrationEgressRouter, FakeEgress, FakeEgress, RecordingEgress, FakeEgress

### Community 11 - "IntegrationValidationError"
Cohesion: 0.15
Nodes (12): ExternalDatabaseAdapter, SecretVault, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, ExecuteDatabaseActionUseCase (+4 more)

### Community 12 - "server/package.json"
Cohesion: 0.06
Nodes (53): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@2.2.5 (+45 more)

### Community 13 - "WorkflowGraph"
Cohesion: 0.19
Nodes (8): WorkflowVersionRepository, ExecuteRunInput, captureCodeBundle(), syncProjectsFromDisk(), WorkflowVersionRecord, computeGraphHash(), ProjectTemplate, WorkflowGraph

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, DatabaseAccessPolicy, defaultRouting, EMAIL_CAPABILITIES (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.09
Nodes (28): SessionContextRepository, SessionContextRecord, chatMessages, chatThreads, chatTurns, integrations, kbChunks, kbSources (+20 more)

### Community 17 - "execute-workflow.test.ts"
Cohesion: 0.09
Nodes (15): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, MetricsSnapshot, InMemoryMetrics, SseHub, BunWorkerPoolAdapter, RpcMessage (+7 more)

### Community 18 - "workflow.ts"
Cohesion: 0.06
Nodes (32): AgentNodeConfig, DatabaseNodeConfig, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema, InputFieldSchema, InputFieldType (+24 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.15
Nodes (10): NoopErrorTracker, SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), setup(), setup() (+2 more)

### Community 20 - "SseEvent"
Cohesion: 0.16
Nodes (5): AlertService, redact(), logger, FakeEvents, SseEvent

### Community 21 - "WorkflowRunRecord"
Cohesion: 0.28
Nodes (4): buildNodePrompt(), executeHttpNode(), ExecuteWorkflowRunUseCase, nextEdge()

### Community 23 - "environment"
Cohesion: 0.06
Nodes (30): AGENT_CHAT_TIMEOUT_MS, AGENT_TURN_IDLE_MS, AGENT_TURN_MAX_MS, AGENT_TURN_POLL_MS, AGENT_TURN_RETRY_MS, CHAT_TURN_ENGINE, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL (+22 more)

### Community 24 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 25 - "channel-router.test.ts"
Cohesion: 0.18
Nodes (13): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist() (+5 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "ChatPanel.tsx"
Cohesion: 0.07
Nodes (30): dependencies, @fontsource-variable/inter@^5.3.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1, remark-gfm@^4.0.0 (+22 more)

### Community 29 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5, @types/react-dom@^19.0.2, vite@^6.0.7 (+6 more)

### Community 30 - "extractors.ts"
Cohesion: 0.19
Nodes (8): KnowledgeExtractor, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), extractDocx(), extractPdf()

### Community 31 - "chat.ts"
Cohesion: 0.09
Nodes (22): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+14 more)

### Community 32 - "web/src/api.ts"
Cohesion: 0.12
Nodes (18): ApiClientError, ApprovalRecord, attachTurnStream(), chatStream(), ChatTurnStreamError, DeliveryRecord, HealthPayload, NotebookSummary (+10 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "contracts.test.ts"
Cohesion: 0.20
Nodes (9): AgentNodeConfigSchema, DatabaseNodeConfigSchema, NodeErrorPolicySchema, NodeSpecSchema, NotifyNodeConfigSchema, ProjectTemplateSchema, TriggerConfigSchema, WorkflowVersionSchema (+1 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.10
Nodes (4): AgentInboxItem, MessageLike, ModelLike, OpenCodeClientLike

### Community 36 - "WorkflowRunRepository"
Cohesion: 0.14
Nodes (6): WorkflowRunRepository, RunState, ApprovalRecord, StepRunRecord, WorkflowRunRecord, StepStatus

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 39 - "GrammyTransport"
Cohesion: 0.09
Nodes (6): IntegrationTransport, GrammyTransport, TelegramChannelAdapter, TelegramTransport, FakeTelegram, silentLogger

### Community 40 - "ChatTurnService"
Cohesion: 0.28
Nodes (5): AgentSessionState, ChatTurnService, extractTurnReply(), isTransportError(), nowIso()

### Community 41 - "shared/src/index.ts"
Cohesion: 0.16
Nodes (20): AgentSessionRef, ErrorEventRepository, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), ChatTarget (+12 more)

### Community 42 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 43 - "tools.ts"
Cohesion: 0.14
Nodes (15): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+7 more)

### Community 44 - "app.ts"
Cohesion: 0.09
Nodes (13): AppEnv, ApprovalDecisionError, DecideApprovalUseCase, assertChatTimeoutsCoverOpenCode(), ChatTurnPolicy, positive(), resolveChatTurnPolicy(), TurnInProgressError (+5 more)

### Community 45 - "cron.ts"
Cohesion: 0.17
Nodes (16): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), nextCronDate() (+8 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "validation.ts"
Cohesion: 0.18
Nodes (16): hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand, verifyIntegrationKey(), assertIntegrationInScope(), DATABASE_KINDS, requiredSecretRefs(), ValidatedIntegrationInput (+8 more)

### Community 50 - "execute-workflow.ts"
Cohesion: 0.20
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "ProjectPage.tsx"
Cohesion: 0.12
Nodes (18): RunRecord, Modal(), ModalSize, SIZE_CLASS, ProjectKnowledgePanel(), ProjectTab, ProjectTopBar(), TABS (+10 more)

### Community 52 - "BaileysTransport"
Cohesion: 0.12
Nodes (3): BaileysTransport, WhatsAppTransport, FakeWhatsApp

### Community 54 - "ChatThreadRecord"
Cohesion: 0.14
Nodes (6): ChatThreadRepository, VaultRepository, StartChatTurnInput, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 55 - "graph.ts"
Cohesion: 0.29
Nodes (10): isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), stableStringify(), startNode(), topologicalOrder() (+2 more)

### Community 57 - "WorkflowCanvasProps"
Cohesion: 0.18
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 58 - "NodeInspectorModal.tsx"
Cohesion: 0.10
Nodes (25): ModelInfo, ProjectSettingsView, nodeIssues(), DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS, InputFieldsEditor(), NodeInspector() (+17 more)

### Community 59 - "IntegrationManager"
Cohesion: 0.18
Nodes (4): deliverWebhook(), signWebhook(), IntegrationManager, WhatsAppChannelAdapter

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 64 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (41): api, AgentFormState, AgentMode, BrandLockup(), BrandMark(), ControlChannelsPanel(), KINDS, CHANNEL_KINDS (+33 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "ManageIntegrationsUseCase"
Cohesion: 0.30
Nodes (5): createApplication(), resolveProjectRouteTool(), safeEqual(), ManageIntegrationsUseCase, IntegrationScope

### Community 68 - "SqliteStore"
Cohesion: 0.11
Nodes (10): ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, DatabaseHandle, createStore(), parse(), SqliteStore, captureLogger() (+2 more)

### Community 70 - "ProjectPage"
Cohesion: 0.09
Nodes (34): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), GraphIssue, issue() (+26 more)

### Community 72 - "IntegrationRecord"
Cohesion: 0.15
Nodes (4): IntegrationManagerPort, IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 73 - "telemetry.ts"
Cohesion: 0.15
Nodes (12): ChatHealthSummary, ChatHealthSummarySchema, EntryPointTypeSchema, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema (+4 more)

### Community 74 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 75 - "WorkflowCanvas.tsx"
Cohesion: 0.09
Nodes (30): NodePaletteModal(), ShapePreview(), CanvasActionsContext, useCanvasActions(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS (+22 more)

### Community 76 - "ChatMessageRecord"
Cohesion: 0.22
Nodes (4): ChatRepository, TurnFailureError, ChatMessageRecord, ChatTurnErrorCode

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "legacy-migration.ts"
Cohesion: 0.10
Nodes (27): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), channelKind(), createMigrationBackup(), databaseKind() (+19 more)

### Community 80 - "AgentCatalog.tsx"
Cohesion: 0.33
Nodes (9): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), NodeIcon(), agentModeLabel() (+1 more)

### Community 81 - "EmbeddingPort"
Cohesion: 0.25
Nodes (7): EmbeddingPort, buildGroundedContext(), cosineSimilarity(), createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "web/package.json"
Cohesion: 0.17
Nodes (11): @platform/shared@workspace:*, zod@^3.24.1, @types/react@^19.0.3, typescript@^5.7.2, @platform/shared, typescript, zod, name (+3 more)

### Community 84 - "KnowledgeError"
Cohesion: 0.27
Nodes (3): KnowledgeFilePort, KnowledgeError, KnowledgeFileStore

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 89 - "chat-progress.ts"
Cohesion: 0.18
Nodes (11): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+3 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "ChatTurnStatus"
Cohesion: 0.16
Nodes (8): ChatTurnResult, ChatTurnActions, ChatTurnConnection, ChatTurnController, statusFromEvent(), useChatTurn(), ChatTurnEvent, ChatTurnStatus

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 94 - "src/events.ts"
Cohesion: 0.22
Nodes (7): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, StepStatusSchema, WorkflowGraphSchema

### Community 95 - "IntegrationValidationError"
Cohesion: 0.44
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 98 - "setup.ts"
Cohesion: 0.18
Nodes (3): @testing-library/jest-dom@^6.6.3, EventSourceStub, @testing-library/jest-dom

### Community 99 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 100 - "app.http.test.ts"
Cohesion: 0.29
Nodes (5): Application, json(), logEntries, testLogger, waitForApproval()

### Community 101 - "notify-approval.test.ts"
Cohesion: 0.39
Nodes (5): NotifyApprovalUseCase, FakeEgress, integration(), logger(), setup()

### Community 104 - "renderTemplate"
Cohesion: 0.48
Nodes (6): evaluateCondition(), executeTransform(), renderParams(), renderTemplate(), resolvePath(), templateValue()

### Community 105 - ".execute"
Cohesion: 0.38
Nodes (3): ChannelAuthError, SendExternalChatMessageUseCase, createExternalChatRoutes()

### Community 106 - "CodeEditor.tsx"
Cohesion: 0.38
Nodes (5): @monaco-editor/react@^4.6.0, CodeEditor(), FallbackEditor(), Monaco, @monaco-editor/react

### Community 108 - "opencode-adapter.test.ts"
Cohesion: 0.33
Nodes (3): AgentPromptTimeoutError, extractAssistantText(), adapterWith()

### Community 110 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 747 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `ManageIntegrationsUseCase` to `logger.ts`, `auth-routes.ts`, `SqliteStore`, `agents.test.ts`, `AgentRuntimePort`, `Store`, `ChatTurnRecord`, `EventBus`, `channel-manager.ts`, `IntegrationValidationError`, `server/package.json`, `WorkflowGraph`, `execute-workflow.test.ts`, `SafeFsWorkspaceAdapter`, `SseEvent`, `WorkflowRunRecord`, `extractors.ts`, `ChatTurnService`, `shared/src/index.ts`, `NotebookRecord`, `tools.ts`, `app.ts`, `cron.ts`, `validation.ts`, `IntegrationManager`, `SqliteStore`, `ChatMessageRecord`, `EmbeddingPort`, `KnowledgeError`, `search-knowledge.ts`, `chat-progress.ts`, `ChatTurnStatus`, `IntegrationValidationError`, `RouteProjectIntegrationMessageUseCase`, `app.http.test.ts`, `notify-approval.test.ts`, `.execute`, `.execute`, `ConnectProviderUseCase`, `createAgentRuntime`, `.waitForTerminal`, `server/src/index.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 74 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 74 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05875251509054326 - nodes in this community are weakly interconnected._
- **Why does `WorkflowGraph` connect `WorkflowGraph` to `SqliteStore`, `EventBus`, `ui.test.tsx`, `sqlite-store.ts`, `execute-workflow.test.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `WorkflowRunRecord`, `web/src/api.ts`, `shared/src/index.ts`, `app.ts`, `cron.ts`, `ProjectPage.tsx`, `graph.ts`, `WorkflowCanvasProps`, `NodeInspectorModal.tsx`, `ProjectPage`, `WorkflowCanvas.tsx`, `app.http.test.ts`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `SqliteStore` be split into smaller, more focused modules?**
  _Cohesion score 0.06810035842293907 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `SqliteStore`, `agents.test.ts`, `opencode-adapter.ts`, `FakeAgentRuntime`, `Store`, `FakeAgent`, `shared/src/index.ts`, `.execute`, `IntegrationValidationError`, `app.ts`, `ConnectProviderUseCase`, `execute-workflow.test.ts`, `OpenCodeV2Adapter`, `FakeRuntime`, `chat-progress.ts`, `FakeAgent`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._