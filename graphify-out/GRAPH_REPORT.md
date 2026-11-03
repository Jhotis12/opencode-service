# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 214 files · ~247,138 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2047 nodes · 5209 edges · 97 communities (77 shown, 20 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9feb9bc8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- app.ts
- FakeAgentRuntime
- shared/src/index.ts
- App.tsx
- bootstrap.ts
- react
- app.ts
- renderTemplate
- graph.ts
- server/package.json
- WorkflowCanvas.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- search-knowledge.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- ProjectPage
- BaileysTransport
- FakeRuntime
- environment
- IntegrationRecord
- knowledge.test.ts
- web/tsconfig.json
- scripts
- shared/src/api.ts
- web/package.json
- legacy-migration.ts
- chat.ts
- devDependencies
- steps
- web/src/api.ts
- opencode-adapter.ts
- notify-approval.test.ts
- opencode-plugin/package.json
- worker-pool.test.ts
- src/events.ts
- GrammyTransport
- contracts.test.ts
- execute-workflow.ts
- tools.ts
- cron.ts
- WorkflowVersionRecord
- artifacts
- compilerOptions
- ChatPanel.tsx
- FakeClient
- input.ts
- IntegrationEgressPort
- PlatformNode.tsx
- SessionContextRecord
- EntityScope
- WorkflowScheduler
- AgentCatalog.tsx
- ErrorEventRecord
- NotebookRecord
- IntegrationManager
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- FakeAgent
- WorkflowTimerRecord
- KbSourceRecord
- entities.ts
- extractors.ts
- WorkflowDeliveryRecord
- Logger
- FakeAgent
- SqliteStore
- telemetry.ts
- alerts.test.ts
- NodeInspectorModal.tsx
- BaileysTransport
- entrypoint.sh
- config.yaml
- ChatThreadRecord
- WorkflowRunRecord
- execute-workflow.ts
- server/tsconfig.json
- WorkflowCanvasProps
- EmbeddingPort
- scripts
- worker-entry.ts
- ProjectResourcesPanel
- ProjectPage
- ExecuteWorkflowRunUseCase
- opencode-plugin/tsconfig.json
- shared/tsconfig.json
- SseEvent
- legacy-migration.test.ts
- ChatMessageRecord
- FakeAgentRuntime
- DatabaseHandle

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 130 edges
2. `Store` - 61 edges
3. `SqliteStore` - 56 edges
4. `Logger` - 52 edges
5. `IntegrationRecord` - 43 edges
6. `SafeFsWorkspaceAdapter` - 42 edges
7. `WorkspacePort` - 42 edges
8. `AgentRuntimePort` - 41 edges
9. `ProjectPage()` - 39 edges
10. `react` - 34 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `createExternalChatRoutes()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/infrastructure/in/http/external-chat-routes.ts → packages/shared/src/api.ts
- `workspace()` --calls--> `SafeFsWorkspaceAdapter`  [EXTRACTED]
  apps/server/test/workspace.test.ts → apps/server/src/infrastructure/out/workspace-fs/safe-workspace.ts
- `AuthState` --references--> `User`  [EXTRACTED]
  apps/web/src/auth.tsx → packages/shared/src/api.ts
- `authMiddleware()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/infrastructure/in/auth/middleware.ts → packages/shared/src/api.ts

## Import Cycles
- None detected.

## Communities (97 total, 20 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.14
Nodes (9): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, sanitizeSentryEvent() (+1 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (26): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, UserRecord, assertPasswordPolicy() (+18 more)

### Community 3 - "app.ts"
Cohesion: 0.07
Nodes (21): Application, PROJECT_ISOLATION_PERMISSIONS, json(), logEntries, testLogger, waitForApproval(), dirs, silentLogger (+13 more)

### Community 4 - "FakeAgentRuntime"
Cohesion: 0.07
Nodes (24): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+16 more)

