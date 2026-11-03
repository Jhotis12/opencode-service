# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 203 files · ~231,234 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 7, .example 1, .css 1)

## Summary
- 1822 nodes · 4722 edges · 95 communities (80 shown, 15 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9e02fd4e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- input-contract.test.ts
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
- WorkflowRunRecord
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
- ChatPanel.tsx
- steps
- bootstrap.ts
- opencode-adapter.ts
- shared/src/api.ts
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- GrammyTransport
- input.ts
- .prepare
- IntegrationValidationError
- WorkflowCanvas.tsx
- createApplication
- setup.ts
- artifacts
- compilerOptions
- migrate.ts
- dynamic-adapter.ts
- SseEvent
- shared/src/index.ts
- AgentRuntimePort
- contracts.test.ts
- ProjectResourcesPanel
- web/src/api.ts
- server/src/index.ts
- NotebookRecord
- shared/package.json
- server/package.json
- WorkflowGraph
- agents.ts
- KbSourceRecord
- validation.ts
- knowledge.test.ts
- AlertService
- FakeRuntime
- manage-integrations.ts
- telemetry.ts
- vite.config.ts
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- SettingsRepository
- server/tsconfig.json
- web/package.json
- EmbeddingPort
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- opencode-plugin/tsconfig.json
- knowledge.test.ts
- shared/tsconfig.json
- WorkflowVersionRecord
- EventSourceStub
- extractDocx
- extractPdf
- DatabaseHandle
- mssql
- mysql2
- channel-router.test.ts
- @types/qrcode@^1.5.5

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 53 edges
3. `SqliteStore` - 45 edges
4. `IntegrationRecord` - 44 edges
5. `Logger` - 44 edges
6. `WorkflowGraph` - 43 edges
7. `WorkspacePort` - 42 edges
8. `SafeFsWorkspaceAdapter` - 40 edges
9. `AgentRuntimePort` - 40 edges
10. `ProjectPage()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `ExecuteRunInput` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → packages/shared/src/workflow.ts
- `WorkflowRunRecord` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/telemetry.ts
- `WorkflowRunRecord` --references--> `WorkflowRunStatus`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/workflow.ts
- `IntegrationRecord` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts
- `IntegrationRecord` --references--> `IntegrationKind`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (95 total, 15 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.09
Nodes (13): ErrorEventRepository, ErrorEventRecord, ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions (+5 more)

### Community 1 - "HttpPlatformClient"
Cohesion: 0.06
Nodes (16): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, HttpPlatformClient, objectSchema(), PlatformClient, PlatformClientScope (+8 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy(), MIN_PASSWORD_LENGTH (+17 more)

### Community 3 - "input-contract.test.ts"
Cohesion: 0.07
Nodes (27): AppEnv, Application, AgentModelInfo, AgentSessionRef, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, GetProjectSettingsUseCase (+19 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (28): RunRecord, AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode (+20 more)

### Community 6 - "App.tsx"
Cohesion: 0.10
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.13
Nodes (31): api, ControlChannelsPanel(), KINDS, KIND_OPTIONS, ProjectSettingsPanel(), StatusBadge(), OrchestratorPage(), ModalKey (+23 more)

### Community 9 - "chat.ts"
Cohesion: 0.10
Nodes (23): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+15 more)

### Community 11 - "execute-workflow.test.ts"
Cohesion: 0.23
Nodes (12): isValidCronExpression(), matchesCron(), parseCronField(), parseFieldToken(), computePayloadHash(), IdempotencyMismatchError, reachableFrom(), stableStringify() (+4 more)

### Community 12 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, @opencode/client@^2.2.5, pg@^8.13.1, pino@^9.6.0, @platform/shared@workspace:* (+9 more)

### Community 13 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/react@^19.0.3, @types/react-dom@^19.0.2, vitest@^3.2.0 (+4 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (27): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+19 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.15
Nodes (18): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.13
Nodes (20): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, systemErrorEvents (+12 more)

### Community 17 - "WorkflowRunRecord"
Cohesion: 0.15
Nodes (7): WorkflowRunRepository, ExecuteRunInput, RunState, ApprovalRecord, StepRunRecord, WorkflowRunRecord, StepStatus

### Community 18 - "workflow.ts"
Cohesion: 0.11
Nodes (17): AgentNodeConfig, EdgeSchema, InputFieldSchema, InputFieldType, InputFieldTypeSchema, InputSchemaSchema, NodeTypeSchema, RunProvenance (+9 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.05
Nodes (17): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, InMemoryMetrics, BunWorkerPoolAdapter, RpcMessage, SafeFsWorkspaceAdapter, WorkspaceError (+9 more)

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.14
Nodes (19): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+11 more)

### Community 21 - "IntegrationRecord"
Cohesion: 0.06
Nodes (21): AppConfig, IncomingIntegrationMessage, IntegrationEgressPort, deliverWebhook(), signWebhook(), RouteProjectIntegrationMessageUseCase, IntegrationRecord, Logger (+13 more)

### Community 22 - "graph-edits.ts"
Cohesion: 0.20
Nodes (13): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+5 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.15
Nodes (4): IntegrationRepository, VaultRepository, EntityScope, VaultSecretRecord

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "WorkflowCanvas"
Cohesion: 0.13
Nodes (8): resolveConnection(), toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 29 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 31 - ".runGraph"
Cohesion: 0.22
Nodes (8): buildNodePrompt(), evaluateCondition(), executeHttpNode(), executeTransform(), renderTemplate(), resolvePath(), templateValue(), nextEdge()

### Community 32 - "ChatPanel.tsx"
Cohesion: 0.07
Nodes (29): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+21 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "bootstrap.ts"
Cohesion: 0.14
Nodes (11): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+3 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.06
Nodes (11): createAgentRuntime(), FakeAgentRuntime, extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, OpenCodeV2Adapter (+3 more)

### Community 36 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "ManageIntegrationsUseCase"
Cohesion: 0.30
Nodes (4): ManageIntegrationsUseCase, ValidatedIntegrationInput, useCase(), IntegrationScope

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "input.ts"
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 41 - ".prepare"
Cohesion: 0.28
Nodes (4): parseAndValidateAgentOutput(), RunInFlightError, validateInputPayload(), WorkflowInputValidationError

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "WorkflowCanvas.tsx"
Cohesion: 0.19
Nodes (13): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, edgeTypes, EMPTY_ISSUES (+5 more)

### Community 44 - "createApplication"
Cohesion: 0.13
Nodes (7): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), GetHealthUseCase, cronMinuteKey(), WorkflowScheduler

### Community 45 - "setup.ts"
Cohesion: 0.18
Nodes (3): @testing-library/jest-dom@^6.6.3, ResizeObserverStub, @testing-library/jest-dom

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "migrate.ts"
Cohesion: 0.16
Nodes (13): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), columnsOf(), migrate() (+5 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "SseEvent"
Cohesion: 0.32
Nodes (3): SseHub, FakeEvents, SseEvent

### Community 51 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (20): EventBus, Store, WorkspacePort, ExecuteWorkflowRunUseCase, ExecutorDeps, ProjectReadinessItem, ProjectSettingsView, CreateProjectUseCase (+12 more)

### Community 52 - "AgentRuntimePort"
Cohesion: 0.08
Nodes (15): AgentRuntimePort, ChatRepository, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), ChatWithOrchestratorUseCase, EmptyAgentReplyError (+7 more)

### Community 53 - "contracts.test.ts"
Cohesion: 0.15
Nodes (14): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, AgentNodeConfigSchema, NodeSpecSchema (+6 more)

### Community 55 - "web/src/api.ts"
Cohesion: 0.07
Nodes (36): ApiClientError, chatStream(), HealthPayload, ModelInfo, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView (+28 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "server/package.json"
Cohesion: 0.17
Nodes (14): @sentry/bun@^9.0.0, devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript (+6 more)

### Community 62 - "WorkflowGraph"
Cohesion: 0.25
Nodes (5): readinessFor(), captureCodeBundle(), syncProjectsFromDisk(), computeGraphHash(), WorkflowGraph

### Community 65 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.43
Nodes (6): assertIntegrationInScope(), requiredSecretRefs(), validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), parseIntegrationConfig()

### Community 68 - "knowledge.test.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 72 - "manage-integrations.ts"
Cohesion: 0.10
Nodes (18): IntegrationManagerPort, ExternalDatabaseAdapter, SecretVault, ChannelAuthError, SendExternalChatMessageUseCase, hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand (+10 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (9): ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema, ServiceHealth (+1 more)

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
Cohesion: 0.17
Nodes (11): @platform/shared@workspace:*, zod@^3.24.1, typescript@^5.7.2, vite@^6.0.7, @platform/shared, typescript, zod, name (+3 more)

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

### Community 106 - "channel-router.test.ts"
Cohesion: 0.15
Nodes (14): TriggerRef, RouteGlobalIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage() (+6 more)

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 634 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `WorkflowGraph` to `input-contract.test.ts`, `ProjectPage.tsx`, `execute-workflow.test.ts`, `WorkflowCanvas.tsx`, `ui.test.tsx`, `sqlite-store.ts`, `WorkflowRunRecord`, `workflow.ts`, `shared/src/index.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `graph-edits.ts`, `web/src/api.ts`, `WorkflowCanvas`, `WorkflowVersionRecord`, `.runGraph`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `HttpPlatformClient`, `auth-routes.ts`, `input-contract.test.ts`, `agents.test.ts`, `chat.ts`, `ProjectRecord`, `SafeFsWorkspaceAdapter`, `IntegrationRecord`, `.runGraph`, `bootstrap.ts`, `opencode-adapter.ts`, `ManageIntegrationsUseCase`, `.prepare`, `IntegrationValidationError`, `dynamic-adapter.ts`, `SseEvent`, `shared/src/index.ts`, `AgentRuntimePort`, `server/src/index.ts`, `.execute`, `NotebookRecord`, `WorkflowGraph`, `knowledge.test.ts`, `AlertService`, `manage-integrations.ts`, `search-knowledge.ts`, `EmbeddingPort`, `DatabaseHandle`, `channel-router.test.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `HttpPlatformClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05547785547785548 - nodes in this community are weakly interconnected._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._