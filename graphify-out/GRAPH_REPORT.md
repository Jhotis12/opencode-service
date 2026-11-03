# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 213 files · ~241,272 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2004 nodes · 5138 edges · 97 communities (74 shown, 23 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 160 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `db7dda6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- execute-workflow.test.ts
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- agents.test.ts
- app.ts
- App.tsx
- bootstrap.ts
- react
- Store
- ProjectRecord
- execute-workflow.ts
- server/package.json
- shared/src/index.ts
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
- knowledge.test.ts
- web/tsconfig.json
- scripts
- shared/src/api.ts
- DynamicDatabaseClientAdapter
- legacy-migration.ts
- Logger
- web/package.json
- steps
- NodeInspectorModal.tsx
- opencode-adapter.ts
- dynamic-adapter.ts
- opencode-plugin/package.json
- createApplication
- router.ts
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
- ProjectResourcesPanel
- OpenCodeV2Adapter
- json
- NotebookRecord
- IntegrationManager
- shared/package.json
- PlatformClient
- scheduler.test.ts
- WorkflowScheduleStateRecord
- FakeAgent
- worker-pool.test.ts
- KbSourceRecord
- manage-integrations.ts
- extractors.ts
- WorkflowDeliveryRecord
- AgentRuntimePort
- FakeAgent
- database-actions.ts
- telemetry.ts
- createAgentRuntime
- chat.ts
- entrypoint.sh
- config.yaml
- store.ts
- search-knowledge.ts
- server/tsconfig.json
- WorkflowCanvasProps
- EmbeddingPort
- channel-manager.ts
- worker-entry.ts
- scripts
- agents.ts
- opencode-plugin/tsconfig.json
- RouteProjectIntegrationMessageUseCase
- shared/tsconfig.json
- WorkflowVersionRecord
- alerts.ts
- opencode-adapter.test.ts
- legacy-migration.test.ts
- external-chat.ts
- ChatMessageRecord
- CanvasActions
- server/src/index.ts
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
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `createExternalChatRoutes()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/infrastructure/in/http/external-chat-routes.ts → packages/shared/src/api.ts
- `runLegacyMigration()` --calls--> `defaultCapabilities()`  [EXTRACTED]
  apps/server/src/infrastructure/out/persistence/legacy-migration.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (97 total, 23 thin omitted)

### Community 0 - "execute-workflow.test.ts"
Cohesion: 0.08
Nodes (13): ErrorTracker, LogBindings, Metrics, MetricsSnapshot, redact(), SECRET_KEY_PATTERN, InMemoryMetrics, PinoLoggerAdapter (+5 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.14
Nodes (16): authMiddleware(), AuthVariables, PASSWORD_CHANGE_ALLOWLIST, readUser(), SESSION_COOKIE, sessionMiddleware(), RateLimiter, SessionCodec (+8 more)

### Community 3 - "SqliteStore"
Cohesion: 0.08
Nodes (16): ChatWithProjectUseCase, SqliteStore, createLogger(), createMemoryLogger(), LoggerOptions, dirs, silentLogger, trigger (+8 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.08
Nodes (13): WorkspacePort, ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter (+5 more)

### Community 5 - "app.ts"
Cohesion: 0.13
Nodes (17): AppEnv, GetProjectSettingsUseCase, ProjectReadinessItem, readinessFor(), UpdateProjectSettingsUseCase, captureCodeBundle(), CreateProjectUseCase, DeleteProjectUseCase (+9 more)

### Community 6 - "App.tsx"
Cohesion: 0.08
Nodes (29): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), ErrorBoundary (+21 more)

### Community 7 - "bootstrap.ts"
Cohesion: 0.13
Nodes (14): PasswordHasher, LoginUseCase, BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace() (+6 more)

### Community 8 - "react"
Cohesion: 0.08
Nodes (55): api, AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode (+47 more)

### Community 9 - "Store"
Cohesion: 0.13
Nodes (9): Store, ApprovalDecisionError, DecideApprovalUseCase, ChangePasswordUseCase, ChannelAuthError, GetHealthUseCase, ProjectSettingsView, ExternalChatRouteDeps (+1 more)

### Community 11 - "execute-workflow.ts"
Cohesion: 0.10
Nodes (13): parseAndValidateAgentOutput(), validateWorkflowResources(), computePayloadHash(), IdempotencyMismatchError, RunInFlightError, stableStringify(), startNode(), WorkflowValidationError (+5 more)

### Community 12 - "server/package.json"
Cohesion: 0.06
Nodes (44): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+36 more)

### Community 13 - "shared/src/index.ts"
Cohesion: 0.07
Nodes (36): GraphIssue, NodePaletteModal(), ShapePreview(), CanvasActionsContext, useCanvasActions(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META (+28 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (29): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES (+21 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.13
Nodes (19): apiMock, primary, renderCatalog(), subagent, Harness(), apiMock, graph, renderPage() (+11 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.17
Nodes (19): chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks, projects, systemErrorEvents (+11 more)

### Community 17 - "UserRecord"
Cohesion: 0.21
Nodes (3): UserRepository, InvalidCredentialsError, UserRecord

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (40): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, InputFieldSchema (+32 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.09
Nodes (12): FakeAgentRuntime, SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress, setup(), setup(), FakeEvents, setup() (+4 more)

### Community 20 - "ProjectPage"
Cohesion: 0.10
Nodes (31): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+23 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.08
Nodes (6): BaileysTransport, parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp, silentLogger

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.15
Nodes (3): IntegrationManagerPort, IntegrationRepository, IntegrationRecord

### Community 25 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 29 - "DynamicDatabaseClientAdapter"
Cohesion: 0.28
Nodes (9): AgentSessionRef, ExternalDatabaseStatement, ExternalDatabaseStatementResult, ExternalDbConfig, DynamicDatabaseClientAdapter, withTimeout(), mssql, mysql2 (+1 more)

### Community 30 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 31 - "Logger"
Cohesion: 0.09
Nodes (24): AppConfig, commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent (+16 more)

### Community 32 - "web/package.json"
Cohesion: 0.06
Nodes (48): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+40 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "NodeInspectorModal.tsx"
Cohesion: 0.05
Nodes (39): ApiClientError, ApprovalRecord, chatStream(), HealthPayload, ModelInfo, NotebookSummary, OrchestratorOverview, ProjectReadinessItem (+31 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "createApplication"
Cohesion: 0.23
Nodes (7): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), ManageIntegrationsUseCase, useCase(), IntegrationScope

### Community 39 - "router.ts"
Cohesion: 0.33
Nodes (8): ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist(), ChannelMode

### Community 40 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 42 - "IntegrationValidationError"
Cohesion: 0.27
Nodes (5): databaseConfig(), QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, assertIntegrationInScope(), IntegrationValidationError

### Community 43 - "tools.ts"
Cohesion: 0.19
Nodes (13): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, slug (+5 more)

### Community 44 - "cron.ts"
Cohesion: 0.06
Nodes (32): WorkflowRunRepository, buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, ExecuteWorkflowRunUseCase, RunState, ApprovalRecord (+24 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "ChatPanel.tsx"
Cohesion: 0.17
Nodes (13): ChatHistoryMessage, BrandMark(), ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface (+5 more)

### Community 50 - "input.ts"
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 51 - "notify-approval.test.ts"
Cohesion: 0.11
Nodes (15): executeTransform(), NotifyApprovalUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, renderParams(), renderTemplate() (+7 more)

### Community 52 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "scheduler.test.ts"
Cohesion: 0.16
Nodes (9): Application, json(), logEntries, testLogger, waitForApproval(), dirs, scheduleGraph(), silentLogger (+1 more)

### Community 65 - "worker-pool.test.ts"
Cohesion: 0.23
Nodes (8): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, ExecutorDeps, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "manage-integrations.ts"
Cohesion: 0.35
Nodes (10): IntegrationCommand, IntegrationUpdateCommand, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), IntegrationCapability (+2 more)

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 70 - "AgentRuntimePort"
Cohesion: 0.10
Nodes (6): AgentModelInfo, AgentRuntimePort, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, sanitizeDatabaseError(), dirs

### Community 72 - "database-actions.ts"
Cohesion: 0.14
Nodes (11): ExternalDatabaseAdapter, SecretVault, classifySql(), DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, ExecuteDatabaseActionUseCase, SqlStatementKind (+3 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.10
Nodes (18): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointType, EntryPointTypeSchema, ErrorEvent (+10 more)

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
Cohesion: 0.08
Nodes (9): ChatThreadRepository, ErrorEventRepository, SettingsRepository, VaultRepository, ChatThreadRecord, DeliveryStatus, EntityScope, ErrorEventRecord (+1 more)

### Community 81 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.18
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 84 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 85 - "channel-manager.ts"
Cohesion: 0.12
Nodes (13): EgressSendResult, IntegrationEgressPort, TriggerRef, EventBus, ChannelRouterDeps, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, ManagedIntegration (+5 more)

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 90 - "agents.ts"
Cohesion: 0.15
Nodes (10): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRuleSchema, PlatformToolName, PlatformToolNameSchema (+2 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "alerts.ts"
Cohesion: 0.22
Nodes (4): AlertService, redact(), SseHub, SseEvent

### Community 97 - "opencode-adapter.test.ts"
Cohesion: 0.25
Nodes (4): AgentPromptTimeoutError, OpenCodeClientLike, TimeoutAgent, adapterWith()

### Community 99 - "legacy-migration.test.ts"
Cohesion: 0.24
Nodes (9): [databasePath, mappingPath, backupPath], mapping, sqlite, addColumnIfMissing(), columnsOf(), migrate(), SQLITE_DDL, tableExists() (+1 more)

### Community 101 - "external-chat.ts"
Cohesion: 0.16
Nodes (13): deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), hashIntegrationKey(), verifyIntegrationKey(), createExternalChatRoutes(), Aes256GcmVaultAdapter, loadOrCreateMasterKey() (+5 more)

### Community 110 - "legacy-migration.test.ts"
Cohesion: 0.20
Nodes (5): AppDatabase, DatabaseHandle, openDatabase(), schema, dirs

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 721 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `execute-workflow.test.ts`, `auth-routes.ts`, `SqliteStore`, `agents.test.ts`, `app.ts`, `bootstrap.ts`, `Store`, `ProjectRecord`, `execute-workflow.ts`, `SafeFsWorkspaceAdapter`, `DynamicDatabaseClientAdapter`, `Logger`, `IntegrationValidationError`, `cron.ts`, `notify-approval.test.ts`, `NotebookRecord`, `IntegrationManager`, `scheduler.test.ts`, `worker-pool.test.ts`, `extractors.ts`, `AgentRuntimePort`, `database-actions.ts`, `search-knowledge.ts`, `EmbeddingPort`, `channel-manager.ts`, `RouteProjectIntegrationMessageUseCase`, `alerts.ts`, `external-chat.ts`, `ChatMessageRecord`, `server/src/index.ts`, `legacy-migration.test.ts`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `execute-workflow.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08416389811738649 - nodes in this community are weakly interconnected._
- **Why does `HttpPlatformClient` connect `HttpPlatformClient` to `tools.ts`, `PlatformClient`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13911290322580644 - nodes in this community are weakly interconnected._
- **Why does `SqliteStore` connect `SqliteStore` to `execute-workflow.test.ts`, `auth-routes.ts`, `app.ts`, `bootstrap.ts`, `Store`, `ProjectRecord`, `execute-workflow.ts`, `sqlite-store.ts`, `SafeFsWorkspaceAdapter`, `knowledge.test.ts`, `Logger`, `createApplication`, `.mapRun`, `notify-approval.test.ts`, `NotebookRecord`, `scheduler.test.ts`, `WorkflowScheduleStateRecord`, `WorkflowDeliveryRecord`, `AgentRuntimePort`, `database-actions.ts`, `store.ts`, `legacy-migration.test.ts`, `external-chat.ts`, `legacy-migration.test.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._