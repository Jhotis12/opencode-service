# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 213 files · ~243,026 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2009 nodes · 5143 edges · 111 communities (82 shown, 29 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `53001694`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- execute-workflow.test.ts
- HttpPlatformClient
- auth-routes.ts
- app.ts
- shared/src/index.ts
- WorkspacePort
- App.tsx
- bootstrap.ts
- react
- Store
- execute-workflow.test.ts
- graph.ts
- server/package.json
- WorkflowCanvas.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- UserRecord
- workflow.ts
- SafeFsWorkspaceAdapter
- ProjectPage
- BaileysTransport
- FakeRuntime
- environment
- IntegrationRecord
- url-safety.ts
- web/tsconfig.json
- scripts
- shared/src/api.ts
- NodeInspectorModal.tsx
- legacy-migration.ts
- chat-progress.ts
- web/package.json
- steps
- web/src/api.ts
- opencode-adapter.ts
- NodePaletteModal.tsx
- opencode-plugin/package.json
- createApplication
- SqliteStore
- GrammyTransport
- contracts.test.ts
- IntegrationValidationError
- tools.ts
- cron.ts
- .mapRun
- artifacts
- compilerOptions
- ChatPanel.tsx
- FakeClient
- input.ts
- notify-approval.test.ts
- setup.ts
- ProjectsPage
- OpenCodeV2Adapter
- json
- OrchestratorPage.tsx
- MarkdownAgentAdapter
- NotebookRecord
- IntegrationManager
- shared/package.json
- PlatformClient
- scheduler.test.ts
- WorkflowScheduleStateRecord
- FakeAgent
- worker-pool.test.ts
- entities.ts
- manage-integrations.ts
- extractors.ts
- WorkflowDeliveryRecord
- AgentRuntimePort
- FakeAgent
- database-actions.ts
- telemetry.ts
- createAgentRuntime
- NodeInspector.tsx
- chat.ts
- entrypoint.sh
- config.yaml
- store.ts
- WorkflowRunRecord
- execute-workflow.ts
- server/tsconfig.json
- WorkflowCanvasProps
- knowledge.test.ts
- IntegrationEgressPort
- worker-entry.ts
- channel-adapters.test.ts
- ProjectPage
- ExecuteWorkflowRunUseCase
- agents.ts
- opencode-plugin/tsconfig.json
- RouteProjectIntegrationMessageUseCase
- shared/tsconfig.json
- WorkflowVersionRecord
- alerts.test.ts
- orchestrator.ts
- opencode-adapter.test.ts
- knowledge-files.ts
- legacy-migration.test.ts
- approvals.ts
- external-chat.ts
- ChatMessageRecord
- TelegramChannelAdapter
- ProjectTopBar
- CanvasActions
- AgentModelInfo
- ErrorBoundary
- server/src/index.ts
- EventSourceStub
- legacy-migration.test.ts

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 130 edges
2. `Store` - 61 edges
3. `SqliteStore` - 54 edges
4. `Logger` - 48 edges
5. `IntegrationRecord` - 43 edges
6. `SafeFsWorkspaceAdapter` - 42 edges
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
- `validateIntegrationInput()` --calls--> `defaultCapabilities()`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (111 total, 29 thin omitted)

### Community 0 - "execute-workflow.test.ts"
Cohesion: 0.08
Nodes (13): ErrorTracker, LogBindings, Metrics, MetricsSnapshot, redact(), SECRET_KEY_PATTERN, InMemoryMetrics, createMemoryLogger() (+5 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.13
Nodes (16): ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, authMiddleware(), AuthVariables, PASSWORD_CHANGE_ALLOWLIST, readUser(), SESSION_COOKIE (+8 more)

### Community 3 - "app.ts"
Cohesion: 0.08
Nodes (21): AppEnv, Application, GetProjectSettingsUseCase, ChatWithProjectUseCase, SessionPayload, createAgentRuntime(), createLogger(), PROJECT_ISOLATION_PERMISSIONS (+13 more)

### Community 4 - "shared/src/index.ts"
Cohesion: 0.19
Nodes (9): AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), McpServerConfig, dirs, SubagentFrontmatter (+1 more)

### Community 5 - "WorkspacePort"
Cohesion: 0.12
Nodes (12): WorkspacePort, captureCodeBundle(), CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), withTimeout() (+4 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (23): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+15 more)

### Community 7 - "bootstrap.ts"
Cohesion: 0.13
Nodes (14): PasswordHasher, BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES (+6 more)

### Community 8 - "react"
Cohesion: 0.10
Nodes (43): api, RunRecord, AgentEditorModal(), AgentFormState, AgentMode, toForm(), KINDS, Modal() (+35 more)

### Community 9 - "Store"
Cohesion: 0.12
Nodes (9): ProjectRepository, Store, GetHealthUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, ProjectRecord (+1 more)

