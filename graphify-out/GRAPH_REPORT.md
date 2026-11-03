# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 208 files · ~236,867 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1955 nodes · 4979 edges · 100 communities (80 shown, 20 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2f2de18a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- ref_bun_test
- WorkspacePort
- ProjectPage.tsx
- App.tsx
- bootstrap.ts
- react
- Logger
- store.ts
- graph.ts
- server/package.json
- shared/src/index.ts
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- WorkflowRunRecord
- workflow.ts
- SafeFsWorkspaceAdapter
- WorkflowCanvas.tsx
- channel-adapters.test.ts
- ProjectPage
- environment
- IntegrationRecord
- knowledge.test.ts
- web/tsconfig.json
- scripts
- FakeAgentRuntime
- KnowledgeError
- legacy-migration.ts
- orchestrator.ts
- dependencies
- steps
- NodeInspector.tsx
- opencode-adapter.ts
- chat-progress.ts
- opencode-plugin/package.json
- createApplication
- route-channel-message.ts
- EventBus
- contracts.test.ts
- IntegrationValidationError
- tools.ts
- WorkflowScheduler
- devDependencies
- artifacts
- compilerOptions
- ChatPanel.tsx
- FakeClient
- input.ts
- IntegrationEgressPort
- setup.ts
- src/events.ts
- OpenCodeV2Adapter
- web/src/api.ts
- shared/src/api.ts
- execute-workflow.ts
- NotebookRecord
- IntegrationManager
- shared/package.json
- PlatformClient
- app.ts
- WorkflowScheduleStateRecord
- execute-workflow.test.ts
- worker-pool.test.ts
- KbSourceRecord
- manage-integrations.ts
- extractors.ts
- WorkflowDeliveryRecord
- FakeRuntime
- input-contract.test.ts
- database-actions.ts
- telemetry.ts
- createAgentRuntime
- ExecuteWorkflowRunUseCase
- chat.ts
- entrypoint.sh
- config.yaml
- store.ts
- SettingsRepository
- search-knowledge.ts
- server/tsconfig.json
- health.ts
- EmbeddingPort
- channel-manager.ts
- worker-entry.ts
- scripts
- web/package.json
- UserRecord
- agents.ts
- opencode-plugin/tsconfig.json
- ConnectProviderUseCase
- shared/tsconfig.json
- WorkflowVersionRecord
- telemetry/index.ts
- IntegrationManagerPort
- opencode-adapter.test.ts
- vite.config.ts
- migrate-legacy.ts

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 57 edges
3. `SqliteStore` - 50 edges
4. `Logger` - 44 edges
5. `IntegrationRecord` - 42 edges
6. `WorkspacePort` - 42 edges
7. `AgentRuntimePort` - 41 edges
8. `SafeFsWorkspaceAdapter` - 40 edges
9. `ProjectPage()` - 39 edges
10. `react` - 34 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `ProjectSettingsView` --references--> `IntegrationRecord`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/integrations.ts
- `createExternalChatRoutes()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/infrastructure/in/http/external-chat-routes.ts → packages/shared/src/api.ts

## Import Cycles
- None detected.

## Communities (100 total, 20 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.11
Nodes (10): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, NoopErrorTracker (+2 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.12
Nodes (18): ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, authMiddleware(), AuthVariables, PASSWORD_CHANGE_ALLOWLIST, readUser(), SESSION_COOKIE (+10 more)

### Community 3 - "ref_bun_test"
Cohesion: 0.07
Nodes (23): Application, ExecuteDatabaseActionUseCase, ChatWithProjectUseCase, Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, logEntries, testLogger (+15 more)

### Community 4 - "WorkspacePort"
Cohesion: 0.06
Nodes (29): WorkspacePort, ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), ManageSubagentsUseCase, captureCodeBundle() (+21 more)

### Community 5 - "ProjectPage.tsx"
Cohesion: 0.13
Nodes (18): RunRecord, ProjectSettingsPanel(), ProjectTab, ProjectTopBar(), TABS, formatValue(), previewValue(), RunDetailModal() (+10 more)

### Community 6 - "App.tsx"
Cohesion: 0.09
Nodes (25): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), ErrorBoundary, initialCollapsed() (+17 more)

### Community 7 - "bootstrap.ts"
Cohesion: 0.11
Nodes (13): PasswordHasher, BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES (+5 more)

### Community 8 - "react"
Cohesion: 0.12
Nodes (33): api, AgentFormState, AgentMode, ControlChannelsPanel(), KINDS, ModalSize, SIZE_CLASS, KIND_OPTIONS (+25 more)

### Community 9 - "Logger"
Cohesion: 0.11
Nodes (7): AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), withTimeout(), Logger

### Community 10 - "store.ts"
Cohesion: 0.16
Nodes (8): ProjectRepository, Store, GetProjectSettingsUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, ProjectRecord

### Community 11 - "graph.ts"
Cohesion: 0.16
Nodes (14): FIELD_RANGES, isValidCronExpression(), matchesCron(), parseCronField(), parseFieldToken(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError (+6 more)

### Community 12 - "server/package.json"
Cohesion: 0.06
Nodes (54): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+46 more)

### Community 13 - "shared/src/index.ts"
Cohesion: 0.08
Nodes (31): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), nodeIssues(), Modal() (+23 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (31): CHANNEL_CAPABILITIES, ChannelMode, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, CreateIntegrationInputSchema, DATABASE_CAPABILITIES (+23 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.12
Nodes (22): formatDate(), ProjectsPage(), onNameChange(), slugify(), apiMock, primary, renderCatalog(), subagent (+14 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.08
Nodes (34): AppDatabase, DatabaseHandle, openDatabase(), addColumnIfMissing(), columnsOf(), migrate(), SQLITE_DDL, tableExists() (+26 more)

### Community 17 - "WorkflowRunRecord"
Cohesion: 0.19
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (39): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+31 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.18
Nodes (8): SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), setup(), setup(), workspace()

### Community 20 - "WorkflowCanvas.tsx"
Cohesion: 0.06
Nodes (30): @xyflow/react@^12.3.6, CanvasActions, CanvasActionsContext, useCanvasActions(), nodeShapeStyle(), ConnectRole, NodeStatusIcon(), PlatformFlowNode (+22 more)

### Community 21 - "channel-adapters.test.ts"
Cohesion: 0.07
Nodes (7): BaileysTransport, parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeTelegram, FakeWhatsApp, silentLogger

### Community 22 - "ProjectPage"
Cohesion: 0.08
Nodes (35): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), GraphIssue, issue() (+27 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 25 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 29 - "KnowledgeError"
Cohesion: 0.29
Nodes (3): IngestKnowledgeUseCase, KnowledgeError, setup()

### Community 30 - "legacy-migration.ts"
Cohesion: 0.22
Nodes (13): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+5 more)

### Community 31 - "orchestrator.ts"
Cohesion: 0.15
Nodes (10): ChatRepository, ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview, resolveOrchestratorModel(), ChatMessageRecord, captureLogger() (+2 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+9 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspector.tsx"
Cohesion: 0.16
Nodes (11): ModelInfo, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), InputFieldsEditor(), NodeInspector() (+3 more)

### Community 36 - "chat-progress.ts"
Cohesion: 0.33
Nodes (8): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.29
Nodes (4): createApplication(), hashIntegrationKey(), ManageIntegrationsUseCase, IntegrationScope

### Community 39 - "route-channel-message.ts"
Cohesion: 0.15
Nodes (15): IncomingIntegrationMessage, TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand() (+7 more)

### Community 40 - "EventBus"
Cohesion: 0.27
Nodes (4): EventBus, WhatsAppChannelAdapter, SseHub, SseEvent

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (5): databaseConfig(), OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.19
Nodes (13): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+5 more)

### Community 45 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^25.0.1, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/react@^19.0.3, @types/react-dom@^19.0.2, typescript@^5.7.2, vite@^6.0.7 (+6 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "ChatPanel.tsx"
Cohesion: 0.16
Nodes (14): ChatHistoryMessage, BrandLockup(), BrandMark(), ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity() (+6 more)

### Community 50 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "IntegrationEgressPort"
Cohesion: 0.12
Nodes (11): IntegrationEgressPort, ExecutorDeps, ChannelRouterDeps, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, FakeEgress (+3 more)

### Community 52 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 53 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 55 - "web/src/api.ts"
Cohesion: 0.16
Nodes (14): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+6 more)

### Community 56 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 57 - "execute-workflow.ts"
Cohesion: 0.22
Nodes (10): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), RunState, renderParams(), renderTemplate() (+2 more)

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "app.ts"
Cohesion: 0.13
Nodes (9): AppConfig, AppEnv, integrationError(), resolveProjectRouteTool(), safeEqual(), buildGroundedContext(), port, server (+1 more)

### Community 64 - "execute-workflow.test.ts"
Cohesion: 0.07
Nodes (10): AgentModelInfo, AgentPromptTimeoutError, AgentSessionRef, sanitizeDatabaseError(), dirs, dirs, FakeAgent, FakeEvents (+2 more)

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "manage-integrations.ts"
Cohesion: 0.27
Nodes (11): IntegrationCommand, IntegrationUpdateCommand, assertIntegrationInScope(), requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), manager, useCase() (+3 more)

### Community 68 - "extractors.ts"
Cohesion: 0.15
Nodes (8): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeFileStore

### Community 71 - "input-contract.test.ts"
Cohesion: 0.10
Nodes (5): MetricsSnapshot, InMemoryMetrics, dirs, FakeAgent, logger

### Community 72 - "database-actions.ts"
Cohesion: 0.14
Nodes (7): ExternalDatabaseAdapter, SecretVault, classifySql(), DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, SqlStatementKind

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 74 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 75 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.26
Nodes (4): ExecuteWorkflowRunUseCase, nextEdge(), RunInFlightError, ExternalChatRouteDeps

### Community 76 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "store.ts"
Cohesion: 0.10
Nodes (8): ChatThreadRepository, ErrorEventRepository, VaultRepository, ChatThreadRecord, DeliveryStatus, EntityScope, ErrorEventRecord, VaultSecretRecord

### Community 81 - "search-knowledge.ts"
Cohesion: 0.54
Nodes (3): KnowledgeSearchResult, SearchKnowledgeUseCase, cosineSimilarity()

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 85 - "channel-manager.ts"
Cohesion: 0.11
Nodes (7): EgressSendResult, IntegrationTransport, ManagedIntegration, IntegrationEgressRouter, GrammyTransport, TelegramChannelAdapter, TelegramTransport

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 88 - "web/package.json"
Cohesion: 0.20
Nodes (9): @platform/shared@workspace:*, tailwindcss@^4.3.3, @types/qrcode@^1.5.5, @platform/shared, name, type, version, tailwindcss (+1 more)

### Community 90 - "agents.ts"
Cohesion: 0.15
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "telemetry/index.ts"
Cohesion: 0.14
Nodes (5): AlertService, redact(), SECRET_KEY_PATTERN, FakeEgress, logger

### Community 97 - "opencode-adapter.test.ts"
Cohesion: 0.40
Nodes (3): extractAssistantText(), OpenCodeClientLike, adapterWith()

### Community 98 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 99 - "migrate-legacy.ts"
Cohesion: 0.50
Nodes (3): [databasePath, mappingPath, backupPath], mapping, sqlite

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 708 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `auth-routes.ts`, `ref_bun_test`, `WorkspacePort`, `bootstrap.ts`, `Logger`, `store.ts`, `server/package.json`, `sqlite-store.ts`, `SafeFsWorkspaceAdapter`, `KnowledgeError`, `orchestrator.ts`, `route-channel-message.ts`, `EventBus`, `IntegrationValidationError`, `WorkflowScheduler`, `IntegrationEgressPort`, `IntegrationManager`, `app.ts`, `worker-pool.test.ts`, `extractors.ts`, `input-contract.test.ts`, `createAgentRuntime`, `ExecuteWorkflowRunUseCase`, `search-knowledge.ts`, `health.ts`, `EmbeddingPort`, `channel-manager.ts`, `ConnectProviderUseCase`, `telemetry/index.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Why does `SqliteStore` connect `sqlite-store.ts` to `execute-workflow.test.ts`, `auth-routes.ts`, `ref_bun_test`, `manage-integrations.ts`, `WorkflowDeliveryRecord`, `createApplication`, `route-channel-message.ts`, `input-contract.test.ts`, `store.ts`, `store.ts`, `SafeFsWorkspaceAdapter`, `IntegrationEgressPort`, `telemetry/index.ts`, `knowledge.test.ts`, `orchestrator.ts`, `KnowledgeError`, `app.ts`, `WorkflowScheduleStateRecord`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `Logger` to `execute-workflow.test.ts`, `ref_bun_test`, `WorkspacePort`, `opencode-adapter.ts`, `FakeRuntime`, `route-channel-message.ts`, `database-actions.ts`, `input-contract.test.ts`, `IntegrationValidationError`, `ExecuteWorkflowRunUseCase`, `FakeAgentRuntime`, `IntegrationEgressPort`, `health.ts`, `OpenCodeV2Adapter`, `execute-workflow.ts`, `ConnectProviderUseCase`, `orchestrator.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._