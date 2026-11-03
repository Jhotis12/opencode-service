# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 203 files · ~230,570 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1884 nodes · 4764 edges · 100 communities (82 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8692a096`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- ref_bun_test
- agents.test.ts
- ProjectPage.tsx
- App.tsx
- WhatsAppCloudTransport
- ui.ts
- chat.ts
- ProjectRecord
- execute-workflow.test.ts
- dependencies
- devDependencies
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- entities.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- PlatformNode.tsx
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
- NodeInspectorModal.tsx
- opencode-adapter.ts
- shared/src/api.ts
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- route-channel-message.ts
- input.ts
- contracts.test.ts
- IntegrationValidationError
- WorkflowCanvas.tsx
- createApplication
- setup.ts
- artifacts
- compilerOptions
- ChatPanel.tsx
- dynamic-adapter.ts
- input.ts
- shared/src/index.ts
- AgentRuntimePort
- contracts.test.ts
- OpenCodeV2Adapter
- web/src/api.ts
- shared/src/api.ts
- .execute
- NotebookRecord
- IntegrationManager
- shared/package.json
- server/package.json
- app.http.test.ts
- WorkflowScheduleStateRecord
- FakeAgent
- agents.ts
- KbSourceRecord
- validation.ts
- knowledge.test.ts
- WorkflowDeliveryRecord
- FakeRuntime
- PlatformClient
- .execute
- telemetry.ts
- createAgentRuntime
- vite.config.ts
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- IntegrationManagerPort
- SettingsRepository
- AgentModelInfo
- server/tsconfig.json
- web/package.json
- EmbeddingPort
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- main.tsx
- opencode-plugin/tsconfig.json
- knowledge.test.ts
- shared/tsconfig.json
- WorkflowVersionRecord
- extractDocx
- extractPdf
- SqliteStore
- mssql
- mysql2

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 53 edges
3. `SqliteStore` - 47 edges
4. `Logger` - 44 edges
5. `WorkspacePort` - 42 edges
6. `IntegrationRecord` - 40 edges
7. `SafeFsWorkspaceAdapter` - 40 edges
8. `AgentRuntimePort` - 40 edges
9. `ProjectPage()` - 39 edges
10. `WorkflowGraph` - 35 edges

## Surprising Connections (you probably didn't know these)
- `ExecuteRunInput` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → packages/shared/src/workflow.ts
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `ProjectSettingsView` --references--> `IntegrationRecord`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (100 total, 18 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.11
Nodes (10): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, NoopErrorTracker (+2 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.06
Nodes (34): integrationError(), PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, BootstrapResult (+26 more)

### Community 3 - "ref_bun_test"
Cohesion: 0.09
Nodes (18): Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, PROJECT_ISOLATION_PERMISSIONS, dirs, cleanups, fakeManager, setup() (+10 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (29): RunRecord, AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode (+21 more)

### Community 6 - "App.tsx"
Cohesion: 0.11
Nodes (28): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+20 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.12
Nodes (30): api, ControlChannelsPanel(), KINDS, KIND_OPTIONS, kindLabel(), ProjectResourcesPanel(), ProjectSettingsPanel(), StatusBadge() (+22 more)

### Community 9 - "chat.ts"
Cohesion: 0.09
Nodes (23): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+15 more)

### Community 10 - "ProjectRecord"
Cohesion: 0.24
Nodes (4): ProjectRepository, ProjectSettingsView, UpdateProjectSettingsUseCase, ProjectRecord

### Community 11 - "execute-workflow.test.ts"
Cohesion: 0.11
Nodes (28): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), ExecuteWorkflowRunUseCase, renderTemplate(), resolvePath() (+20 more)

### Community 12 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, @opencode/client@^2.2.5, pg@^8.13.1, pino@^9.6.0, @platform/shared@workspace:* (+9 more)

### Community 13 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^25.0.1, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/react@^19.0.3, @types/react-dom@^19.0.2, typescript@^5.7.2, vite@^6.0.7 (+6 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.16
Nodes (15): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+7 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.12
Nodes (25): AppDatabase, DatabaseHandle, openDatabase(), chatMessages, chatThreads, integrations, kbChunks, kbSources (+17 more)

### Community 17 - "entities.ts"
Cohesion: 0.07
Nodes (8): ChatRepository, ErrorEventRepository, WorkflowRunRepository, ApprovalRecord, ChatMessageRecord, DeliveryStatus, ErrorEventRecord, StepRunRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (39): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+31 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.09
Nodes (16): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, InMemoryMetrics, BunWorkerPoolAdapter, RpcMessage, SafeFsWorkspaceAdapter, WorkspaceError (+8 more)

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.13
Nodes (18): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+10 more)

### Community 21 - "IntegrationRecord"
Cohesion: 0.06
Nodes (17): IntegrationEgressPort, IntegrationTransport, EventBus, ProjectReadinessItem, ChannelRouterDeps, ManagedIntegration, IntegrationEgressRouter, GrammyTransport (+9 more)

### Community 22 - "graph-edits.ts"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.27
Nodes (3): IntegrationRepository, hashIntegrationKey(), IntegrationRecord

### Community 25 - "ChatThreadRecord"
Cohesion: 0.15
Nodes (5): ChatThreadRepository, VaultRepository, ChatThreadRecord, EntityScope, VaultSecretRecord

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
Cohesion: 0.12
Nodes (21): [databasePath, mappingPath, backupPath], mapping, sqlite, channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn() (+13 more)

