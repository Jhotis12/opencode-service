# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 202 files · ~218,571 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1821 nodes · 4722 edges · 108 communities (81 shown, 27 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `883e065b`
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
- AgentRuntimePort
- ProjectRecord
- execute-workflow.test.ts
- dependencies
- devDependencies
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- execute-workflow.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- PlatformNode.tsx
- route-channel-message.ts
- graph-edits.ts
- environment
- IntegrationRecord
- ChatThreadRecord
- web/tsconfig.json
- scripts
- WorkflowCanvas
- ProjectPage
- legacy-migration.ts
- FakeAgentRuntime
- ChatPanel.tsx
- steps
- bootstrap.ts
- opencode-adapter.ts
- FakeAgent
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- GrammyTransport
- Logger
- AgentCatalog.tsx
- IntegrationValidationError
- WorkflowCanvas.tsx
- WorkflowScheduler
- setup.ts
- artifacts
- compilerOptions
- migrate.ts
- dynamic-adapter.ts
- ExecutorDeps
- WorkflowGraph
- Store
- tools.ts
- chat.ts
- web/src/api.ts
- auth.routes.test.ts
- FakeClient
- NotebookRecord
- IntegrationManager
- shared/package.json
- server/package.json
- app.ts
- EntityScope
- FakeAgent
- shared/src/api.ts
- KbSourceRecord
- validation.ts
- knowledge.test.ts
- AlertService
- FakeRuntime
- PlatformClient
- external-chat.test.ts
- telemetry.ts
- WorkspaceError
- vite.config.ts
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- IntegrationManagerPort
- SettingsRepository
- ControlChannelsPanel
- server/tsconfig.json
- web/package.json
- EmbeddingPort
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- ErrorBoundary
- opencode-plugin/tsconfig.json
- url-safety.ts
- shared/tsconfig.json
- WorkflowVersionRecord
- UserRecord
- SessionCodec
- auth.ts
- InMemoryMetrics
- EventSourceStub
- extractDocx
- extractPdf
- DatabaseHandle
- workspace.test.ts
- mssql
- mysql2
- FakeEgress
- @types/qrcode@^1.5.5

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 53 edges
3. `SqliteStore` - 45 edges
4. `IntegrationRecord` - 44 edges
5. `Logger` - 44 edges
6. `WorkflowGraph` - 43 edges
7. `WorkspacePort` - 42 edges
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
- `IntegrationRecord` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (108 total, 27 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.11
Nodes (10): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, NoopErrorTracker (+2 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.21
Nodes (13): integrationError(), ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, authMiddleware(), AuthVariables, PASSWORD_CHANGE_ALLOWLIST, readUser() (+5 more)

### Community 3 - "input-contract.test.ts"
Cohesion: 0.07
Nodes (17): Application, SqliteStore, logEntries, testLogger, dirs, silentLogger, trigger, dirs (+9 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "ProjectPage.tsx"
Cohesion: 0.08
Nodes (36): RunRecord, GraphIssue, nodeIssues(), Modal(), ModalSize, SIZE_CLASS, conditionLabel(), defaultBranch() (+28 more)

### Community 6 - "App.tsx"
Cohesion: 0.11
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.08
Nodes (5): BaileysTransport, parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.17
Nodes (25): api, AgentFormState, AgentMode, KINDS, KIND_OPTIONS, ModalKey, qk, badge (+17 more)

### Community 9 - "AgentRuntimePort"
Cohesion: 0.13
Nodes (18): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+10 more)

### Community 11 - "execute-workflow.test.ts"
Cohesion: 0.15
Nodes (17): FIELD_RANGES, isValidCronExpression(), matchesCron(), parseCronField(), parseFieldToken(), computePayloadHash(), IdempotencyMismatchError, reachableFrom() (+9 more)

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
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.13
Nodes (20): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, systemErrorEvents (+12 more)

### Community 17 - "execute-workflow.ts"
Cohesion: 0.10
Nodes (20): WorkflowRunRepository, buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), ExecuteWorkflowRunUseCase, parseAndValidateAgentOutput() (+12 more)

### Community 18 - "workflow.ts"
Cohesion: 0.09
Nodes (25): checkField(), NodeValidationError, validateNodeRules(), valueAt(), AgentNodeConfig, EdgeSchema, InputField, InputFieldSchema (+17 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.31
Nodes (5): SafeFsWorkspaceAdapter, setup(), setup(), setup(), setup()

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.16
Nodes (16): ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES, NodeShape (+8 more)

### Community 21 - "route-channel-message.ts"
Cohesion: 0.07
Nodes (23): IncomingIntegrationMessage, IntegrationEgressPort, TriggerRef, EventBus, ChannelRouterDeps, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase (+15 more)

### Community 22 - "graph-edits.ts"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.29
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

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
Cohesion: 0.19
Nodes (17): ProjectKnowledgePanel(), ProjectSettingsPanel(), ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect() (+9 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.22
Nodes (13): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+5 more)

### Community 31 - "FakeAgentRuntime"
Cohesion: 0.13
Nodes (6): ChatWithOrchestratorUseCase, OrchestratorConfigurationError, FakeAgentRuntime, captureLogger(), dirs, setup()

### Community 32 - "ChatPanel.tsx"
Cohesion: 0.07
Nodes (29): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+21 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "bootstrap.ts"
Cohesion: 0.14
Nodes (12): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+4 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.08
Nodes (10): createAgentRuntime(), extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, OpenCodeV2Adapter, ServiceClientFactory (+2 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "ManageIntegrationsUseCase"
Cohesion: 0.25
Nodes (5): createApplication(), resolveProjectRouteTool(), safeEqual(), ManageIntegrationsUseCase, IntegrationScope

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "Logger"
Cohesion: 0.08
Nodes (10): AppConfig, ExecutorDeps, Logger, Metrics, MetricsSnapshot, SECRET_KEY_PATTERN, FakeEgress, logger (+2 more)

### Community 41 - "AgentCatalog.tsx"
Cohesion: 0.29
Nodes (8): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), agentModeLabel(), buttonDangerSolid

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "WorkflowCanvas.tsx"
Cohesion: 0.16
Nodes (15): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), ConnectRole, PlatformFlowNode, PlatformEdge(), PlatformEdgeData, PlatformFlowEdge (+7 more)

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
Cohesion: 0.18
Nodes (12): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), columnsOf(), migrate() (+4 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "ExecutorDeps"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 51 - "WorkflowGraph"
Cohesion: 0.13
Nodes (11): WorkspacePort, captureCodeBundle(), CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), validateWorkflowResources() (+3 more)