### Community 5 - "shared/src/index.ts"
Cohesion: 0.08
Nodes (13): EventBus, ProjectRepository, Store, WorkspacePort, ProjectReadinessItem, ProjectSettingsView, readinessFor(), ChannelRouterDeps (+5 more)

### Community 6 - "App.tsx"
Cohesion: 0.07
Nodes (35): @sentry/react@^9.0.0, App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup() (+27 more)

### Community 7 - "bootstrap.ts"
Cohesion: 0.13
Nodes (13): BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing(), Aes256GcmVaultAdapter (+5 more)

### Community 8 - "react"
Cohesion: 0.11
Nodes (41): api, RunRecord, AgentFormState, AgentMode, KINDS, ProjectKnowledgePanel(), DATABASE_KINDS, KIND_OPTIONS (+33 more)

### Community 9 - "app.ts"
Cohesion: 0.10
Nodes (24): AppEnv, createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), ApprovalDecisionError, DecideApprovalUseCase, ConnectProviderUseCase (+16 more)

### Community 10 - "renderTemplate"
Cohesion: 0.27
Nodes (9): evaluateCondition(), executeTransform(), SendNotificationInput, SendNotificationResult, SUPPORTED_CHANNELS, renderParams(), renderTemplate(), resolvePath() (+1 more)

### Community 11 - "graph.ts"
Cohesion: 0.29
Nodes (9): isValidCronExpression(), computePayloadHash(), effectiveEdges(), reachableFrom(), stableStringify(), startNode(), topologicalOrder(), validateWorkflowGraph() (+1 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+47 more)

### Community 13 - "WorkflowCanvas.tsx"
Cohesion: 0.13
Nodes (14): @xyflow/react@^12.3.6, CanvasActions, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, edgeTypes (+6 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.05
Nodes (41): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist(), CHANNEL_CAPABILITIES (+33 more)

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
Cohesion: 0.05
Nodes (40): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+32 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.19
Nodes (7): SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress, setup(), setup(), setup(), setup()

### Community 20 - "ProjectPage"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.11
Nodes (5): parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp, silentLogger

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.12
Nodes (5): IncomingIntegrationMessage, IntegrationManagerPort, IntegrationRepository, RouteProjectIntegrationMessageUseCase, IntegrationRecord

### Community 25 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 29 - "web/package.json"
Cohesion: 0.11
Nodes (22): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+14 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.20
Nodes (14): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+6 more)

### Community 31 - "chat.ts"
Cohesion: 0.09
Nodes (24): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+16 more)

### Community 32 - "devDependencies"
Cohesion: 0.05
Nodes (26): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/jest-dom@^6.6.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5 (+18 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "web/src/api.ts"
Cohesion: 0.10
Nodes (14): ApiClientError, ApprovalRecord, chatStream(), DeliveryRecord, HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem (+6 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.07
Nodes (9): createAgentRuntime(), extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, OpenCodeV2Adapter, ServiceClientFactory (+1 more)

### Community 36 - "notify-approval.test.ts"
Cohesion: 0.22
Nodes (6): NotifyApprovalUseCase, SendNotificationUseCase, FakeEgress, integration(), logger(), setup()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "worker-pool.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 39 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 40 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 42 - "execute-workflow.ts"
Cohesion: 0.08
Nodes (17): AgentPromptTimeoutError, AgentSessionRef, ExternalDatabaseAdapter, SecretVault, databaseConfig(), OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase (+9 more)

### Community 43 - "tools.ts"
Cohesion: 0.12
Nodes (12): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+4 more)

### Community 44 - "cron.ts"
Cohesion: 0.25
Nodes (14): cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), nextCronDate(), parseCron() (+6 more)

### Community 45 - "WorkflowVersionRecord"
Cohesion: 0.22
Nodes (3): WorkflowVersionRepository, WorkflowVersionRecord, parse()

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

### Community 51 - "IntegrationEgressPort"
Cohesion: 0.15
Nodes (7): EgressSendResult, IntegrationEgressPort, IntegrationEgressRouter, TelegramChannelAdapter, FakeEgress, RecordingEgress, FakeEgress