### Community 31 - ".runGraph"
Cohesion: 0.08
Nodes (13): ChatWithOrchestratorUseCase, OrchestratorConfigurationError, FakeAgentRuntime, dirs, silentLogger, trigger, dirs, FakeEgress (+5 more)

### Community 32 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+9 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspectorModal.tsx"
Cohesion: 0.10
Nodes (24): ModelInfo, StepRun, GraphIssue, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, InputFieldsEditor() (+16 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.12
Nodes (5): extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 39 - "route-channel-message.ts"
Cohesion: 0.16
Nodes (14): IncomingIntegrationMessage, TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand() (+6 more)

### Community 40 - "input.ts"
Cohesion: 0.11
Nodes (8): AlertService, redact(), ExecutorDeps, Metrics, MetricsSnapshot, SECRET_KEY_PATTERN, FakeEgress, logger

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "WorkflowCanvas.tsx"
Cohesion: 0.16
Nodes (13): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, edgeTypes, EMPTY_ISSUES (+5 more)

### Community 44 - "createApplication"
Cohesion: 0.14
Nodes (7): createApplication(), resolveProjectRouteTool(), safeEqual(), cronMinuteKey(), WorkflowScheduler, port, server

### Community 45 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

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
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "shared/src/index.ts"
Cohesion: 0.10
Nodes (17): AppEnv, AgentSessionRef, WorkspacePort, ChannelAuthError, GetHealthUseCase, GetProjectSettingsUseCase, readinessFor(), captureCodeBundle() (+9 more)

### Community 52 - "AgentRuntimePort"
Cohesion: 0.07
Nodes (18): AppConfig, AgentRuntimePort, ExternalDatabaseAdapter, SecretVault, Store, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError() (+10 more)

### Community 53 - "contracts.test.ts"
Cohesion: 0.18
Nodes (14): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+6 more)

### Community 55 - "web/src/api.ts"
Cohesion: 0.17
Nodes (13): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+5 more)

### Community 56 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 59 - "IntegrationManager"
Cohesion: 0.17
Nodes (3): deliverWebhook(), signWebhook(), IntegrationManager

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "server/package.json"
Cohesion: 0.17
Nodes (14): @sentry/bun@^9.0.0, devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript (+6 more)

### Community 62 - "app.http.test.ts"
Cohesion: 0.29
Nodes (3): Application, logEntries, testLogger

### Community 65 - "agents.ts"
Cohesion: 0.17
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.23
Nodes (13): IntegrationCommand, IntegrationUpdateCommand, assertIntegrationInScope(), requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), manager, useCase() (+5 more)

### Community 68 - "knowledge.test.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 72 - ".execute"
Cohesion: 0.70
Nodes (3): SendExternalChatMessageUseCase, verifyIntegrationKey(), createExternalChatRoutes()

### Community 73 - "telemetry.ts"
Cohesion: 0.11
Nodes (17): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointType, EntryPointTypeSchema, ErrorEvent (+9 more)

### Community 74 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 75 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

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

### Community 83 - "web/package.json"
Cohesion: 0.20
Nodes (9): @platform/shared@workspace:*, tailwindcss@^4.3.3, @types/qrcode@^1.5.5, @platform/shared, name, type, version, tailwindcss (+1 more)

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

### Community 89 - "ProjectsPage"
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

### Community 90 - "main.tsx"
Cohesion: 0.24
Nodes (4): ErrorBoundary, queryClient, react-dom, @sentry/react

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 100 - "extractDocx"
Cohesion: 0.67
Nodes (3): mammoth@^1.9.0, extractDocx(), mammoth

### Community 101 - "extractPdf"
Cohesion: 0.67
Nodes (3): unpdf@^0.12.1, extractPdf(), unpdf

### Community 102 - "SqliteStore"
Cohesion: 0.21
Nodes (3): createStore(), parse(), SqliteStore

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 691 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `auth-routes.ts`, `ref_bun_test`, `agents.test.ts`, `chat.ts`, `ProjectRecord`, `execute-workflow.test.ts`, `entities.ts`, `SafeFsWorkspaceAdapter`, `IntegrationRecord`, `IntegrationRecord`, `.runGraph`, `ManageIntegrationsUseCase`, `route-channel-message.ts`, `input.ts`, `IntegrationValidationError`, `dynamic-adapter.ts`, `shared/src/index.ts`, `AgentRuntimePort`, `contracts.test.ts`, `NotebookRecord`, `IntegrationManager`, `app.http.test.ts`, `knowledge.test.ts`, `.execute`, `createAgentRuntime`, `search-knowledge.ts`, `EmbeddingPort`, `SqliteStore`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `FakeAgent`, `opencode-adapter.ts`, `agents.test.ts`, `ref_bun_test`, `FakeRuntime`, `route-channel-message.ts`, `input.ts`, `shared/src/api.ts`, `execute-workflow.test.ts`, `shared/src/index.ts`, `IntegrationRecord`, `OpenCodeV2Adapter`, `.runGraph`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.058385093167701865 - nodes in this community are weakly interconnected._
- **Why does `WorkflowGraph` connect `shared/src/index.ts` to `NodeInspectorModal.tsx`, `ref_bun_test`, `ProjectPage.tsx`, `App.tsx`, `execute-workflow.test.ts`, `ui.test.tsx`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `IntegrationRecord`, `graph-edits.ts`, `web/src/api.ts`, `app.http.test.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._