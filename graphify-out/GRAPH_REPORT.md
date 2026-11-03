# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 214 files · ~248,445 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2054 nodes · 5219 edges · 104 communities (78 shown, 26 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32483ad6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- app.ts
- agents.test.ts
- project-settings.ts
- App.tsx
- external-chat.ts
- react
- WorkspacePort
- execute-workflow.ts
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
- route-channel-message.ts
- web/tsconfig.json
- scripts
- shared/src/api.ts
- web/package.json
- ManageSubagentsUseCase
- chat.ts
- setup.ts
- steps
- web/src/api.ts
- opencode-adapter.ts
- notify-approval.test.ts
- opencode-plugin/package.json
- orchestrator.ts
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
- NodePaletteModal.tsx
- SessionContextRecord
- EntityScope
- agents.ts
- AgentCatalog.tsx
- entities.ts
- NotebookRecord
- createApplication
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- FakeAgent
- WorkflowTimerRecord
- KbSourceRecord
- entities.ts
- knowledge.test.ts
- WorkflowDeliveryRecord
- Store
- FakeAgent
- OpenCodeV2Adapter
- telemetry.ts
- devDependencies
- NodeInspectorModal.tsx
- BaileysTransport
- entrypoint.sh
- config.yaml
- ChatThreadRecord
- WorkflowRunRecord
- execute-workflow.test.ts
- server/tsconfig.json
- WorkflowCanvasProps
- chat-progress.ts
- scripts
- worker-entry.ts
- ProjectResourcesPanel
- ProjectPage
- web/package.json
- EventBus
- opencode-plugin/tsconfig.json
- opencode-adapter.test.ts
- shared/tsconfig.json
- RouteProjectIntegrationMessageUseCase
- SseEvent
- CanvasActions
- ProjectsPage
- DeleteProjectUseCase
- TelegramChannelAdapter
- ServiceClientFactory
- vite.config.ts
- shared/src/index.ts
- AgentModelInfo

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
- `ExecuteRunInput` --references--> `WorkflowRunRecord`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → apps/server/src/domain/entities.ts
- `RunState` --references--> `WorkflowRunRecord`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → apps/server/src/domain/entities.ts
- `adapterWith()` --calls--> `OpenCodeV2Adapter`  [EXTRACTED]
  apps/server/test/opencode-adapter.test.ts → apps/server/src/infrastructure/out/opencode/opencode-adapter.ts

## Import Cycles
- None detected.

## Communities (104 total, 26 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.25
Nodes (5): LogBindings, createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter

### Community 2 - "auth-routes.ts"
Cohesion: 0.06
Nodes (34): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, BootstrapResult, BootstrapSystemUseCase (+26 more)

### Community 3 - "app.ts"
Cohesion: 0.06
Nodes (38): AppEnv, Application, ConnectProviderUseCase, ExecuteDatabaseActionUseCase, ChatWithOrchestratorUseCase, resolveOrchestratorModel(), GetProjectSettingsUseCase, ChatWithProjectUseCase (+30 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.24
Nodes (9): AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, dirs, SubagentFrontmatter (+1 more)

### Community 5 - "project-settings.ts"
Cohesion: 0.22
Nodes (5): ProjectRepository, ProjectReadinessItem, ProjectSettingsView, UpdateProjectSettingsUseCase, ProjectRecord

### Community 6 - "App.tsx"
Cohesion: 0.10
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "external-chat.ts"
Cohesion: 0.26
Nodes (10): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), validateWorkflowResources(), createExternalChatRoutes(), cleanups (+2 more)

### Community 8 - "react"
Cohesion: 0.10
Nodes (46): api, ModelInfo, RunRecord, AgentFormState, AgentMode, ControlChannelsPanel(), KINDS, ProjectKnowledgePanel() (+38 more)

### Community 9 - "WorkspacePort"
Cohesion: 0.12
Nodes (9): WorkspacePort, readinessFor(), captureCodeBundle(), CreateProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), computeGraphHash() (+1 more)

### Community 10 - "execute-workflow.ts"
Cohesion: 0.20
Nodes (10): buildNodePrompt(), evaluateCondition(), executeHttpNode(), ExecuteRunInput, executeTransform(), RunState, renderParams(), renderTemplate() (+2 more)