### Community 10 - "execute-workflow.test.ts"
Cohesion: 0.15
Nodes (8): EventBus, RouteGlobalIntegrationMessageUseCase, ManagedIntegration, SseHub, dirs, FakeEvents, silentLogger, SseEvent

### Community 11 - "graph.ts"
Cohesion: 0.27
Nodes (10): isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), stableStringify(), startNode(), topologicalOrder() (+2 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (57): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+49 more)

### Community 13 - "WorkflowCanvas.tsx"
Cohesion: 0.13
Nodes (20): CanvasActionsContext, useCanvasActions(), ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode(), PlatformNodeData, statusColor (+12 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.05
Nodes (43): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist() (+35 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.17
Nodes (19): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, systemErrorEvents (+11 more)

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (40): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+32 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.11
Nodes (9): FakeAgentRuntime, SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), setup(), setupScheduler() (+1 more)

### Community 20 - "ProjectPage"
Cohesion: 0.18
Nodes (15): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+7 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.12
Nodes (3): BaileysTransport, WhatsAppTransport, FakeWhatsApp

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.16
Nodes (3): IntegrationManagerPort, IntegrationRepository, IntegrationRecord

### Community 25 - "url-safety.ts"
Cohesion: 0.27
Nodes (5): assertSafeUrl(), ipv4Parts(), isPrivateAddress(), Resolver, UnsafeUrlError

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 29 - "NodeInspectorModal.tsx"
Cohesion: 0.15
Nodes (14): StepRun, nodeIssues(), conditionLabel(), defaultBranch(), edgeSourceLabel(), edgeTargetLabel(), InspectorTab, NodeInspectorModal() (+6 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.22
Nodes (13): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+5 more)

### Community 31 - "chat-progress.ts"
Cohesion: 0.26
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 32 - "web/package.json"
Cohesion: 0.05
Nodes (56): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+48 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "web/src/api.ts"
Cohesion: 0.10
Nodes (13): ApiClientError, ApprovalRecord, chatStream(), DeliveryRecord, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView (+5 more)

### Community 36 - "NodePaletteModal.tsx"
Cohesion: 0.16
Nodes (15): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS (+7 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.23
Nodes (7): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), hashIntegrationKey(), ManageIntegrationsUseCase, IntegrationScope

### Community 39 - "SqliteStore"
Cohesion: 0.15
Nodes (9): SqliteStore, Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, dirs, integration(), setup(), dirs (+1 more)

### Community 40 - "GrammyTransport"
Cohesion: 0.18
Nodes (3): IntegrationTransport, GrammyTransport, TelegramTransport

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (5): databaseConfig(), OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.19
Nodes (13): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+5 more)

### Community 44 - "cron.ts"
Cohesion: 0.16
Nodes (16): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), nextCronDate() (+8 more)

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
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 51 - "notify-approval.test.ts"
Cohesion: 0.12
Nodes (11): AppConfig, NotifyApprovalUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, Logger, FakeEgress (+3 more)

### Community 53 - "ProjectsPage"
Cohesion: 0.18
Nodes (7): kindLabel(), ProjectResourcesPanel(), formatDate(), ProjectsPage(), onNameChange(), slugify(), friendlyError()

### Community 56 - "OrchestratorPage.tsx"
Cohesion: 0.17
Nodes (13): HealthPayload, ControlChannelsPanel(), StatusBadge(), HealthPage(), OrchestratorPage(), SettingsPage(), agentModeLabel(), pageTitle (+5 more)

### Community 57 - "MarkdownAgentAdapter"
Cohesion: 0.17
Nodes (3): ManageSubagentsUseCase, MarkdownAgentAdapter, setup()

### Community 58 - "NotebookRecord"
Cohesion: 0.20
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, KnowledgeError

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "scheduler.test.ts"
Cohesion: 0.40
Nodes (5): dirs, fakeExecutor(), scheduleGraph(), silentLogger, tickingGraph()

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.23
Nodes (8): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, ExecutorDeps, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 66 - "entities.ts"
Cohesion: 0.11
Nodes (4): KnowledgeRepository, DeliveryStatus, KbChunkRecord, KbSourceRecord

### Community 67 - "manage-integrations.ts"
Cohesion: 0.27
Nodes (11): IntegrationCommand, IntegrationUpdateCommand, assertIntegrationInScope(), requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), manager, useCase() (+3 more)

### Community 68 - "extractors.ts"
Cohesion: 0.14
Nodes (12): KnowledgeExtractor, IngestDeps, chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), ALLOWED_EXTENSIONS (+4 more)

### Community 70 - "AgentRuntimePort"
Cohesion: 0.17
Nodes (7): AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), ChannelRouterDeps, ENTRY_POINTS

