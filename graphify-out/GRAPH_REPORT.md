# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 214 files · ~249,823 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2011 nodes · 5297 edges · 93 communities (74 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `331f9919`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- ref_bun_test
- agents.test.ts
- bootstrap.ts
- App.tsx
- manage-integrations.ts
- react
- shared/src/index.ts
- IntegrationEgressPort
- IntegrationValidationError
- server/package.json
- NodeInspector.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- search-knowledge.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- ProjectPage
- channel-adapters.test.ts
- FakeRuntime
- environment
- app.ts
- RouteProjectIntegrationMessageUseCase
- web/tsconfig.json
- scripts
- shared/src/api.ts
- web/package.json
- knowledge.test.ts
- chat.ts
- devDependencies
- steps
- web/src/api.ts
- FakeAgentRuntime
- notify-approval.test.ts
- opencode-plugin/package.json
- AgentRuntimePort
- GrammyTransport
- legacy-migration.ts
- validation.ts
- Store
- tools.ts
- WorkflowRunRecord
- WorkflowVersionRecord
- artifacts
- compilerOptions
- Modal
- FakeClient
- input.ts
- EmbeddingPort
- ProjectTopBar.tsx
- SessionContextRecord
- ChatThreadRecord
- legacy-migration.test.ts
- RunQueueRepository
- ProjectRecord
- NotebookRecord
- createApplication
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- IntegrationRecord
- SqliteStore
- KbSourceRecord
- ManageIntegrationsUseCase
- extractors.ts
- WorkflowDeliveryRecord
- agents.ts
- IntegrationManagerPort
- telemetry.ts
- WorkflowTimerRecord
- WorkflowCanvas.tsx
- ErrorBoundary
- entrypoint.sh
- config.yaml
- alerts.test.ts
- FakeWhatsApp
- execute-workflow.ts
- server/tsconfig.json
- WorkflowCanvasProps
- chat-progress.ts
- scripts
- worker-entry.ts
- ProjectResourcesPanel.tsx
- ProjectPage
- server/src/index.ts
- opencode-plugin/tsconfig.json
- shared/tsconfig.json
- CanvasActions

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 132 edges
2. `Store` - 61 edges
3. `SqliteStore` - 56 edges
4. `Logger` - 54 edges
5. `IntegrationRecord` - 47 edges
6. `WorkflowGraph` - 46 edges
7. `WorkspacePort` - 42 edges
8. `SafeFsWorkspaceAdapter` - 42 edges
9. `AgentRuntimePort` - 41 edges
10. `ProjectPage()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `integrationError()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/api.ts
- `createApplication()` --calls--> `evaluateToolPermission()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/agents.ts
- `createApplication()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/api.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `IntegrationUpdateCommand` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (93 total, 19 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.09
Nodes (13): ErrorEventRepository, ErrorEventRecord, ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions (+5 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.07
Nodes (27): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, DEFAULT_ADMIN_PASSWORD, UserRecord, assertPasswordPolicy() (+19 more)

### Community 3 - "ref_bun_test"
Cohesion: 0.08
Nodes (20): Application, PROJECT_ISOLATION_PERMISSIONS, json(), logEntries, testLogger, waitForApproval(), dirs, logger (+12 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "bootstrap.ts"
Cohesion: 0.12
Nodes (15): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing(), ExecuteDatabaseActionUseCase (+7 more)

### Community 6 - "App.tsx"
Cohesion: 0.09
Nodes (28): App(), RequireAuth(), AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark(), initialCollapsed() (+20 more)

### Community 7 - "manage-integrations.ts"
Cohesion: 0.21
Nodes (10): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), createExternalChatRoutes(), cleanups, fakeManager (+2 more)

### Community 8 - "react"
Cohesion: 0.13
Nodes (32): api, AuthContext, AgentFormState, AgentMode, KINDS, ModalSize, SIZE_CLASS, ModalKey (+24 more)

### Community 9 - "shared/src/index.ts"
Cohesion: 0.07
Nodes (24): EventBus, ChatRepository, WorkspacePort, ExecuteRunInput, GetProjectSettingsUseCase, ProjectReadinessItem, readinessFor(), captureCodeBundle() (+16 more)

### Community 10 - "IntegrationEgressPort"
Cohesion: 0.16
Nodes (7): EgressSendResult, IntegrationEgressPort, IntegrationEgressRouter, TelegramChannelAdapter, FakeEgress, RecordingEgress, FakeEgress

### Community 11 - "IntegrationValidationError"
Cohesion: 0.19
Nodes (6): databaseConfig(), TestDatabaseIntegrationUseCase, DatabaseActionValidationError, assertIntegrationInScope(), IntegrationValidationError, databaseAccessPolicy()

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+47 more)

### Community 13 - "NodeInspector.tsx"
Cohesion: 0.15
Nodes (15): ExecuteDatabaseActionInput, @monaco-editor/react@^4.6.0, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS (+7 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, DatabaseAccessPolicy, defaultRouting, EMAIL_CAPABILITIES (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (18): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.14
Nodes (23): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, sessionContexts (+15 more)

### Community 17 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 18 - "workflow.ts"
Cohesion: 0.06
Nodes (32): AgentNodeConfig, DatabaseNodeConfig, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema, InputFieldSchema, InputFieldType (+24 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.06
Nodes (13): InMemoryMetrics, SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), FakeAgent, setup(), TimeoutAgent (+5 more)

### Community 20 - "ProjectPage"
Cohesion: 0.11
Nodes (27): ModelInfo, StepRun, changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues() (+19 more)

### Community 21 - "channel-adapters.test.ts"
Cohesion: 0.10
Nodes (6): BaileysTransport, parseCloudWebhook(), WhatsAppChannelAdapter, WhatsAppCloudTransport, WhatsAppTransport, silentLogger

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "app.ts"
Cohesion: 0.11
Nodes (13): AppEnv, ApprovalDecisionError, DecideApprovalUseCase, GetHealthUseCase, IntegrationUpdateCommand, UpdateProjectSettingsUseCase, SendNotificationInput, SendNotificationResult (+5 more)

### Community 25 - "RouteProjectIntegrationMessageUseCase"
Cohesion: 0.14
Nodes (15): IncomingIntegrationMessage, TriggerRef, RouteProjectIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage() (+7 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.10
Nodes (18): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+10 more)

### Community 29 - "web/package.json"
Cohesion: 0.11
Nodes (22): dependencies, @fontsource-variable/inter@^5.3.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+14 more)

### Community 30 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 31 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 32 - "devDependencies"
Cohesion: 0.05
Nodes (26): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/jest-dom@^6.6.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5 (+18 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "web/src/api.ts"
Cohesion: 0.08
Nodes (30): ApiClientError, ApprovalRecord, ChatHistoryMessage, chatStream(), DeliveryRecord, HealthPayload, NotebookSummary, OrchestratorOverview (+22 more)

### Community 35 - "FakeAgentRuntime"
Cohesion: 0.05
Nodes (11): createAgentRuntime(), FakeAgentRuntime, extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, OpenCodeV2Adapter (+3 more)

### Community 36 - "notify-approval.test.ts"
Cohesion: 0.39
Nodes (5): NotifyApprovalUseCase, FakeEgress, integration(), logger(), setup()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "AgentRuntimePort"
Cohesion: 0.11
Nodes (14): AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), ChatWithOrchestratorUseCase, EmptyAgentReplyError (+6 more)

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 41 - "validation.ts"
Cohesion: 0.22
Nodes (12): IntegrationCommand, DATABASE_KINDS, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), manager, useCase(), CreateIntegrationInputSchema (+4 more)

### Community 42 - "Store"
Cohesion: 0.11
Nodes (16): AppConfig, AgentModelInfo, AgentSessionRef, ExternalDatabaseAdapter, SecretVault, Store, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID (+8 more)

### Community 43 - "tools.ts"
Cohesion: 0.14
Nodes (15): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+7 more)