### Community 11 - "graph.ts"
Cohesion: 0.25
Nodes (11): isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, nextEdge(), reachableFrom(), stableStringify(), startNode() (+3 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (56): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+48 more)

### Community 13 - "WorkflowCanvas.tsx"
Cohesion: 0.12
Nodes (21): @xyflow/react@^12.3.6, CanvasActionsContext, useCanvasActions(), ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode(), PlatformNodeData (+13 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.05
Nodes (35): CHANNEL_CAPABILITIES, ChannelMode, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, CreateIntegrationInputSchema, DATABASE_CAPABILITIES (+27 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (17): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+9 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.05
Nodes (53): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, DatabaseHandle, openDatabase(), channelKind(), createMigrationBackup() (+45 more)

### Community 18 - "workflow.ts"
Cohesion: 0.04
Nodes (44): AgentNodeConfig, AgentNodeConfigSchema, DatabaseNodeConfig, DatabaseNodeConfigSchema, DatabaseStatement, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig (+36 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.09
Nodes (12): FakeAgentRuntime, SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), FakeEvents, setup() (+4 more)

### Community 20 - "ProjectPage"
Cohesion: 0.18
Nodes (15): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+7 more)

### Community 21 - "BaileysTransport"
Cohesion: 0.10
Nodes (5): parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp, silentLogger

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.13
Nodes (3): IntegrationManagerPort, IntegrationRepository, IntegrationRecord

### Community 25 - "route-channel-message.ts"
Cohesion: 0.17
Nodes (14): TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage() (+6 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 29 - "web/package.json"
Cohesion: 0.12
Nodes (17): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+9 more)

### Community 31 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 32 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "web/src/api.ts"
Cohesion: 0.10
Nodes (14): ApiClientError, ApprovalRecord, chatStream(), DeliveryRecord, HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem (+6 more)

### Community 36 - "notify-approval.test.ts"
Cohesion: 0.17
Nodes (9): NotifyApprovalUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, FakeEgress, integration(), logger() (+1 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "orchestrator.ts"
Cohesion: 0.21
Nodes (9): ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview (+1 more)

### Community 39 - "src/events.ts"
Cohesion: 0.22
Nodes (7): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, StepStatusSchema, WorkflowGraphSchema

### Community 40 - "GrammyTransport"
Cohesion: 0.13
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 42 - "execute-workflow.ts"
Cohesion: 0.14
Nodes (9): ExternalDatabaseAdapter, databaseConfig(), OPENCODE_GO_PROVIDER_ID, TestDatabaseIntegrationUseCase, DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, classifySql() (+1 more)

### Community 43 - "tools.ts"
Cohesion: 0.12
Nodes (12): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+4 more)

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
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "IntegrationEgressPort"
Cohesion: 0.16
Nodes (7): EgressSendResult, IntegrationEgressPort, ManagedIntegration, IntegrationEgressRouter, FakeEgress, RecordingEgress, FakeEgress

### Community 52 - "NodePaletteModal.tsx"
Cohesion: 0.20
Nodes (10): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NODE_SHAPES, NodeShape (+2 more)

### Community 54 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 55 - "agents.ts"
Cohesion: 0.12
Nodes (12): AgentExecutionContext, AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, PermissionRule, PermissionRuleSchema (+4 more)

### Community 56 - "AgentCatalog.tsx"
Cohesion: 0.15
Nodes (17): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal(), ModalSize (+9 more)

### Community 57 - "entities.ts"
Cohesion: 0.22
Nodes (3): ErrorEventRepository, DeliveryStatus, ErrorEventRecord

### Community 59 - "createApplication"
Cohesion: 0.11
Nodes (7): createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), port, server, IntegrationManager

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "entities.ts"
Cohesion: 0.13
Nodes (13): hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand, ManageIntegrationsUseCase, assertIntegrationInScope(), DATABASE_KINDS, IntegrationValidationError, requiredSecretRefs() (+5 more)

