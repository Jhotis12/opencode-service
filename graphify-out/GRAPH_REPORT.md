# Graph Report - Opencode-server  (2026-11-03)

## Corpus Check
- 222 files · ~269,765 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2212 nodes · 5716 edges · 102 communities (78 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `707cd65e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- agents.test.ts
- app.ts
- App.tsx
- shared/src/index.ts
- react
- EventBus
- Logger
- IntegrationValidationError
- server/package.json
- ProjectPage.tsx
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- ProjectResourcesPanel.tsx
- workflow.ts
- SafeFsWorkspaceAdapter
- graph-edits.ts
- BaileysTransport
- FakeRuntime
- environment
- knowledge.test.ts
- channel-router.test.ts
- web/tsconfig.json
- scripts
- WorkflowCanvas.tsx
- devDependencies
- extractors.ts
- chat.ts
- web/src/api.ts
- steps
- contracts.test.ts
- opencode-adapter.ts
- opencode-plugin/package.json
- FakeAgentRuntime
- GrammyTransport
- chat-turns.ts
- AgentRuntimePort
- NotebookRecord
- tools.ts
- WorkflowScheduler
- execute-workflow.ts
- artifacts
- compilerOptions
- validation.ts
- FakeClient
- WorkflowRunRecord
- ProjectPage
- entities.ts
- OpenCodeV2Adapter
- ChatThreadRecord
- legacy-migration.test.ts
- RunQueueRepository
- auth.tsx
- NodeInspector.tsx
- createApplication
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- ProjectPage.tsx
- WorkflowTimerRecord
- KbSourceRecord
- ManageIntegrationsUseCase
- orchestrator-turn.test.ts
- WorkflowDeliveryRecord
- WorkflowCanvasProps
- FakeAgent
- IntegrationRecord
- telemetry.ts
- agents.ts
- WorkflowCanvas.tsx
- EntityScope
- entrypoint.sh
- config.yaml
- legacy-migration.ts
- WorkflowVersionRecord
- EmbeddingPort
- server/tsconfig.json
- chat-progress.ts
- SessionContextRecord
- scripts
- worker-entry.ts
- shared/src/api.ts
- search-knowledge.ts
- AgentModelInfo
- FakeAgent
- opencode-plugin/tsconfig.json
- ChatTurnController
- shared/tsconfig.json
- ErrorEventRecord
- DatabaseHandle
- CanvasActions
- setup.ts
- RouteProjectIntegrationMessageUseCase
- AgentMessage
- opencode-adapter.test.ts
- createAgentRuntime

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 143 edges
2. `SqliteStore` - 64 edges
3. `Store` - 63 edges
4. `Logger` - 56 edges
5. `AgentRuntimePort` - 50 edges
6. `ChatTurnService` - 45 edges
7. `IntegrationRecord` - 43 edges
8. `SafeFsWorkspaceAdapter` - 42 edges
9. `WorkspacePort` - 42 edges
10. `ProjectPage()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `WorkflowCanvasProps` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/web/src/components/WorkflowCanvas.tsx → packages/shared/src/workflow.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `IntegrationUpdateCommand` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts
- `ValidatedIntegrationInput` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/domain/integrations/validation.ts → packages/shared/src/integrations.ts
- `runLegacyMigration()` --calls--> `defaultCapabilities()`  [EXTRACTED]
  apps/server/src/infrastructure/out/persistence/legacy-migration.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (102 total, 24 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.11
Nodes (10): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, NoopErrorTracker (+2 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.05
Nodes (36): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, BootstrapResult, BootstrapSystemUseCase (+28 more)

### Community 3 - "SqliteStore"
Cohesion: 0.06
Nodes (27): AgentPromptTimeoutError, QueryDatabaseIntegrationUseCase, ExecuteDatabaseActionUseCase, executeHttpNode(), SqliteStore, Aes256GcmVaultAdapter, json(), logEntries (+19 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (11): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+3 more)

### Community 5 - "app.ts"
Cohesion: 0.09
Nodes (12): AppEnv, assertChatTimeoutsCoverOpenCode(), ChatTurnPolicy, positive(), resolveChatTurnPolicy(), GetHealthUseCase, IntegrationUpdateCommand, Metrics (+4 more)

### Community 6 - "App.tsx"
Cohesion: 0.19
Nodes (12): BrandLockup(), BrandMark(), initialCollapsed(), Layout(), toggleCollapsed(), NAV_ITEMS, saveCollapsed(), common (+4 more)

### Community 7 - "shared/src/index.ts"
Cohesion: 0.10
Nodes (22): ExternalDatabaseAdapter, SecretVault, Store, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, ExecuteDatabaseActionResult, ChannelAuthError, deliverWebhook() (+14 more)

### Community 8 - "react"
Cohesion: 0.13
Nodes (26): api, App(), RequireAuth(), useAuth(), ControlChannelsPanel(), KINDS, ChangePasswordPage(), HealthPage() (+18 more)

### Community 10 - "Logger"
Cohesion: 0.06
Nodes (27): AppConfig, EgressSendResult, IntegrationEgressPort, ExecutorDeps, NotifyApprovalUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase (+19 more)

### Community 11 - "IntegrationValidationError"
Cohesion: 0.17
Nodes (7): databaseConfig(), TestDatabaseIntegrationUseCase, DatabaseActionValidationError, classifySql(), SqlStatementKind, IntegrationValidationError, databaseAccessPolicy()

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@2.2.5 (+47 more)

### Community 13 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (29): RunRecord, StepRun, GraphIssue, nodeIssues(), conditionLabel(), defaultBranch(), edgeSourceLabel(), edgeTargetLabel() (+21 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (31): CHANNEL_CAPABILITIES, ChannelMode, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, DATABASE_CAPABILITIES, DatabaseAccessPolicy (+23 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (18): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.11
Nodes (27): chatMessages, chatThreads, chatTurns, integrations, kbChunks, kbSources, notebooks, projects (+19 more)

### Community 17 - "ProjectResourcesPanel.tsx"
Cohesion: 0.19
Nodes (9): qrcode@^1.5.4, CHANNEL_KINDS, DATABASE_KINDS, DatabasePolicyEditor(), KIND_OPTIONS, kindLabel(), NotificationPolicyEditor(), ProjectResourcesPanel() (+1 more)

### Community 18 - "workflow.ts"
Cohesion: 0.05
Nodes (37): ExecuteDatabaseActionInput, AgentNodeConfig, DatabaseNodeConfig, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema (+29 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.10
Nodes (17): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress (+9 more)

### Community 20 - "graph-edits.ts"
Cohesion: 0.20
Nodes (13): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+5 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 23 - "environment"
Cohesion: 0.06
Nodes (30): AGENT_CHAT_TIMEOUT_MS, AGENT_TURN_IDLE_MS, AGENT_TURN_MAX_MS, AGENT_TURN_POLL_MS, AGENT_TURN_RETRY_MS, CHAT_TURN_ENGINE, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL (+22 more)

### Community 24 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 25 - "channel-router.test.ts"
Cohesion: 0.18
Nodes (11): TriggerRef, RouteGlobalIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist() (+3 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "WorkflowCanvas.tsx"
Cohesion: 0.19
Nodes (13): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, edgeTypes, EMPTY_ISSUES (+5 more)

### Community 29 - "devDependencies"
Cohesion: 0.06
Nodes (43): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+35 more)

### Community 30 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 31 - "chat.ts"
Cohesion: 0.08
Nodes (25): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+17 more)

### Community 32 - "web/src/api.ts"
Cohesion: 0.05
Nodes (35): ApiClientError, ApprovalRecord, attachTurnStream(), ChatHistoryMessage, chatStream(), ChatTurnResult, ChatTurnStreamError, DeliveryRecord (+27 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "contracts.test.ts"
Cohesion: 0.12
Nodes (17): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, AgentNodeConfigSchema, DatabaseNodeConfigSchema (+9 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "chat-turns.ts"
Cohesion: 0.08
Nodes (11): AgentSessionState, ChatRepository, ChatTurnRepository, ChatTurnService, extractTurnReply(), isTransportError(), nowIso(), TurnNotFoundError (+3 more)

### Community 41 - "AgentRuntimePort"
Cohesion: 0.06
Nodes (23): EventBus, AgentRuntimePort, AgentSessionRef, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext() (+15 more)

### Community 42 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 43 - "tools.ts"
Cohesion: 0.14
Nodes (15): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+7 more)

### Community 44 - "WorkflowScheduler"
Cohesion: 0.27
Nodes (4): Application, cronMinuteKey(), WorkflowScheduler, NodeSpec

### Community 45 - "execute-workflow.ts"
Cohesion: 0.07
Nodes (35): WorkspacePort, ExecuteRunInput, captureCodeBundle(), DeleteProjectUseCase, syncProjectsFromDisk(), validateWorkflowResources(), cronWindowsBetween(), FIELD_RANGES (+27 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "validation.ts"
Cohesion: 0.26
Nodes (11): IntegrationCommand, assertIntegrationInScope(), DATABASE_KINDS, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities() (+3 more)

### Community 50 - "WorkflowRunRecord"
Cohesion: 0.06
Nodes (27): WorkflowRunRepository, ApprovalDecisionError, DecideApprovalUseCase, buildNodePrompt(), evaluateCondition(), executeTransform(), ExecuteWorkflowRunUseCase, parseAndValidateAgentOutput() (+19 more)

### Community 51 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 52 - "entities.ts"
Cohesion: 0.12
Nodes (7): ChatTurnDeliveryState, ChatTurnEventRecord, DeliveryStatus, dirs, scheduleGraph(), silentLogger, tickingGraph()

### Community 54 - "ChatThreadRecord"
Cohesion: 0.28
Nodes (3): ChatThreadRepository, StartChatTurnInput, ChatThreadRecord

### Community 55 - "legacy-migration.test.ts"
Cohesion: 0.16
Nodes (14): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+6 more)

### Community 57 - "auth.tsx"
Cohesion: 0.18
Nodes (8): @sentry/react@^9.0.0, AuthContext, AuthProvider(), AuthState, ErrorBoundary, queryClient, User, @sentry/react

### Community 58 - "NodeInspector.tsx"
Cohesion: 0.19
Nodes (12): ModelInfo, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS, InputFieldsEditor() (+4 more)

### Community 59 - "createApplication"
Cohesion: 0.10
Nodes (10): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), AlertService, redact(), port, server (+2 more)

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 64 - "ProjectPage.tsx"
Cohesion: 0.11
Nodes (29): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode, toForm() (+21 more)

### Community 65 - "WorkflowTimerRecord"
Cohesion: 0.20
Nodes (3): WorkflowTimerRepository, WorkflowTimerRecord, parse()

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "ManageIntegrationsUseCase"
Cohesion: 0.29
Nodes (4): ManageIntegrationsUseCase, withDatabaseDefaults(), useCase(), IntegrationScope

### Community 68 - "orchestrator-turn.test.ts"
Cohesion: 0.20
Nodes (7): ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, resolveOrchestratorModel(), captureLogger(), dirs, setup()

### Community 70 - "WorkflowCanvasProps"
Cohesion: 0.13
Nodes (8): resolveConnection(), toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 72 - "IntegrationRecord"
Cohesion: 0.16
Nodes (3): IntegrationManagerPort, IntegrationRepository, IntegrationRecord

### Community 73 - "telemetry.ts"
Cohesion: 0.14
Nodes (13): ChatHealthSummary, ChatHealthSummarySchema, EntryPointType, ErrorEvent, ErrorEventSchema, HealthSnapshot, HealthSnapshotSchema, HealthStatus (+5 more)

### Community 74 - "agents.ts"
Cohesion: 0.14
Nodes (13): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), parseModelRef(), PermissionRuleSchema (+5 more)

### Community 75 - "WorkflowCanvas.tsx"
Cohesion: 0.14
Nodes (19): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+11 more)

### Community 76 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 81 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "chat-progress.ts"
Cohesion: 0.30
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "shared/src/api.ts"
Cohesion: 0.17
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 88 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 98 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 108 - "opencode-adapter.test.ts"
Cohesion: 0.29
Nodes (4): AgentInboxItem, extractAssistantText(), OpenCodeClientLike, adapterWith()

### Community 110 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 783 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `LogBindings`, `auth-routes.ts`, `SqliteStore`, `agents.test.ts`, `app.ts`, `shared/src/index.ts`, `EventBus`, `Logger`, `IntegrationValidationError`, `server/package.json`, `SafeFsWorkspaceAdapter`, `channel-router.test.ts`, `extractors.ts`, `.execute`, `chat-turns.ts`, `AgentRuntimePort`, `NotebookRecord`, `WorkflowScheduler`, `execute-workflow.ts`, `WorkflowRunRecord`, `ManageIntegrationsUseCase`, `orchestrator-turn.test.ts`, `EmbeddingPort`, `search-knowledge.ts`, `AgentModelInfo`, `DatabaseHandle`, `RouteProjectIntegrationMessageUseCase`, `createAgentRuntime`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Are the 74 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 74 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `LogBindings` be split into smaller, more focused modules?**
  _Cohesion score 0.10695187165775401 - nodes in this community are weakly interconnected._
- **Why does `Logger` connect `Logger` to `LogBindings`, `SqliteStore`, `orchestrator-turn.test.ts`, `app.ts`, `.execute`, `shared/src/index.ts`, `AgentRuntimePort`, `execute-workflow.ts`, `entities.ts`, `channel-router.test.ts`, `createApplication`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053998632946001365 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `SqliteStore`, `agents.test.ts`, `app.ts`, `orchestrator-turn.test.ts`, `shared/src/index.ts`, `FakeAgentRuntime`, `opencode-adapter.ts`, `Logger`, `FakeAgent`, `execute-workflow.ts`, `OpenCodeV2Adapter`, `FakeRuntime`, `AgentModelInfo`, `FakeAgent`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._