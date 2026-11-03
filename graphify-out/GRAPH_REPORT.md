# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 205 files · ~233,239 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1926 nodes · 4883 edges · 103 communities (79 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 152 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d7587530`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- ref_node_fs
- agents.test.ts
- Modal
- App.tsx
- WhatsAppCloudTransport
- ui.ts
- chat.ts
- entities.ts
- graph.ts
- server/package.json
- ref_bun_test
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- WorkflowRunRecord
- workflow.ts
- SafeFsWorkspaceAdapter
- WorkflowCanvas.tsx
- IntegrationRecord
- graph-edits.ts
- environment
- IntegrationRecord
- ChatThreadRecord
- web/tsconfig.json
- scripts
- WorkflowCanvas
- ProjectPage
- legacy-migration.ts
- .runGraph
- dependencies
- steps
- NodeInspector.tsx
- opencode-adapter.ts
- shared/src/api.ts
- opencode-plugin/package.json
- createApplication
- route-channel-message.ts
- alerts.test.ts
- contracts.test.ts
- IntegrationValidationError
- execute-workflow.test.ts
- cron.ts
- devDependencies
- artifacts
- compilerOptions
- ChatPanel.tsx
- dynamic-adapter.ts
- input.ts
- shared/src/index.ts
- shared/src/index.ts
- src/events.ts
- OpenCodeV2Adapter
- web/src/api.ts
- shared/src/api.ts
- execute-workflow.ts
- NotebookRecord
- IntegrationManager
- shared/package.json
- server/package.json
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
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- NoopErrorTracker
- SettingsRepository
- AgentModelInfo
- server/tsconfig.json
- .executeStatements
- EmbeddingPort
- scripts
- worker-entry.ts
- scripts
- ChatMessageRecord
- dynamic-adapter.ts
- ErrorBoundary
- opencode-plugin/tsconfig.json
- knowledge.test.ts
- shared/tsconfig.json
- WorkflowVersionRecord
- AlertService
- opencode-adapter.test.ts
- server/src/index.ts
- pg
- FakeEgress
- FakeEvents
- SqliteStore

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 124 edges
2. `Store` - 55 edges
3. `SqliteStore` - 49 edges
4. `Logger` - 44 edges
5. `WorkspacePort` - 42 edges
6. `IntegrationRecord` - 41 edges
7. `AgentRuntimePort` - 40 edges
8. `SafeFsWorkspaceAdapter` - 40 edges
9. `ProjectPage()` - 39 edges
10. `react` - 34 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ProjectSettingsView` --references--> `IntegrationRecord`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationKind`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (103 total, 24 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.17
Nodes (7): LogBindings, redact(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, sanitizeSentryEvent(), SentryErrorTracker

### Community 1 - "HttpPlatformClient"
Cohesion: 0.06
Nodes (16): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, HttpPlatformClient, objectSchema(), PlatformClient, PlatformClientScope (+8 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, UserRecord, assertPasswordPolicy() (+17 more)

### Community 3 - "ref_node_fs"
Cohesion: 0.11
Nodes (15): BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing(), createLogger() (+7 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.08
Nodes (22): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+14 more)

### Community 5 - "Modal"
Cohesion: 0.10
Nodes (14): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal(), ProjectTopBar() (+6 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.09
Nodes (46): api, AgentFormState, AgentMode, ControlChannelsPanel(), KINDS, ModalSize, SIZE_CLASS, KIND_OPTIONS (+38 more)

### Community 9 - "chat.ts"
Cohesion: 0.09
Nodes (24): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+16 more)

### Community 10 - "entities.ts"
Cohesion: 0.10
Nodes (8): ErrorEventRepository, ProjectRepository, ProjectReadinessItem, ProjectSettingsView, readinessFor(), DeliveryStatus, ErrorEventRecord, ProjectRecord

### Community 11 - "graph.ts"
Cohesion: 0.27
Nodes (9): isValidCronExpression(), computePayloadHash(), IdempotencyMismatchError, reachableFrom(), stableStringify(), startNode(), topologicalOrder(), validateWorkflowGraph() (+1 more)

### Community 12 - "server/package.json"
Cohesion: 0.09
Nodes (30): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+22 more)

### Community 13 - "ref_bun_test"
Cohesion: 0.11
Nodes (12): GetProjectSettingsUseCase, UpdateProjectSettingsUseCase, PROJECT_ISOLATION_PERMISSIONS, dirs, silentLogger, trigger, cleanups, fakeManager (+4 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.15
Nodes (16): apiMock, primary, renderCatalog(), subagent, renderLayout(), apiMock, graph, renderPage() (+8 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.14
Nodes (22): AppDatabase, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects (+14 more)

### Community 17 - "WorkflowRunRecord"
Cohesion: 0.19
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (39): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+31 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.20
Nodes (6): SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), workspace()

### Community 20 - "WorkflowCanvas.tsx"
Cohesion: 0.07
Nodes (36): @xyflow/react@^12.3.6, NodePaletteModal(), ShapePreview(), CanvasActions, CanvasActionsContext, useCanvasActions(), NODE_CATALOG, NODE_CATEGORY_COLORS (+28 more)

### Community 21 - "IntegrationRecord"
Cohesion: 0.07
Nodes (12): IntegrationEgressPort, IntegrationTransport, ChannelRouterDeps, Logger, ManagedIntegration, IntegrationEgressRouter, TelegramChannelAdapter, TelegramTransport (+4 more)

### Community 22 - "graph-edits.ts"
Cohesion: 0.12
Nodes (26): ModelInfo, changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), GraphIssue (+18 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.16
Nodes (3): IntegrationManagerPort, IntegrationRepository, IntegrationRecord

### Community 25 - "ChatThreadRecord"
Cohesion: 0.17
Nodes (5): ChatThreadRepository, VaultRepository, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "WorkflowCanvas"
Cohesion: 0.12
Nodes (9): subtitle(), toEdges(), toNodes(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange() (+1 more)

### Community 29 - "ProjectPage"
Cohesion: 0.13
Nodes (20): ProjectKnowledgePanel(), kindLabel(), ProjectResourcesPanel(), ProjectSettingsPanel(), previewValue(), ProjectPage(), addNode(), changeEdgeCondition() (+12 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.11
Nodes (23): [databasePath, mappingPath, backupPath], mapping, sqlite, openDatabase(), channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable() (+15 more)

### Community 31 - ".runGraph"
Cohesion: 0.08
Nodes (14): ChatWithOrchestratorUseCase, OrchestratorConfigurationError, resolveOrchestratorModel(), ChatWithProjectUseCase, createAgentRuntime(), FakeAgentRuntime, dirs, FakeEgress (+6 more)

### Community 32 - "dependencies"
Cohesion: 0.11
Nodes (23): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+15 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspector.tsx"
Cohesion: 0.16
Nodes (8): CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), InputFieldsEditor(), NodeInspector(), ValidateRulesEditor()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.18
Nodes (9): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), GetHealthUseCase, ManageIntegrationsUseCase, ValidatedIntegrationInput, useCase() (+1 more)

### Community 39 - "route-channel-message.ts"
Cohesion: 0.16
Nodes (14): IncomingIntegrationMessage, TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand() (+6 more)

### Community 40 - "alerts.test.ts"
Cohesion: 0.19
Nodes (4): SseHub, FakeEgress, logger, SseEvent

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (4): databaseConfig(), TestDatabaseIntegrationUseCase, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "execute-workflow.test.ts"
Cohesion: 0.29
Nodes (3): RunInFlightError, dirs, silentLogger

### Community 44 - "cron.ts"
Cohesion: 0.31
Nodes (6): cronMinuteKey(), FIELD_RANGES, matchesCron(), parseCronField(), parseFieldToken(), WorkflowScheduler

### Community 45 - "devDependencies"
Cohesion: 0.05
Nodes (26): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/jest-dom@^6.6.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5 (+18 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "ChatPanel.tsx"
Cohesion: 0.18
Nodes (12): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+4 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.39
Nodes (5): ExternalDatabaseStatement, ExternalDatabaseStatementResult, ExternalDbConfig, DynamicDatabaseClientAdapter, withTimeout()

### Community 50 - "input.ts"
Cohesion: 0.17
Nodes (12): parseAndValidateAgentOutput(), captureCodeBundle(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError (+4 more)

### Community 51 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (9): EventBus, WorkspacePort, CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), computeGraphHash() (+1 more)

### Community 52 - "shared/src/index.ts"
Cohesion: 0.12
Nodes (14): AgentRuntimePort, AgentSessionRef, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), ExecutorDeps, deliverWebhook() (+6 more)

### Community 53 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 55 - "web/src/api.ts"
Cohesion: 0.15
Nodes (15): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+7 more)

### Community 56 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 57 - "execute-workflow.ts"
Cohesion: 0.19
Nodes (10): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), renderParams(), renderTemplate(), resolvePath() (+2 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "server/package.json"
Cohesion: 0.22
Nodes (9): devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript, @types/mssql (+1 more)

### Community 62 - "app.ts"
Cohesion: 0.10
Nodes (10): AppConfig, AppEnv, Application, ConnectProviderUseCase, QueryDatabaseIntegrationUseCase, BunPasswordHasher, logEntries, testLogger (+2 more)

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.29
Nodes (9): IntegrationCommand, IntegrationUpdateCommand, requiredSecretRefs(), validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), IntegrationCapability, IntegrationKind (+1 more)

### Community 68 - "knowledge.test.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 71 - "input-contract.test.ts"
Cohesion: 0.22
Nodes (4): MetricsSnapshot, InMemoryMetrics, dirs, logger

### Community 72 - "Store"
Cohesion: 0.15
Nodes (13): ExternalDatabaseAdapter, SecretVault, Store, OPENCODE_GO_PROVIDER_ID, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, SqlStatementKind, ChannelAuthError (+5 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 76 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, dev, migrate:legacy, start, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 89 - "dynamic-adapter.ts"
Cohesion: 0.33
Nodes (3): isReadStatement(), sanitizeDatabaseError(), sqliteStatement()

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 96 - "opencode-adapter.test.ts"
Cohesion: 0.40
Nodes (3): extractAssistantText(), OpenCodeClientLike, adapterWith()

### Community 102 - "SqliteStore"
Cohesion: 0.16
Nodes (8): ExecuteDatabaseActionUseCase, DatabaseHandle, createStore(), parse(), SqliteStore, dirs, integration(), setup()

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 706 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `auth-routes.ts`, `ref_node_fs`, `agents.test.ts`, `chat.ts`, `entities.ts`, `ref_bun_test`, `SafeFsWorkspaceAdapter`, `IntegrationRecord`, `.runGraph`, `route-channel-message.ts`, `alerts.test.ts`, `IntegrationValidationError`, `cron.ts`, `dynamic-adapter.ts`, `input.ts`, `shared/src/index.ts`, `shared/src/index.ts`, `NotebookRecord`, `IntegrationManager`, `app.ts`, `worker-pool.test.ts`, `knowledge.test.ts`, `input-contract.test.ts`, `Store`, `ExecuteWorkflowRunUseCase`, `search-knowledge.ts`, `NoopErrorTracker`, `EmbeddingPort`, `ChatMessageRecord`, `AlertService`, `.execute`, `server/src/index.ts`, `SqliteStore`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `HttpPlatformClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05547785547785548 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `shared/src/index.ts` to `FakeAgent`, `.execute`, `opencode-adapter.ts`, `agents.test.ts`, `shared/src/api.ts`, `FakeRuntime`, `route-channel-message.ts`, `Store`, `input-contract.test.ts`, `execute-workflow.test.ts`, `shared/src/index.ts`, `IntegrationRecord`, `OpenCodeV2Adapter`, `execute-workflow.ts`, `app.ts`, `.runGraph`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07811447811447811 - nodes in this community are weakly interconnected._
- **Should `ref_node_fs` be split into smaller, more focused modules?**
  _Cohesion score 0.10752688172043011 - nodes in this community are weakly interconnected._