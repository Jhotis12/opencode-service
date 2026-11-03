# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 214 files · ~245,722 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2038 nodes · 5187 edges · 97 communities (75 shown, 22 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3a04ffbd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- app.ts
- FakeAgentRuntime
- app.ts
- App.tsx
- bootstrap.ts
- react
- WorkflowGraph
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
- NodeInspectorModal.tsx
- legacy-migration.ts
- chat.ts
- web/package.json
- steps
- web/src/api.ts
- opencode-adapter.ts
- NodePaletteModal.tsx
- opencode-plugin/package.json
- createApplication
- src/events.ts
- GrammyTransport
- contracts.test.ts
- IntegrationValidationError
- tools.ts
- cron.ts
- IntegrationManagerPort
- artifacts
- compilerOptions
- ChatPanel.tsx
- FakeClient
- input.ts
- Logger
- setup.ts
- SessionContextRecord
- OpenCodeV2Adapter
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
- KbSourceRecord
- entities.ts
- extractors.ts
- WorkflowDeliveryRecord
- AgentRuntimePort
- FakeAgent
- connections.ts
- telemetry.ts
- createAgentRuntime
- NodeInspector.tsx
- entrypoint.sh
- config.yaml
- store.ts
- WorkflowRunRecord
- execute-workflow.ts
- server/tsconfig.json
- WorkflowCanvasProps
- EmbeddingPort
- worker-entry.ts
- ProjectPage.tsx
- ExecuteWorkflowRunUseCase
- opencode-plugin/tsconfig.json
- RouteProjectIntegrationMessageUseCase
- shared/tsconfig.json
- SseEvent
- legacy-migration.test.ts
- external-chat.ts
- ChatMessageRecord
- CanvasActions
- AgentModelInfo
- server/src/index.ts
- DatabaseHandle

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 130 edges
2. `Store` - 61 edges
3. `SqliteStore` - 55 edges
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
- `runLegacyMigration()` --calls--> `defaultCapabilities()`  [EXTRACTED]
  apps/server/src/infrastructure/out/persistence/legacy-migration.ts → packages/shared/src/integrations.ts
- `adapterWith()` --calls--> `OpenCodeV2Adapter`  [EXTRACTED]
  apps/server/test/opencode-adapter.test.ts → apps/server/src/infrastructure/out/opencode/opencode-adapter.ts
- `AuthState` --references--> `User`  [EXTRACTED]
  apps/web/src/auth.tsx → packages/shared/src/api.ts

## Import Cycles
- None detected.

## Communities (97 total, 22 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.18
Nodes (4): ErrorTracker, LogBindings, PinoLoggerAdapter, SentryErrorTracker

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy(), MIN_PASSWORD_LENGTH (+17 more)

### Community 3 - "app.ts"
Cohesion: 0.06
Nodes (33): Application, ChatWithOrchestratorUseCase, OrchestratorOverview, resolveOrchestratorModel(), ChatWithProjectUseCase, SqliteStore, createLogger(), createMemoryLogger() (+25 more)

### Community 4 - "FakeAgentRuntime"
Cohesion: 0.05
Nodes (25): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+17 more)

### Community 5 - "app.ts"
Cohesion: 0.08
Nodes (21): AppEnv, Store, WorkspacePort, DecideApprovalUseCase, ExecuteWorkflowRunUseCase, GetHealthUseCase, IntegrationCommand, IntegrationUpdateCommand (+13 more)

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (34): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+26 more)

### Community 7 - "bootstrap.ts"
Cohesion: 0.15
Nodes (12): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+4 more)

### Community 8 - "react"
Cohesion: 0.14
Nodes (30): api, ControlChannelsPanel(), KINDS, DATABASE_KINDS, KIND_OPTIONS, TABS, StatusBadge(), ModalKey (+22 more)

### Community 9 - "WorkflowGraph"
Cohesion: 0.11
Nodes (7): ProjectRepository, WorkflowVersionRepository, readinessFor(), ProjectRecord, WorkflowVersionRecord, computeGraphHash(), WorkflowGraph

### Community 10 - "renderTemplate"
Cohesion: 0.25
Nodes (6): evaluateCondition(), executeTransform(), renderParams(), renderTemplate(), resolvePath(), templateValue()

### Community 11 - "graph.ts"
Cohesion: 0.28
Nodes (10): isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), stableStringify(), startNode(), topologicalOrder() (+2 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+47 more)