### Community 44 - "WorkflowRunRecord"
Cohesion: 0.05
Nodes (42): WorkflowRunRepository, buildNodePrompt(), evaluateCondition(), executeTransform(), ExecuteWorkflowRunUseCase, RunState, ApprovalRecord, StepRunRecord (+34 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "Modal"
Cohesion: 0.18
Nodes (11): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal(), formatValue() (+3 more)

### Community 50 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 52 - "ProjectTopBar.tsx"
Cohesion: 0.16
Nodes (8): ProjectSettingsPanel(), ProjectTab, ProjectTopBar(), TABS, statusBadge(), StatusTone, statusTone(), WorkflowVersion

### Community 54 - "ChatThreadRecord"
Cohesion: 0.17
Nodes (5): ChatThreadRepository, VaultRepository, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 55 - "legacy-migration.test.ts"
Cohesion: 0.16
Nodes (14): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+6 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 59 - "createApplication"
Cohesion: 0.15
Nodes (7): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), AlertService, redact(), IntegrationManager

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 64 - "IntegrationRecord"
Cohesion: 0.24
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 65 - "SqliteStore"
Cohesion: 0.20
Nodes (4): DatabaseHandle, createStore(), parse(), SqliteStore

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "ManageIntegrationsUseCase"
Cohesion: 0.29
Nodes (4): hashIntegrationKey(), ManageIntegrationsUseCase, withDatabaseDefaults(), IntegrationScope

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 70 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.11
Nodes (17): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, ErrorEvent, ErrorEventSchema (+9 more)

