# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 197 files · ~207,433 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1798 nodes · 4641 edges · 101 communities (83 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e71a148b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- input-contract.test.ts
- agents.test.ts
- NodeInspectorModal.tsx
- App.tsx
- WhatsAppCloudTransport
- ui.ts
- AgentRuntimePort
- WorkflowGraph
- extractors.ts
- dependencies
- ProjectPage.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- app.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- PlatformNode.tsx
- Logger
- ProjectPage
- environment
- IntegrationRecord
- ChatThreadRecord
- web/tsconfig.json
- scripts
- WorkflowCanvas
- channel-router.test.ts
- NotebookRecord
- execute-workflow.test.ts
- devDependencies
- steps
- ref_bun_test
- opencode-adapter.ts
- graph-edits.ts
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- GrammyTransport
- WorkflowCanvas.tsx
- AgentCatalog.tsx
- IntegrationValidationError
- entities.ts
- dependencies
- setup.ts
- artifacts
- compilerOptions
- legacy-migration.ts
- dynamic-adapter.ts
- execute-workflow.ts
- OpenCodeV2Adapter
- SqliteStore
- ChatPanel.tsx
- chat.ts
- WorkflowVersionRecord
- FakeAgentRuntime
- input.ts
- web/package.json
- IntegrationManager
- shared/package.json
- agents.ts
- validation.ts
- InMemoryMetrics
- FakeAgent
- shared/src/api.ts
- KbSourceRecord
- web/src/api.ts
- knowledge.test.ts
- createApplication
- FakeRuntime
- FakeAgent
- external-chat.test.ts
- telemetry.ts
- RouteProjectIntegrationMessageUseCase
- EmbeddingPort
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- IntegrationManagerPort
- contracts.test.ts
- server/package.json
- server/tsconfig.json
- app.http.test.ts
- FakeTelegram
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- createAgentRuntime
- opencode-plugin/tsconfig.json
- AgentModelInfo
- shared/tsconfig.json
- SettingsRepository
- server/src/index.ts
- extractDocx
- extractPdf
- mssql
- mysql2
- FakeEgress

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 123 edges
2. `Store` - 53 edges
3. `IntegrationRecord` - 44 edges
4. `SqliteStore` - 43 edges
5. `WorkflowGraph` - 43 edges
6. `WorkspacePort` - 42 edges
7. `Logger` - 42 edges
8. `AgentRuntimePort` - 40 edges
9. `SafeFsWorkspaceAdapter` - 40 edges
10. `ProjectPage()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `createApplication()` --calls--> `evaluateToolPermission()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/agents.ts
- `createApplication()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/api.ts
- `ExecuteRunInput` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → packages/shared/src/workflow.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `IntegrationUpdateCommand` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (101 total, 18 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.14
Nodes (9): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, sanitizeSentryEvent() (+1 more)

### Community 1 - "HttpPlatformClient"
Cohesion: 0.06
Nodes (15): setup(), agentSegment, createPlatformTools(), HttpPlatformClient, objectSchema(), PlatformClient, PlatformClientScope, PlatformTool (+7 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.06
Nodes (34): integrationError(), PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, BootstrapResult (+26 more)

### Community 3 - "input-contract.test.ts"
Cohesion: 0.11
Nodes (10): PROJECT_ISOLATION_PERMISSIONS, dirs, FakeEgress, logger, dirs, logger, dirs, dirs (+2 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "NodeInspectorModal.tsx"
Cohesion: 0.11
Nodes (22): ModelInfo, GraphIssue, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, InputFieldsEditor(), NodeInspector() (+14 more)

### Community 6 - "App.tsx"
Cohesion: 0.09
Nodes (28): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+20 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.17
Nodes (25): api, AgentFormState, AgentMode, KINDS, KIND_OPTIONS, ModalKey, qk, badge (+17 more)

### Community 9 - "AgentRuntimePort"
Cohesion: 0.09
Nodes (10): AgentRuntimePort, ChatRepository, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), ChatWithOrchestratorUseCase, OrchestratorOverview (+2 more)

### Community 10 - "WorkflowGraph"
Cohesion: 0.08
Nodes (12): ProjectRepository, WorkspacePort, GetProjectSettingsUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, captureCodeBundle() (+4 more)

### Community 11 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 12 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, @opencode/client@^2.2.5, pg@^8.13.1, pino@^9.6.0, @platform/shared@workspace:* (+9 more)

### Community 13 - "ProjectPage.tsx"
Cohesion: 0.14
Nodes (16): RunRecord, ProjectSettingsPanel(), ProjectTab, ProjectTopBar(), TABS, formatValue(), previewValue(), RunDetailModal() (+8 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (27): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+19 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.15
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.15
Nodes (20): AppDatabase, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects (+12 more)

### Community 17 - "app.ts"
Cohesion: 0.14
Nodes (18): AppEnv, AgentSessionRef, ExternalDatabaseAdapter, SecretVault, Store, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase (+10 more)

### Community 18 - "workflow.ts"
Cohesion: 0.11
Nodes (17): AgentNodeConfig, EdgeSchema, InputFieldSchema, InputFieldType, InputFieldTypeSchema, InputSchemaSchema, NodeTypeSchema, RunProvenance (+9 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.23
Nodes (5): SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), workspace()

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.14
Nodes (19): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+11 more)

### Community 21 - "Logger"
Cohesion: 0.06
Nodes (25): AppConfig, IntegrationEgressPort, IntegrationTransport, TriggerRef, EventBus, ChannelRouterDeps, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase (+17 more)

### Community 22 - "ProjectPage"
Cohesion: 0.21
Nodes (16): ProjectKnowledgePanel(), ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge() (+8 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (21): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN (+13 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.29
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

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
Cohesion: 0.13
Nodes (8): resolveConnection(), toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 29 - "channel-router.test.ts"
Cohesion: 0.23
Nodes (10): ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist(), dirs, silentLogger (+2 more)

### Community 30 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 31 - "execute-workflow.test.ts"
Cohesion: 0.16
Nodes (16): FIELD_RANGES, isValidCronExpression(), matchesCron(), parseCronField(), parseFieldToken(), computePayloadHash(), IdempotencyMismatchError, reachableFrom() (+8 more)

### Community 32 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5, @types/react@^19.0.3, typescript@^5.7.2 (+8 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "ref_bun_test"
Cohesion: 0.14
Nodes (9): Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, dirs, dirs, logger, manager, dirs (+1 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.12
Nodes (5): extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 36 - "graph-edits.ts"
Cohesion: 0.20
Nodes (13): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+5 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "ManageIntegrationsUseCase"
Cohesion: 0.29
Nodes (4): hashIntegrationKey(), ManageIntegrationsUseCase, useCase(), IntegrationScope

### Community 40 - "WorkflowCanvas.tsx"
Cohesion: 0.19
Nodes (13): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, edgeTypes, EMPTY_ISSUES (+5 more)

### Community 41 - "AgentCatalog.tsx"
Cohesion: 0.16
Nodes (15): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal(), ModalSize (+7 more)

### Community 42 - "IntegrationValidationError"
Cohesion: 0.29
Nodes (4): databaseConfig(), TestDatabaseIntegrationUseCase, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "entities.ts"
Cohesion: 0.09
Nodes (15): ErrorEventRepository, WorkflowRunRepository, buildNodePrompt(), executeHttpNode(), ExecuteRunInput, ExecuteWorkflowRunUseCase, RunState, ApprovalRecord (+7 more)

### Community 44 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+11 more)

### Community 45 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "legacy-migration.ts"
Cohesion: 0.11
Nodes (23): [databasePath, mappingPath, backupPath], mapping, sqlite, openDatabase(), channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable() (+15 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "execute-workflow.ts"
Cohesion: 0.12
Nodes (17): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, evaluateCondition(), executeTransform(), ExecutorDeps, parseAndValidateAgentOutput(), renderTemplate() (+9 more)

### Community 52 - "SqliteStore"
Cohesion: 0.21
Nodes (4): DatabaseHandle, createStore(), parse(), SqliteStore

### Community 53 - "ChatPanel.tsx"
Cohesion: 0.20
Nodes (11): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+3 more)

### Community 54 - "chat.ts"
Cohesion: 0.10
Nodes (19): createChatProgressHandler(), fileText(), RawAgentEvent, toolText(), withTimeout(), ChatMessage, ChatMessageSchema, ChatProgressEvent (+11 more)

### Community 57 - "input.ts"
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 58 - "web/package.json"
Cohesion: 0.17
Nodes (11): @sentry/react@^9.0.0, jsdom@^25.0.1, @types/react-dom@^19.0.2, vite@^6.0.7, name, type, version, jsdom (+3 more)

### Community 59 - "IntegrationManager"
Cohesion: 0.17
Nodes (3): deliverWebhook(), signWebhook(), IntegrationManager

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 62 - "validation.ts"
Cohesion: 0.33
Nodes (9): IntegrationCommand, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), IntegrationCapability, IntegrationKind (+1 more)

### Community 63 - "InMemoryMetrics"
Cohesion: 0.22
Nodes (4): InMemoryMetrics, NoopErrorTracker, setup(), setup()

### Community 65 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "web/src/api.ts"
Cohesion: 0.16
Nodes (14): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+6 more)

### Community 68 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 69 - "createApplication"
Cohesion: 0.14
Nodes (7): createApplication(), resolveProjectRouteTool(), safeEqual(), AlertService, redact(), cronMinuteKey(), WorkflowScheduler

### Community 72 - "external-chat.test.ts"
Cohesion: 0.36
Nodes (6): SendExternalChatMessageUseCase, verifyIntegrationKey(), createExternalChatRoutes(), cleanups, fakeManager, setup()

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (9): ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema, ServiceHealth (+1 more)

### Community 75 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 76 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 80 - "contracts.test.ts"
Cohesion: 0.15
Nodes (14): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, AgentNodeConfigSchema, NodeSpecSchema (+6 more)

### Community 81 - "server/package.json"
Cohesion: 0.17
Nodes (14): @sentry/bun@^9.0.0, devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript (+6 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

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
Cohesion: 0.18
Nodes (7): kindLabel(), ProjectResourcesPanel(), formatDate(), ProjectsPage(), onNameChange(), slugify(), friendlyError()

### Community 90 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 96 - "extractDocx"
Cohesion: 0.67
Nodes (3): mammoth@^1.9.0, extractDocx(), mammoth

### Community 97 - "extractPdf"
Cohesion: 0.67
Nodes (3): unpdf@^0.12.1, extractPdf(), unpdf

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 625 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `WorkflowGraph` to `input-contract.test.ts`, `NodeInspectorModal.tsx`, `ProjectPage.tsx`, `ui.test.tsx`, `sqlite-store.ts`, `app.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `WorkflowCanvas`, `execute-workflow.test.ts`, `graph-edits.ts`, `WorkflowCanvas.tsx`, `AgentCatalog.tsx`, `entities.ts`, `execute-workflow.ts`, `WorkflowVersionRecord`, `InMemoryMetrics`, `web/src/api.ts`, `app.http.test.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `HttpPlatformClient`, `auth-routes.ts`, `input-contract.test.ts`, `agents.test.ts`, `AgentRuntimePort`, `WorkflowGraph`, `extractors.ts`, `app.ts`, `SafeFsWorkspaceAdapter`, `Logger`, `NotebookRecord`, `ref_bun_test`, `ManageIntegrationsUseCase`, `IntegrationValidationError`, `entities.ts`, `dynamic-adapter.ts`, `execute-workflow.ts`, `SqliteStore`, `chat.ts`, `IntegrationManager`, `InMemoryMetrics`, `external-chat.test.ts`, `RouteProjectIntegrationMessageUseCase`, `EmbeddingPort`, `search-knowledge.ts`, `app.http.test.ts`, `createAgentRuntime`, `server/src/index.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `HttpPlatformClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05673076923076923 - nodes in this community are weakly interconnected._
- **Why does `ProjectPage()` connect `ProjectPage` to `graph-edits.ts`, `NodeInspectorModal.tsx`, `App.tsx`, `ui.ts`, `AgentCatalog.tsx`, `ProjectPage.tsx`, `ui.test.tsx`, `PlatformNode.tsx`, `ChatPanel.tsx`, `ProjectsPage`, `WorkflowCanvas`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._