### Community 52 - "Store"
Cohesion: 0.10
Nodes (14): AgentModelInfo, AgentRuntimePort, AgentSessionRef, ExternalDatabaseAdapter, SecretVault, Store, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID (+6 more)

### Community 53 - "tools.ts"
Cohesion: 0.18
Nodes (14): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+6 more)

### Community 54 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 55 - "web/src/api.ts"
Cohesion: 0.11
Nodes (21): ApiClientError, chatStream(), HealthPayload, ModelInfo, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView (+13 more)

### Community 56 - "auth.routes.test.ts"
Cohesion: 0.17
Nodes (5): PasswordHasher, RateLimiter, AuthRouteDeps, BunPasswordHasher, buildApp()

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 59 - "IntegrationManager"
Cohesion: 0.18
Nodes (4): deliverWebhook(), signWebhook(), IntegrationManager, WhatsAppChannelAdapter

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "server/package.json"
Cohesion: 0.17
Nodes (14): @sentry/bun@^9.0.0, devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript (+6 more)

### Community 62 - "app.ts"
Cohesion: 0.11
Nodes (16): AppEnv, ChatRepository, ErrorEventRepository, GetHealthUseCase, IntegrationCommand, IntegrationUpdateCommand, GetProjectSettingsUseCase, ProjectReadinessItem (+8 more)

### Community 63 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 65 - "shared/src/api.ts"
Cohesion: 0.08
Nodes (26): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+18 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.31
Nodes (7): assertIntegrationInScope(), requiredSecretRefs(), validateIntegrationInput(), manager, useCase(), CreateIntegrationInputSchema, parseIntegrationConfig()

### Community 68 - "knowledge.test.ts"
Cohesion: 0.11
Nodes (18): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, buildGroundedContext(), chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText() (+10 more)

### Community 69 - "AlertService"
Cohesion: 0.22
Nodes (4): AlertService, redact(), port, server

### Community 72 - "external-chat.test.ts"
Cohesion: 0.27
Nodes (8): SendExternalChatMessageUseCase, hashIntegrationKey(), verifyIntegrationKey(), createExternalChatRoutes(), cleanups, fakeManager, setup(), hono

### Community 73 - "telemetry.ts"
Cohesion: 0.12
Nodes (16): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, ErrorEvent, ErrorEventSchema (+8 more)

### Community 75 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

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
Cohesion: 0.33
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
Cohesion: 0.14
Nodes (9): kindLabel(), ProjectResourcesPanel(), formatDate(), ProjectsPage(), onNameChange(), slugify(), friendlyError(), StatusTone (+1 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "url-safety.ts"
Cohesion: 0.27
Nodes (5): assertSafeUrl(), ipv4Parts(), isPrivateAddress(), Resolver, UnsafeUrlError

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 97 - "auth.ts"
Cohesion: 0.53
Nodes (3): assertPasswordPolicy(), MIN_PASSWORD_LENGTH, PasswordPolicyError

### Community 100 - "extractDocx"
Cohesion: 0.67
Nodes (3): mammoth@^1.9.0, extractDocx(), mammoth

### Community 101 - "extractPdf"
Cohesion: 0.67
Nodes (3): unpdf@^0.12.1, extractPdf(), unpdf

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 633 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `WorkflowGraph` to `input-contract.test.ts`, `ProjectPage.tsx`, `Logger`, `WorkspaceError`, `execute-workflow.test.ts`, `WorkflowCanvas.tsx`, `ui.test.tsx`, `sqlite-store.ts`, `execute-workflow.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `graph-edits.ts`, `web/src/api.ts`, `app.ts`, `WorkflowCanvas`, `WorkflowVersionRecord`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11491935483870967 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `ManageIntegrationsUseCase` to `logger.ts`, `auth-routes.ts`, `input-contract.test.ts`, `agents.test.ts`, `AgentRuntimePort`, `execute-workflow.ts`, `SafeFsWorkspaceAdapter`, `route-channel-message.ts`, `FakeAgentRuntime`, `bootstrap.ts`, `opencode-adapter.ts`, `IntegrationValidationError`, `WorkflowScheduler`, `dynamic-adapter.ts`, `ExecutorDeps`, `WorkflowGraph`, `Store`, `tools.ts`, `auth.routes.test.ts`, `NotebookRecord`, `IntegrationManager`, `app.ts`, `knowledge.test.ts`, `AlertService`, `external-chat.test.ts`, `WorkspaceError`, `search-knowledge.ts`, `EmbeddingPort`, `SessionCodec`, `InMemoryMetrics`, `DatabaseHandle`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `input-contract.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07446808510638298 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ui.test.tsx` to `ProjectPage.tsx`, `App.tsx`, `ui.ts`, `vite.config.ts`, `devDependencies`, `setup.ts`, `web/package.json`, `PlatformNode.tsx`, `graph-edits.ts`, `ProjectsPage`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._