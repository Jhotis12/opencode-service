# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 208 files · ~234,961 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1943 nodes · 4957 edges · 100 communities (76 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `230cb0b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- ref_node_fs
- agents.test.ts
- ProjectPage.tsx
- App.tsx
- FakeWhatsApp
- react
- chat.ts
- store.ts
- graph.ts
- server/package.json
- AgentCatalog.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- WorkflowRunRecord
- workflow.ts
- SafeFsWorkspaceAdapter
- WorkflowCanvas.tsx
- shared/src/index.ts
- graph-edits.ts
- environment
- IntegrationRecord
- ChatThreadRecord
- web/tsconfig.json
- scripts
- WorkflowCanvas
- ProjectPage
- legacy-migration.ts
- ref_bun_test
- dependencies
- steps
- NodeInspectorModal.tsx
- opencode-adapter.ts
- shared/src/api.ts
- opencode-plugin/package.json
- createApplication
- route-channel-message.ts
- SseEvent
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
- shared/src/index.ts
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
- FakeAgent
- worker-pool.test.ts
- KbSourceRecord
- validation.ts
- knowledge.test.ts
- WorkflowDeliveryRecord
- FakeRuntime
- input-contract.test.ts
- Store
- telemetry.ts
- createAgentRuntime
- ExecuteWorkflowRunUseCase
- chat.ts
- entrypoint.sh
- config.yaml
- entities.ts
- SettingsRepository
- AgentModelInfo
- server/tsconfig.json
- .executeStatements
- EmbeddingPort
- Logger
- worker-entry.ts
- scripts
- web/package.json
- ProjectsPage
- agents.ts
- opencode-plugin/tsconfig.json
- migrate.ts
- shared/tsconfig.json
- WorkflowVersionRecord
- AlertService
- IntegrationManagerPort
- EntityScope
- server/src/index.ts
- CanvasActions

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 57 edges
3. `SqliteStore` - 50 edges
4. `Logger` - 44 edges
5. `IntegrationRecord` - 42 edges
6. `WorkspacePort` - 42 edges
7. `SafeFsWorkspaceAdapter` - 40 edges
8. `AgentRuntimePort` - 40 edges
9. `ProjectPage()` - 39 edges
10. `react` - 34 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `ValidatedIntegrationInput` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationKind`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ProjectSettingsView` --references--> `IntegrationRecord`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (100 total, 24 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.12
Nodes (9): ErrorTracker, LogBindings, redact(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, NoopErrorTracker, sanitizeSentryEvent() (+1 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy(), MIN_PASSWORD_LENGTH (+17 more)

### Community 3 - "ref_node_fs"
Cohesion: 0.08
Nodes (21): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+13 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (31): RunRecord, Modal(), ModalSize, SIZE_CLASS, ProjectSettingsPanel(), ProjectTab, ProjectTopBar(), TABS (+23 more)

### Community 6 - "App.tsx"
Cohesion: 0.10
Nodes (27): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+19 more)

### Community 8 - "react"
Cohesion: 0.19
Nodes (19): api, AgentFormState, AgentMode, ControlChannelsPanel(), KINDS, KIND_OPTIONS, ModalKey, qk (+11 more)

### Community 9 - "chat.ts"
Cohesion: 0.12
Nodes (15): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+7 more)

### Community 10 - "store.ts"
Cohesion: 0.15
Nodes (7): ChatRepository, ProjectRepository, ProjectReadinessItem, ProjectSettingsView, readinessFor(), ChatMessageRecord, ProjectRecord

### Community 11 - "graph.ts"
Cohesion: 0.17
Nodes (12): isValidCronExpression(), computePayloadHash(), IdempotencyMismatchError, reachableFrom(), RunInFlightError, stableStringify(), startNode(), topologicalOrder() (+4 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+47 more)

### Community 13 - "AgentCatalog.tsx"
Cohesion: 0.14
Nodes (16): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), NodePaletteModal(), ShapePreview() (+8 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (33): IntegrationCommand, IntegrationUpdateCommand, CHANNEL_CAPABILITIES, ChannelMode, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES (+25 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.18
Nodes (15): ProjectKnowledgePanel(), apiMock, primary, renderCatalog(), subagent, apiMock, { project }, renderPage() (+7 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.12
Nodes (24): AppDatabase, DatabaseHandle, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks (+16 more)

### Community 17 - "WorkflowRunRecord"
Cohesion: 0.19
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (39): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+31 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.09
Nodes (11): FakeAgentRuntime, SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress, setup(), setup(), FakeEvents, setup() (+3 more)

### Community 20 - "WorkflowCanvas.tsx"
Cohesion: 0.12
Nodes (23): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), nodeShapeStyle(), ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode() (+15 more)

### Community 21 - "shared/src/index.ts"
Cohesion: 0.05
Nodes (14): EgressSendResult, IntegrationTransport, SECRET_KEY_PATTERN, ManagedIntegration, IntegrationEgressRouter, GrammyTransport, TelegramTransport, BaileysTransport (+6 more)

### Community 22 - "graph-edits.ts"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "WorkflowCanvas"
Cohesion: 0.13
Nodes (7): toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 29 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.14
Nodes (16): [databasePath, mappingPath, backupPath], mapping, sqlite, channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn() (+8 more)

### Community 31 - "ref_bun_test"
Cohesion: 0.08
Nodes (21): ChatWithOrchestratorUseCase, OrchestratorConfigurationError, resolveOrchestratorModel(), GetProjectSettingsUseCase, UpdateProjectSettingsUseCase, createAgentRuntime(), PROJECT_ISOLATION_PERMISSIONS, dirs (+13 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+11 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspectorModal.tsx"
Cohesion: 0.07
Nodes (27): ModelInfo, StepRun, GraphIssue, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS (+19 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.12
Nodes (5): extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.19
Nodes (8): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), GetHealthUseCase, ManageIntegrationsUseCase, ValidatedIntegrationInput, IntegrationScope

### Community 39 - "route-channel-message.ts"
Cohesion: 0.10
Nodes (18): IncomingIntegrationMessage, IntegrationEgressPort, TriggerRef, ChannelRouterDeps, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, ApprovalCommand (+10 more)

### Community 42 - "IntegrationValidationError"
Cohesion: 0.29
Nodes (5): databaseConfig(), QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.19
Nodes (13): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+5 more)

### Community 44 - "cron.ts"
Cohesion: 0.31
Nodes (6): cronMinuteKey(), FIELD_RANGES, matchesCron(), parseCronField(), parseFieldToken(), WorkflowScheduler

### Community 45 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5, @types/react@^19.0.3, typescript@^5.7.2 (+8 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "ChatPanel.tsx"
Cohesion: 0.16
Nodes (13): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+5 more)

### Community 50 - "input.ts"
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 51 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (14): EventBus, WorkspacePort, ExecutorDeps, captureCodeBundle(), ChatWithProjectUseCase, CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase (+6 more)

### Community 52 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 53 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 55 - "web/src/api.ts"
Cohesion: 0.12
Nodes (16): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+8 more)