### Community 68 - "knowledge.test.ts"
Cohesion: 0.07
Nodes (30): EmbeddingPort, KnowledgeExtractor, KnowledgeFilePort, IngestDeps, IngestKnowledgeUseCase, buildGroundedContext(), chunkMarkdown(), ChunkOptions (+22 more)

### Community 70 - "Store"
Cohesion: 0.10
Nodes (8): AppConfig, AgentRuntimePort, SecretVault, Store, QueryDatabaseIntegrationUseCase, GetHealthUseCase, Logger, ExternalChatRouteDeps

### Community 73 - "telemetry.ts"
Cohesion: 0.14
Nodes (12): EntryPointType, EntryPointTypeSchema, ErrorEvent, ErrorEventSchema, HealthSnapshot, HealthSnapshotSchema, HealthStatus, HealthStatusSchema (+4 more)

### Community 74 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom@^25.0.1, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/react@^19.0.3, @types/react-dom@^19.0.2, typescript@^5.7.2, vite@^6.0.7 (+6 more)

### Community 75 - "NodeInspectorModal.tsx"
Cohesion: 0.07
Nodes (26): StepRun, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS (+18 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 80 - "WorkflowRunRecord"
Cohesion: 0.11
Nodes (7): WorkflowRunRepository, ApprovalDecisionError, DecideApprovalUseCase, ExecuteWorkflowRunUseCase, ApprovalRecord, StepRunRecord, WorkflowRunRecord

### Community 81 - "execute-workflow.test.ts"
Cohesion: 0.06
Nodes (22): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, ExecutorDeps, ErrorTracker, Metrics, MetricsSnapshot, redact() (+14 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "WorkflowCanvasProps"
Cohesion: 0.13
Nodes (8): GraphIssue, toEdges(), WorkflowCanvas(), handleConnect(), handleEdgesChange(), handleNodeClick(), handleNodesChange(), WorkflowCanvasProps

### Community 84 - "chat-progress.ts"
Cohesion: 0.33
Nodes (8): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText()

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

### Community 89 - "web/package.json"
Cohesion: 0.20
Nodes (9): @platform/shared@workspace:*, tailwindcss@^4.3.3, @types/qrcode@^1.5.5, @platform/shared, name, type, version, tailwindcss (+1 more)

### Community 90 - "EventBus"
Cohesion: 0.36
Nodes (4): EventBus, ChannelRouterDeps, SseHub, SseEvent

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "opencode-adapter.test.ts"
Cohesion: 0.22
Nodes (5): AgentPromptTimeoutError, extractAssistantText(), OpenCodeClientLike, TimeoutAgent, adapterWith()

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 95 - "SseEvent"
Cohesion: 0.16
Nodes (4): AlertService, redact(), FakeEgress, logger

### Community 97 - "ProjectsPage"
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

### Community 101 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 102 - "shared/src/index.ts"
Cohesion: 0.28
Nodes (4): ChatRepository, withTimeout(), ChatMessageRecord, ProjectTemplate

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 746 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `LogBindings`, `auth-routes.ts`, `app.ts`, `agents.test.ts`, `project-settings.ts`, `external-chat.ts`, `WorkspacePort`, `graph.ts`, `server/package.json`, `sqlite-store.ts`, `search-knowledge.ts`, `SafeFsWorkspaceAdapter`, `route-channel-message.ts`, `ManageSubagentsUseCase`, `notify-approval.test.ts`, `orchestrator.ts`, `execute-workflow.ts`, `cron.ts`, `IntegrationEgressPort`, `entities.ts`, `knowledge.test.ts`, `Store`, `telemetry.ts`, `WorkflowRunRecord`, `execute-workflow.test.ts`, `EventBus`, `RouteProjectIntegrationMessageUseCase`, `SseEvent`, `DeleteProjectUseCase`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05898021308980213 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ui.test.tsx` to `setup.ts`, `vite.config.ts`, `App.tsx`, `react`, `devDependencies`, `NodeInspectorModal.tsx`, `ProjectPage`, `NodePaletteModal.tsx`, `web/package.json`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06027306027306027 - nodes in this community are weakly interconnected._
- **Why does `FakeClient` connect `FakeClient` to `tools.ts`, `PlatformClient`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._