### Community 75 - "WorkflowCanvas.tsx"
Cohesion: 0.07
Nodes (42): @xyflow/react@^12.3.6, NodePaletteModal(), ShapePreview(), CanvasActionsContext, useCanvasActions(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META (+34 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 81 - "execute-workflow.ts"
Cohesion: 0.11
Nodes (16): AgentPromptTimeoutError, CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, executeHttpNode(), ExecutorDeps, SseHub, BunWorkerPoolAdapter (+8 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.18
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 84 - "chat-progress.ts"
Cohesion: 0.26
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "ProjectResourcesPanel.tsx"
Cohesion: 0.15
Nodes (10): ControlChannelsPanel(), CHANNEL_KINDS, DATABASE_KINDS, DatabasePolicyEditor(), KIND_OPTIONS, kindLabel(), NotificationPolicyEditor(), ProjectResourcesPanel() (+2 more)

### Community 88 - "ProjectPage"
Cohesion: 0.19
Nodes (17): ProjectKnowledgePanel(), previewValue(), ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect() (+9 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 682 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `shared/src/index.ts` to `web/src/api.ts`, `ref_bun_test`, `WorkflowCanvas.tsx`, `WorkflowRunRecord`, `WorkflowVersionRecord`, `ui.test.tsx`, `sqlite-store.ts`, `execute-workflow.ts`, `Modal`, `SafeFsWorkspaceAdapter`, `ProjectPage`, `ProjectTopBar.tsx`, `WorkflowCanvasProps`, `workflow.ts`, `app.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `LogBindings` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `createApplication` to `LogBindings`, `auth-routes.ts`, `ref_bun_test`, `agents.test.ts`, `bootstrap.ts`, `manage-integrations.ts`, `shared/src/index.ts`, `IntegrationEgressPort`, `IntegrationValidationError`, `server/package.json`, `search-knowledge.ts`, `SafeFsWorkspaceAdapter`, `app.ts`, `RouteProjectIntegrationMessageUseCase`, `FakeAgentRuntime`, `notify-approval.test.ts`, `AgentRuntimePort`, `Store`, `tools.ts`, `WorkflowRunRecord`, `EmbeddingPort`, `ProjectRecord`, `NotebookRecord`, `SqliteStore`, `ManageIntegrationsUseCase`, `extractors.ts`, `.execute`, `execute-workflow.ts`, `chat-progress.ts`, `server/src/index.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07213114754098361 - nodes in this community are weakly interconnected._
- **Why does `FakeClient` connect `FakeClient` to `tools.ts`, `PlatformClient`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._