### Community 56 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 57 - "execute-workflow.ts"
Cohesion: 0.17
Nodes (11): ExecuteRunInput, executeTransform(), RunState, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, renderParams() (+3 more)

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "app.ts"
Cohesion: 0.12
Nodes (8): AppConfig, AppEnv, Application, buildGroundedContext(), createLogger(), logEntries, testLogger, server

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.33
Nodes (5): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.33
Nodes (7): requiredSecretRefs(), validateIntegrationInput(), manager, useCase(), CreateIntegrationInputSchema, defaultCapabilities(), parseIntegrationConfig()

### Community 68 - "knowledge.test.ts"
Cohesion: 0.08
Nodes (23): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, IngestKnowledgeUseCase, chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText() (+15 more)

### Community 71 - "input-contract.test.ts"
Cohesion: 0.16
Nodes (5): Metrics, MetricsSnapshot, InMemoryMetrics, dirs, logger

### Community 72 - "Store"
Cohesion: 0.10
Nodes (19): AgentRuntimePort, AgentSessionRef, ExternalDatabaseAdapter, SecretVault, Store, OPENCODE_GO_PROVIDER_ID, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult (+11 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 75 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.20
Nodes (8): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteWorkflowRunUseCase, parseAndValidateAgentOutput(), nextEdge(), validateInputPayload(), WorkflowInputValidationError

### Community 76 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "entities.ts"
Cohesion: 0.17
Nodes (3): ErrorEventRepository, DeliveryStatus, ErrorEventRecord

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - ".executeStatements"
Cohesion: 0.32
Nodes (3): classifySql(), DatabaseActionValidationError, ExecuteDatabaseActionUseCase

### Community 84 - "EmbeddingPort"
Cohesion: 0.19
Nodes (8): EmbeddingPort, KnowledgeSearchResult, SearchKnowledgeUseCase, cosineSimilarity(), createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 88 - "web/package.json"
Cohesion: 0.17
Nodes (11): @sentry/react@^9.0.0, jsdom@^25.0.1, @types/react-dom@^19.0.2, vite@^6.0.7, name, type, version, jsdom (+3 more)

### Community 89 - "ProjectsPage"
Cohesion: 0.18
Nodes (7): kindLabel(), ProjectResourcesPanel(), formatDate(), ProjectsPage(), onNameChange(), slugify(), friendlyError()

### Community 90 - "agents.ts"
Cohesion: 0.17
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "migrate.ts"
Cohesion: 0.33
Nodes (7): openDatabase(), addColumnIfMissing(), columnsOf(), migrate(), SQLITE_DDL, tableExists(), now

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 94 - "WorkflowVersionRecord"
Cohesion: 0.22
Nodes (3): WorkflowVersionRepository, WorkflowVersionRecord, parse()

### Community 97 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 703 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `auth-routes.ts`, `ref_node_fs`, `agents.test.ts`, `chat.ts`, `store.ts`, `server/package.json`, `sqlite-store.ts`, `SafeFsWorkspaceAdapter`, `shared/src/index.ts`, `ref_bun_test`, `route-channel-message.ts`, `SseEvent`, `IntegrationValidationError`, `cron.ts`, `shared/src/index.ts`, `execute-workflow.ts`, `IntegrationManager`, `app.ts`, `worker-pool.test.ts`, `knowledge.test.ts`, `input-contract.test.ts`, `Store`, `ExecuteWorkflowRunUseCase`, `.executeStatements`, `EmbeddingPort`, `AlertService`, `server/src/index.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11612903225806452 - nodes in this community are weakly interconnected._
- **Why does `WorkflowCanvasProps` connect `WorkflowCanvas` to `NodeInspectorModal.tsx`, `WorkflowCanvas.tsx`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Why does `SqliteStore` connect `ref_node_fs` to `auth-routes.ts`, `store.ts`, `graph.ts`, `sqlite-store.ts`, `SafeFsWorkspaceAdapter`, `shared/src/index.ts`, `ChatThreadRecord`, `legacy-migration.ts`, `ref_bun_test`, `createApplication`, `execute-workflow.ts`, `app.ts`, `WorkflowScheduleStateRecord`, `validation.ts`, `knowledge.test.ts`, `WorkflowDeliveryRecord`, `input-contract.test.ts`, `Store`, `migrate.ts`, `WorkflowVersionRecord`, `EntityScope`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._