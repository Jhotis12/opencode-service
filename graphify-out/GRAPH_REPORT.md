# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 209 files · ~238,734 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1982 nodes · 5047 edges · 111 communities (87 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 156 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a13dbba1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- execute-workflow.test.ts
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- agents.test.ts
- WorkspacePort
- App.tsx
- ref_node_fs
- react
- Store
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
- BaileysTransport
- ProjectPage
- environment
- IntegrationRecord
- knowledge.test.ts
- web/tsconfig.json
- scripts
- FakeAgentRuntime
- DynamicDatabaseClientAdapter
- legacy-migration.ts
- store.ts
- dependencies
- steps
- NodeInspectorModal.tsx
- opencode-adapter.ts
- chat-progress.ts
- opencode-plugin/package.json
- createApplication
- router.ts
- GrammyTransport
- contracts.test.ts
- IntegrationValidationError
- tools.ts
- cron.ts
- devDependencies
- artifacts
- compilerOptions
- ChatPanel.tsx
- FakeClient
- input.ts
- entities.ts
- setup.ts
- src/events.ts
- OpenCodeV2Adapter
- web/src/api.ts
- logger.ts
- execute-workflow.ts
- NotebookRecord
- IntegrationManager
- shared/package.json
- PlatformClient
- app.ts
- WorkflowScheduleStateRecord
- FakeAgent
- worker-pool.test.ts
- KbSourceRecord
- manage-integrations.ts
- extractors.ts
- WorkflowDeliveryRecord
- connections.test.ts
- FakeAgent
- database-actions.ts
- telemetry.ts
- createAgentRuntime
- ExecuteWorkflowRunUseCase
- chat.ts
- entrypoint.sh
- config.yaml
- ChatThreadRecord
- SettingsRepository
- search-knowledge.ts
- server/tsconfig.json
- WorkflowCanvasProps
- EmbeddingPort
- channel-manager.ts
- worker-entry.ts
- scripts
- web/package.json
- channel-adapters.test.ts
- agents.ts
- opencode-plugin/tsconfig.json
- RouteProjectIntegrationMessageUseCase
- shared/tsconfig.json
- WorkflowVersionRecord
- alerts.ts
- IntegrationManagerPort
- opencode-adapter.test.ts
- vite.config.ts
- legacy-migration.test.ts
- EntityScope
- .execute
- ChatMessageRecord
- alerts.test.ts
- scripts
- CanvasActions
- ProjectsPage
- ErrorEventRecord
- server/src/index.ts
- ErrorBoundary
- DatabaseHandle

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 126 edges
2. `Store` - 57 edges
3. `SqliteStore` - 52 edges
4. `Logger` - 45 edges
5. `SafeFsWorkspaceAdapter` - 42 edges
6. `IntegrationRecord` - 42 edges
7. `WorkspacePort` - 42 edges
8. `AgentRuntimePort` - 41 edges
9. `ProjectPage()` - 39 edges
10. `react` - 34 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `createExternalChatRoutes()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/infrastructure/in/http/external-chat-routes.ts → packages/shared/src/api.ts
- `runLegacyMigration()` --calls--> `defaultCapabilities()`  [EXTRACTED]
  apps/server/src/infrastructure/out/persistence/legacy-migration.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (111 total, 24 thin omitted)

### Community 0 - "execute-workflow.test.ts"
Cohesion: 0.08
Nodes (14): ErrorTracker, Metrics, MetricsSnapshot, redact(), SECRET_KEY_PATTERN, InMemoryMetrics, NoopErrorTracker, sanitizeSentryEvent() (+6 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.06
Nodes (36): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, DEFAULT_ADMIN_PASSWORD, UserRecord (+28 more)

### Community 3 - "SqliteStore"
Cohesion: 0.08
Nodes (24): ChatWithOrchestratorUseCase, resolveOrchestratorModel(), ChatWithProjectUseCase, SqliteStore, dirs, silentLogger, trigger, dirs (+16 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.12
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "WorkspacePort"
Cohesion: 0.12
Nodes (9): WorkspacePort, captureCodeBundle(), CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), computeGraphHash() (+1 more)

### Community 6 - "App.tsx"
Cohesion: 0.11
Nodes (27): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+19 more)

### Community 7 - "ref_node_fs"
Cohesion: 0.10
Nodes (17): BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing(), Aes256GcmVaultAdapter, loadOrCreateMasterKey() (+9 more)

### Community 8 - "react"
Cohesion: 0.10
Nodes (42): api, RunRecord, ControlChannelsPanel(), KINDS, ProjectKnowledgePanel(), KIND_OPTIONS, kindLabel(), ProjectResourcesPanel() (+34 more)

### Community 9 - "Store"
Cohesion: 0.10
Nodes (8): EventBus, AgentRuntimePort, SecretVault, Store, ExecutorDeps, ChannelRouterDeps, Logger, ExternalChatRouteDeps

### Community 10 - "store.ts"
Cohesion: 0.16
Nodes (7): ProjectRepository, GetProjectSettingsUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, ProjectRecord

### Community 11 - "graph.ts"
Cohesion: 0.21
Nodes (9): computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), RunInFlightError, stableStringify(), topologicalOrder(), validateWorkflowGraph() (+1 more)

### Community 12 - "server/package.json"
Cohesion: 0.07
Nodes (39): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+31 more)

### Community 13 - "shared/src/index.ts"
Cohesion: 0.08
Nodes (36): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode, toForm() (+28 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (18): apiMock, primary, renderCatalog(), subagent, renderLayout(), apiMock, graph, renderPage() (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.12
Nodes (22): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, systemErrorEvents (+14 more)

### Community 17 - "WorkflowRunRecord"
Cohesion: 0.18
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (40): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+32 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.18
Nodes (9): SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress, setup(), setup(), setup(), setup(), setup() (+1 more)

### Community 20 - "WorkflowCanvas.tsx"
Cohesion: 0.09
Nodes (32): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), GraphIssue, issue() (+24 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.12
Nodes (3): BaileysTransport, WhatsAppTransport, FakeWhatsApp

### Community 22 - "ProjectPage"
Cohesion: 0.17
Nodes (16): ProjectTopBar(), ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge() (+8 more)

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

### Community 29 - "DynamicDatabaseClientAdapter"
Cohesion: 0.24
Nodes (9): ExternalDatabaseStatement, ExternalDatabaseStatementResult, ExternalDbConfig, DynamicDatabaseClientAdapter, isReadStatement(), sqliteStatement(), withTimeout(), mssql (+1 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 31 - "store.ts"
Cohesion: 0.15
Nodes (15): ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview, withTimeout() (+7 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1, remark-gfm@^4.0.0 (+8 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspectorModal.tsx"
Cohesion: 0.09
Nodes (24): ModelInfo, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), InputFieldsEditor() (+16 more)

### Community 36 - "chat-progress.ts"
Cohesion: 0.33
Nodes (8): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.27
Nodes (4): createApplication(), ManageIntegrationsUseCase, useCase(), IntegrationScope

### Community 39 - "router.ts"
Cohesion: 0.31
Nodes (8): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist(), ChannelMode

### Community 40 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (4): databaseConfig(), TestDatabaseIntegrationUseCase, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.19
Nodes (13): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+5 more)

### Community 44 - "cron.ts"
Cohesion: 0.17
Nodes (17): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, isValidCronExpression(), matchesCron(), matchesCronInTimeZone(), matchesParts() (+9 more)

### Community 45 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5, @types/react-dom@^19.0.2, typescript@^5.7.2 (+6 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "ChatPanel.tsx"
Cohesion: 0.18
Nodes (12): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+4 more)

### Community 50 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "entities.ts"
Cohesion: 0.12
Nodes (5): SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, DeliveryStatus

### Community 52 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 53 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 55 - "web/src/api.ts"
Cohesion: 0.10
Nodes (13): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+5 more)

### Community 56 - "logger.ts"
Cohesion: 0.25
Nodes (5): LogBindings, createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter

### Community 57 - "execute-workflow.ts"
Cohesion: 0.27
Nodes (8): evaluateCondition(), ExecuteRunInput, executeTransform(), RunState, renderParams(), renderTemplate(), resolvePath(), templateValue()

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 59 - "IntegrationManager"
Cohesion: 0.16
Nodes (4): deliverWebhook(), signWebhook(), IntegrationManager, WhatsAppChannelAdapter

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "app.ts"
Cohesion: 0.12
Nodes (10): AppConfig, AppEnv, Application, integrationError(), resolveProjectRouteTool(), safeEqual(), PROJECT_ISOLATION_PERMISSIONS, logEntries (+2 more)

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "manage-integrations.ts"
Cohesion: 0.35
Nodes (10): IntegrationCommand, IntegrationUpdateCommand, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), IntegrationCapability (+2 more)

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 70 - "connections.test.ts"
Cohesion: 0.09
Nodes (5): AgentModelInfo, ConnectProviderUseCase, sanitizeDatabaseError(), dirs, FakeRuntime

### Community 72 - "database-actions.ts"
Cohesion: 0.16
Nodes (10): AgentSessionRef, ExternalDatabaseAdapter, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, classifySql(), DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult (+2 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.15
Nodes (12): GetHealthUseCase, EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshot, HealthSnapshotSchema, HealthStatus, HealthStatusSchema (+4 more)

### Community 74 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 75 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.27
Nodes (5): buildNodePrompt(), executeHttpNode(), ExecuteWorkflowRunUseCase, nextEdge(), startNode()

### Community 76 - "chat.ts"
Cohesion: 0.13
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 81 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.16
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 85 - "channel-manager.ts"
Cohesion: 0.15
Nodes (8): EgressSendResult, IntegrationEgressPort, ManagedIntegration, IntegrationEgressRouter, TelegramChannelAdapter, FakeEgress, RecordingEgress, FakeEgress

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 88 - "web/package.json"
Cohesion: 0.17
Nodes (11): @fontsource-variable/inter@^5.3.0, @platform/shared@workspace:*, @types/react@^19.0.3, vite@^6.0.7, @platform/shared, name, type, version (+3 more)

### Community 89 - "channel-adapters.test.ts"
Cohesion: 0.18
Nodes (3): parseCloudWebhook(), WhatsAppCloudTransport, silentLogger

### Community 90 - "agents.ts"
Cohesion: 0.15
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "alerts.ts"
Cohesion: 0.21
Nodes (4): AlertService, redact(), SseHub, SseEvent

### Community 97 - "opencode-adapter.test.ts"
Cohesion: 0.22
Nodes (5): AgentPromptTimeoutError, extractAssistantText(), OpenCodeClientLike, TimeoutAgent, adapterWith()

### Community 98 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 99 - "legacy-migration.test.ts"
Cohesion: 0.16
Nodes (13): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), columnsOf(), migrate() (+5 more)

### Community 100 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 101 - ".execute"
Cohesion: 0.36
Nodes (5): ChannelAuthError, SendExternalChatMessageUseCase, hashIntegrationKey(), verifyIntegrationKey(), createExternalChatRoutes()

### Community 104 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, migrate:legacy, start, test, typecheck

### Community 106 - "ProjectsPage"
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 719 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `execute-workflow.test.ts`, `auth-routes.ts`, `SqliteStore`, `agents.test.ts`, `WorkspacePort`, `ref_node_fs`, `store.ts`, `SafeFsWorkspaceAdapter`, `DynamicDatabaseClientAdapter`, `store.ts`, `IntegrationValidationError`, `cron.ts`, `entities.ts`, `logger.ts`, `NotebookRecord`, `IntegrationManager`, `app.ts`, `worker-pool.test.ts`, `extractors.ts`, `connections.test.ts`, `database-actions.ts`, `telemetry.ts`, `createAgentRuntime`, `ExecuteWorkflowRunUseCase`, `search-knowledge.ts`, `EmbeddingPort`, `channel-manager.ts`, `RouteProjectIntegrationMessageUseCase`, `alerts.ts`, `.execute`, `ChatMessageRecord`, `server/src/index.ts`, `DatabaseHandle`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 63 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 63 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `execute-workflow.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08367071524966262 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `Store` to `execute-workflow.test.ts`, `FakeAgent`, `SqliteStore`, `agents.test.ts`, `opencode-adapter.ts`, `connections.test.ts`, `FakeAgent`, `database-actions.ts`, `telemetry.ts`, `OpenCodeV2Adapter`, `execute-workflow.ts`, `FakeAgentRuntime`, `store.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.056314699792960665 - nodes in this community are weakly interconnected._
- **Why does `ProjectPage()` connect `ProjectPage` to `NodeInspectorModal.tsx`, `App.tsx`, `react`, `shared/src/index.ts`, `ui.test.tsx`, `ChatPanel.tsx`, `WorkflowCanvas.tsx`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._