### Community 72 - "database-actions.ts"
Cohesion: 0.11
Nodes (10): ExternalDatabaseAdapter, SecretVault, ConnectProviderUseCase, classifySql(), DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, ExecuteDatabaseActionUseCase (+2 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.10
Nodes (18): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointType, EntryPointTypeSchema, ErrorEvent (+10 more)

### Community 75 - "NodeInspector.tsx"
Cohesion: 0.15
Nodes (11): ModelInfo, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), InputFieldsEditor(), NodeInspector() (+3 more)

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
Cohesion: 0.11
Nodes (8): ChatThreadRepository, ErrorEventRepository, SettingsRepository, VaultRepository, ChatThreadRecord, EntityScope, ErrorEventRecord, VaultSecretRecord

### Community 80 - "WorkflowRunRecord"
Cohesion: 0.18
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 81 - "execute-workflow.ts"
Cohesion: 0.18
Nodes (11): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), RunState, RunInFlightError, renderParams() (+3 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.13
Nodes (8): GraphIssue, toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 84 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (11): EmbeddingPort, KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity(), createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter (+3 more)

### Community 85 - "IntegrationEgressPort"
Cohesion: 0.17
Nodes (6): EgressSendResult, IntegrationEgressPort, IntegrationEgressRouter, FakeEgress, RecordingEgress, FakeEgress

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "channel-adapters.test.ts"
Cohesion: 0.12
Nodes (4): parseCloudWebhook(), WhatsAppCloudTransport, FakeTelegram, silentLogger

### Community 88 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 89 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.27
Nodes (5): ExecuteWorkflowRunUseCase, parseAndValidateAgentOutput(), nextEdge(), validateInputPayload(), WorkflowInputValidationError

### Community 90 - "agents.ts"
Cohesion: 0.15
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "alerts.test.ts"
Cohesion: 0.16
Nodes (4): AlertService, redact(), FakeEgress, logger

### Community 96 - "orchestrator.ts"
Cohesion: 0.24
Nodes (8): ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview, resolveOrchestratorModel(), captureLogger(), dirs, setup()

### Community 97 - "opencode-adapter.test.ts"
Cohesion: 0.22
Nodes (5): AgentPromptTimeoutError, extractAssistantText(), OpenCodeClientLike, TimeoutAgent, adapterWith()

### Community 99 - "legacy-migration.test.ts"
Cohesion: 0.18
Nodes (11): [databasePath, mappingPath, backupPath], mapping, sqlite, openDatabase(), addColumnIfMissing(), columnsOf(), migrate(), SQLITE_DDL (+3 more)

### Community 101 - "external-chat.ts"
Cohesion: 0.26
Nodes (10): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), createExternalChatRoutes(), cleanups, fakeManager (+2 more)

### Community 110 - "legacy-migration.test.ts"
Cohesion: 0.33
Nodes (3): AppDatabase, DatabaseHandle, schema

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 725 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `execute-workflow.test.ts`, `auth-routes.ts`, `app.ts`, `shared/src/index.ts`, `WorkspacePort`, `bootstrap.ts`, `Store`, `execute-workflow.test.ts`, `server/package.json`, `SafeFsWorkspaceAdapter`, `chat-progress.ts`, `SqliteStore`, `IntegrationValidationError`, `cron.ts`, `notify-approval.test.ts`, `MarkdownAgentAdapter`, `NotebookRecord`, `IntegrationManager`, `worker-pool.test.ts`, `extractors.ts`, `database-actions.ts`, `knowledge.test.ts`, `IntegrationEgressPort`, `ExecuteWorkflowRunUseCase`, `RouteProjectIntegrationMessageUseCase`, `alerts.test.ts`, `orchestrator.ts`, `knowledge-files.ts`, `approvals.ts`, `external-chat.ts`, `ChatMessageRecord`, `server/src/index.ts`, `legacy-migration.test.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `execute-workflow.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0824524312896406 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `web/package.json`, `NodePaletteModal.tsx`, `App.tsx`, `NodeInspector.tsx`, `WorkflowCanvas.tsx`, `ui.test.tsx`, `ChatPanel.tsx`, `NodeInspectorModal.tsx`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1265597147950089 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `app.ts`, `shared/src/index.ts`, `WorkspacePort`, `Store`, `execute-workflow.test.ts`, `server/package.json`, `SafeFsWorkspaceAdapter`, `FakeRuntime`, `opencode-adapter.ts`, `IntegrationValidationError`, `notify-approval.test.ts`, `OpenCodeV2Adapter`, `MarkdownAgentAdapter`, `FakeAgent`, `worker-pool.test.ts`, `FakeAgent`, `database-actions.ts`, `execute-workflow.ts`, `orchestrator.ts`, `external-chat.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._