### Community 52 - "PlatformNode.tsx"
Cohesion: 0.21
Nodes (9): ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode(), PlatformNodeData, statusColor, ToolbarButton(), ToolbarIcon() (+1 more)

### Community 54 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 56 - "AgentCatalog.tsx"
Cohesion: 0.10
Nodes (24): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal(), ModalSize (+16 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "entities.ts"
Cohesion: 0.09
Nodes (14): hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand, ManageIntegrationsUseCase, DeliveryStatus, assertIntegrationInScope(), DATABASE_KINDS, IntegrationValidationError (+6 more)

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 70 - "Logger"
Cohesion: 0.08
Nodes (20): AppConfig, AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), ChannelAuthError (+12 more)

### Community 72 - "SqliteStore"
Cohesion: 0.18
Nodes (10): SqliteStore, dirs, integration(), setup(), dirs, fakeExecutor(), scheduleGraph(), setupScheduler() (+2 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 75 - "NodeInspectorModal.tsx"
Cohesion: 0.07
Nodes (27): ModelInfo, StepRun, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields() (+19 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 80 - "WorkflowRunRecord"
Cohesion: 0.15
Nodes (3): WorkflowRunRepository, ApprovalRecord, StepRunRecord

### Community 81 - "execute-workflow.ts"
Cohesion: 0.10
Nodes (9): Metrics, MetricsSnapshot, InMemoryMetrics, NoopErrorTracker, dirs, FakeEvents, silentLogger, dirs (+1 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.12
Nodes (9): GraphIssue, resolveConnection(), toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange() (+1 more)

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "ProjectResourcesPanel"
Cohesion: 0.33
Nodes (3): DatabasePolicyEditor(), kindLabel(), ProjectResourcesPanel()

### Community 88 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 89 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.28
Nodes (7): buildNodePrompt(), executeHttpNode(), ExecuteRunInput, ExecuteWorkflowRunUseCase, RunState, WorkflowRunRecord, nextEdge()

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "SseEvent"
Cohesion: 0.20
Nodes (4): AlertService, redact(), SseHub, SseEvent

### Community 99 - "legacy-migration.test.ts"
Cohesion: 0.16
Nodes (14): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+6 more)

### Community 106 - "FakeAgentRuntime"
Cohesion: 0.10
Nodes (7): AgentModelInfo, ChatWithOrchestratorUseCase, OrchestratorConfigurationError, FakeAgentRuntime, captureLogger(), dirs, setup()

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 740 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `app.ts` to `LogBindings`, `auth-routes.ts`, `app.ts`, `FakeAgentRuntime`, `shared/src/index.ts`, `bootstrap.ts`, `server/package.json`, `search-knowledge.ts`, `SafeFsWorkspaceAdapter`, `IntegrationRecord`, `chat.ts`, `opencode-adapter.ts`, `notify-approval.test.ts`, `worker-pool.test.ts`, `execute-workflow.ts`, `IntegrationEgressPort`, `WorkflowScheduler`, `NotebookRecord`, `IntegrationManager`, `entities.ts`, `extractors.ts`, `Logger`, `SqliteStore`, `execute-workflow.ts`, `EmbeddingPort`, `ExecuteWorkflowRunUseCase`, `SseEvent`, `ChatMessageRecord`, `FakeAgentRuntime`, `DatabaseHandle`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `LogBindings` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Why does `@opencode/plugin` connect `opencode-plugin/package.json` to `tools.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07581453634085213 - nodes in this community are weakly interconnected._
- **Why does `Store` connect `shared/src/index.ts` to `auth-routes.ts`, `entities.ts`, `extractors.ts`, `notify-approval.test.ts`, `Logger`, `bootstrap.ts`, `SqliteStore`, `app.ts`, `execute-workflow.ts`, `renderTemplate`, `cron.ts`, `sqlite-store.ts`, `search-knowledge.ts`, `EmbeddingPort`, `knowledge.test.ts`, `SseEvent`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._