### Community 13 - "WorkflowCanvas.tsx"
Cohesion: 0.12
Nodes (22): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode(), PlatformNodeData (+14 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.05
Nodes (41): ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist(), CHANNEL_CAPABILITIES (+33 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.12
Nodes (23): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, sessionContexts (+15 more)

### Community 17 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (40): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+32 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.09
Nodes (18): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, NoopErrorTracker, BunWorkerPoolAdapter, RpcMessage, SafeFsWorkspaceAdapter, WorkspaceError (+10 more)

### Community 20 - "ProjectPage"
Cohesion: 0.21
Nodes (12): cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue, outgoing(), PendingConnection (+4 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

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
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 29 - "NodeInspectorModal.tsx"
Cohesion: 0.21
Nodes (10): StepRun, nodeIssues(), conditionLabel(), defaultBranch(), edgeSourceLabel(), edgeTargetLabel(), InspectorTab, NodeInspectorModal() (+2 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.20
Nodes (14): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+6 more)

### Community 31 - "chat.ts"
Cohesion: 0.08
Nodes (25): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+17 more)

### Community 32 - "web/package.json"
Cohesion: 0.05
Nodes (52): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+44 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "web/src/api.ts"
Cohesion: 0.09
Nodes (15): ApiClientError, ApprovalRecord, chatStream(), DeliveryRecord, HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem (+7 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.10
Nodes (5): extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 36 - "NodePaletteModal.tsx"
Cohesion: 0.16
Nodes (14): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+6 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.19
Nodes (6): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), ManageIntegrationsUseCase, useCase()

### Community 39 - "src/events.ts"
Cohesion: 0.22
Nodes (8): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, StepStatusSchema, WorkflowGraphSchema

### Community 40 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 42 - "IntegrationValidationError"
Cohesion: 0.18
Nodes (5): databaseConfig(), TestDatabaseIntegrationUseCase, DatabaseActionValidationError, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.12
Nodes (12): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+4 more)

### Community 44 - "cron.ts"
Cohesion: 0.22
Nodes (13): cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), parseCron(), parseCronField() (+5 more)

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
Cohesion: 0.24
Nodes (10): parseAndValidateAgentOutput(), checkField(), validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField, InputSchema (+2 more)

### Community 51 - "Logger"
Cohesion: 0.06
Nodes (27): AppConfig, EgressSendResult, IntegrationEgressPort, TriggerRef, EventBus, NotifyApprovalUseCase, ChannelRouterDeps, ENTRY_POINTS (+19 more)

### Community 52 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 55 - "WorkflowScheduler"
Cohesion: 0.48
Nodes (3): cronMinuteKey(), nextCronDate(), WorkflowScheduler

### Community 56 - "AgentCatalog.tsx"
Cohesion: 0.16
Nodes (16): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode, toForm() (+8 more)

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
Cohesion: 0.14
Nodes (8): hashIntegrationKey(), DeliveryStatus, DATABASE_KINDS, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), withDatabaseDefaults(), manager

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 70 - "AgentRuntimePort"
Cohesion: 0.17
Nodes (7): AgentRuntimePort, AgentSessionRef, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext()

### Community 72 - "connections.ts"
Cohesion: 0.14
Nodes (14): ExternalDatabaseAdapter, SecretVault, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, ExecuteDatabaseActionUseCase (+6 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.15
Nodes (11): EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshot, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary (+3 more)

### Community 74 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 75 - "NodeInspector.tsx"
Cohesion: 0.13
Nodes (12): ModelInfo, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS, InputFieldsEditor() (+4 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "store.ts"
Cohesion: 0.17
Nodes (5): ChatThreadRepository, VaultRepository, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 80 - "WorkflowRunRecord"
Cohesion: 0.13
Nodes (7): WorkflowRunRepository, ApprovalDecisionError, ExecuteRunInput, RunState, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 81 - "execute-workflow.ts"
Cohesion: 0.09
Nodes (15): AgentPromptTimeoutError, executeHttpNode(), ExecutorDeps, Metrics, MetricsSnapshot, redact(), SECRET_KEY_PATTERN, InMemoryMetrics (+7 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.13
Nodes (8): GraphIssue, toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 88 - "ProjectPage.tsx"
Cohesion: 0.08
Nodes (30): changeEdgeCondition(), connectNodes(), mapServerIssue(), ProjectKnowledgePanel(), DatabasePolicyEditor(), kindLabel(), ProjectResourcesPanel(), ProjectSettingsPanel() (+22 more)

### Community 89 - "ExecuteWorkflowRunUseCase"
Cohesion: 0.24
Nodes (3): buildNodePrompt(), nextEdge(), NodeValidationError

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "SseEvent"
Cohesion: 0.24
Nodes (4): AlertService, redact(), SseHub, SseEvent

### Community 99 - "legacy-migration.test.ts"
Cohesion: 0.16
Nodes (14): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+6 more)

### Community 101 - "external-chat.ts"
Cohesion: 0.22
Nodes (11): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), validateWorkflowResources(), createExternalChatRoutes(), cleanups (+3 more)

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 739 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `LogBindings`, `auth-routes.ts`, `app.ts`, `FakeAgentRuntime`, `app.ts`, `bootstrap.ts`, `WorkflowGraph`, `renderTemplate`, `server/package.json`, `search-knowledge.ts`, `SafeFsWorkspaceAdapter`, `chat.ts`, `IntegrationValidationError`, `Logger`, `WorkflowScheduler`, `NotebookRecord`, `IntegrationManager`, `extractors.ts`, `connections.ts`, `telemetry.ts`, `createAgentRuntime`, `WorkflowRunRecord`, `execute-workflow.ts`, `EmbeddingPort`, `ExecuteWorkflowRunUseCase`, `RouteProjectIntegrationMessageUseCase`, `SseEvent`, `external-chat.ts`, `ChatMessageRecord`, `AgentModelInfo`, `server/src/index.ts`, `DatabaseHandle`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Why does `@opencode/plugin` connect `opencode-plugin/package.json` to `tools.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0567287784679089 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `FakeAgent`, `app.ts`, `FakeAgentRuntime`, `external-chat.ts`, `app.ts`, `opencode-adapter.ts`, `connections.ts`, `FakeAgent`, `AgentModelInfo`, `execute-workflow.ts`, `Logger`, `OpenCodeV2Adapter`, `FakeRuntime`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._