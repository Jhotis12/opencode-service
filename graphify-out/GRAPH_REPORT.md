# Graph Report - Opencode-server  (2026-11-03)

## Corpus Check
- 222 files · ~270,121 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2184 nodes · 5776 edges · 110 communities (86 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 175 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `296dcc30`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- MarkdownAgentAdapter
- AgentRuntimePort
- App.tsx
- Store
- ChatTurnRecord
- app.ts
- channel-manager.ts
- Store
- server/package.json
- WorkflowVersionRecord
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- input-contract.test.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- AlertService
- agents.test.ts
- FakeRuntime
- environment
- knowledge.test.ts
- channel-router.test.ts
- web/tsconfig.json
- scripts
- web/package.json
- InMemoryMetrics
- extractors.ts
- chat.ts
- web/src/api.ts
- steps
- ChatPanel.tsx
- opencode-adapter.ts
- WorkflowRunRecord
- opencode-plugin/package.json
- FakeAgentRuntime
- GrammyTransport
- ChatTurnService
- store.ts
- NotebookRecord
- tools.ts
- ProjectPage
- cron.ts
- artifacts
- compilerOptions
- validation.ts
- FakeClient
- input.ts
- AgentCatalog.tsx
- BaileysTransport
- OpenCodeV2Adapter
- ChatThreadRecord
- execute-workflow.ts
- RunQueueRepository
- WorkflowCanvasProps
- NodeInspectorModal.tsx
- IntegrationManager
- shared/package.json
- PlatformClient
- SettingsRepository
- WorkflowScheduleStateRecord
- ProjectPage.tsx
- WorkflowTimerRecord
- KbSourceRecord
- ManageIntegrationsUseCase
- SqliteStore
- WorkflowDeliveryRecord
- graph-edits.ts
- FakeAgent
- IntegrationRecord
- telemetry.ts
- agents.ts
- WorkflowCanvas.tsx
- ChatMessageRecord
- entrypoint.sh
- config.yaml
- legacy-migration.ts
- WorkflowCanvas.tsx
- EmbeddingPort
- server/tsconfig.json
- legacy-migration.ts
- KnowledgeError
- scripts
- worker-entry.ts
- shared/src/api.ts
- search-knowledge.ts
- chat-progress.ts
- FakeAgent
- opencode-plugin/tsconfig.json
- ChatTurnStatus
- shared/tsconfig.json
- bootstrap.ts
- IntegrationValidationError
- canvas-actions.ts
- RouteProjectIntegrationMessageUseCase
- setup.ts
- SessionContextRecord
- alerts.test.ts
- notify-approval.test.ts
- ProjectsPage
- integration-manager.test.ts
- AgentModelInfo
- start-server.ts
- NodeInspector.tsx
- .waitForTerminal
- createApplication
- TurnTimeoutError

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 145 edges
2. `SqliteStore` - 64 edges
3. `Store` - 63 edges
4. `Logger` - 56 edges
5. `AgentRuntimePort` - 50 edges
6. `ChatTurnService` - 47 edges
7. `IntegrationRecord` - 47 edges
8. `WorkflowGraph` - 46 edges
9. `SafeFsWorkspaceAdapter` - 42 edges
10. `WorkspacePort` - 42 edges

## Surprising Connections (you probably didn't know these)
- `LogBindings` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/telemetry/index.ts → packages/shared/src/telemetry.ts
- `ExecuteRunInput` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → packages/shared/src/workflow.ts
- `WorkflowVersionRecord` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/workflow.ts
- `WorkflowCanvasProps` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/web/src/components/WorkflowCanvas.tsx → packages/shared/src/workflow.ts
- `ChatHistoryMessage` --references--> `ChatTurnStatus`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/chat.ts

## Import Cycles
- None detected.

## Communities (110 total, 24 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.14
Nodes (9): ErrorTracker, LogBindings, redact(), createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter, sanitizeSentryEvent() (+1 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (26): integrationError(), PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy() (+18 more)

### Community 3 - "SqliteStore"
Cohesion: 0.07
Nodes (26): Application, Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, json(), logEntries, testLogger, waitForApproval() (+18 more)

### Community 4 - "MarkdownAgentAdapter"
Cohesion: 0.16
Nodes (5): ManageSubagentsUseCase, MarkdownAgentAdapter, McpServerConfig, setup(), SubagentFrontmatter

### Community 5 - "AgentRuntimePort"
Cohesion: 0.06
Nodes (21): AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), assertChatTimeoutsCoverOpenCode(), ChatTurnPolicy (+13 more)

### Community 6 - "App.tsx"
Cohesion: 0.10
Nodes (27): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+19 more)

### Community 7 - "Store"
Cohesion: 0.13
Nodes (6): AppConfig, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, Logger

### Community 9 - "app.ts"
Cohesion: 0.10
Nodes (17): AppEnv, EventBus, WorkspacePort, GetProjectSettingsUseCase, ProjectReadinessItem, readinessFor(), UpdateProjectSettingsUseCase, captureCodeBundle() (+9 more)

### Community 10 - "channel-manager.ts"
Cohesion: 0.15
Nodes (8): EgressSendResult, IntegrationEgressPort, ManagedIntegration, IntegrationEgressRouter, TelegramChannelAdapter, FakeEgress, RecordingEgress, FakeEgress

### Community 11 - "Store"
Cohesion: 0.10
Nodes (22): AgentSessionRef, ExternalDatabaseAdapter, SecretVault, Store, ConnectProviderUseCase, OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, DatabaseActionValidationError (+14 more)

### Community 12 - "server/package.json"
Cohesion: 0.06
Nodes (53): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@2.2.5 (+45 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (30): CHANNEL_CAPABILITIES, ChannelMode, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, DATABASE_CAPABILITIES, DatabaseAccessPolicy (+22 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.17
Nodes (13): apiMock, graph, renderPage(), apiMock, { project }, renderPage(), renderWithProviders(), graph (+5 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.12
Nodes (26): chatMessages, chatThreads, chatTurns, integrations, kbChunks, kbSources, notebooks, projects (+18 more)

### Community 17 - "input-contract.test.ts"
Cohesion: 0.16
Nodes (9): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, NoopErrorTracker, BunWorkerPoolAdapter, RpcMessage, dirs, logger (+1 more)

### Community 18 - "workflow.ts"
Cohesion: 0.06
Nodes (32): AgentNodeConfig, DatabaseNodeConfig, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema, InputFieldSchema, InputFieldType (+24 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.18
Nodes (8): SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), fakeExecutor(), setupScheduler(), workspace()

### Community 21 - "agents.test.ts"
Cohesion: 0.23
Nodes (7): AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), dirs, SubagentProfile

### Community 23 - "environment"
Cohesion: 0.06
Nodes (30): AGENT_CHAT_TIMEOUT_MS, AGENT_TURN_IDLE_MS, AGENT_TURN_MAX_MS, AGENT_TURN_POLL_MS, AGENT_TURN_RETRY_MS, CHAT_TURN_ENGINE, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL (+22 more)

### Community 24 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 25 - "channel-router.test.ts"
Cohesion: 0.19
Nodes (12): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist() (+4 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "web/package.json"
Cohesion: 0.06
Nodes (48): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+40 more)

### Community 29 - "InMemoryMetrics"
Cohesion: 0.14
Nodes (5): Metrics, MetricsSnapshot, InMemoryMetrics, SseHub, setup()

### Community 30 - "extractors.ts"
Cohesion: 0.19
Nodes (8): KnowledgeExtractor, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), extractDocx(), extractPdf()

### Community 31 - "chat.ts"
Cohesion: 0.09
Nodes (22): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+14 more)

### Community 32 - "web/src/api.ts"
Cohesion: 0.12
Nodes (18): ApiClientError, ApprovalRecord, attachTurnStream(), chatStream(), ChatTurnStreamError, DeliveryRecord, HealthPayload, ModelInfo (+10 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "ChatPanel.tsx"
Cohesion: 0.17
Nodes (13): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+5 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.08
Nodes (9): AgentInboxItem, createAgentRuntime(), extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, ServiceClientFactory (+1 more)

### Community 36 - "WorkflowRunRecord"
Cohesion: 0.10
Nodes (12): WorkflowRunRepository, ApprovalDecisionError, DecideApprovalUseCase, buildNodePrompt(), ExecuteRunInput, ExecuteWorkflowRunUseCase, RunState, ApprovalRecord (+4 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "ChatTurnService"
Cohesion: 0.26
Nodes (5): AgentSessionState, ChatTurnService, extractTurnReply(), isTransportError(), nowIso()

### Community 41 - "store.ts"
Cohesion: 0.12
Nodes (11): ErrorEventRepository, ProjectRepository, ProjectSettingsView, ChatTurnDeliveryState, ChatTurnEventRecord, DeliveryStatus, ErrorEventRecord, ProjectRecord (+3 more)

### Community 42 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 43 - "tools.ts"
Cohesion: 0.13
Nodes (16): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+8 more)

### Community 44 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 45 - "cron.ts"
Cohesion: 0.13
Nodes (21): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, isValidCronExpression(), matchesCron(), matchesCronInTimeZone(), matchesParts() (+13 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "validation.ts"
Cohesion: 0.26
Nodes (11): IntegrationCommand, assertIntegrationInScope(), DATABASE_KINDS, requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities() (+3 more)

### Community 50 - "input.ts"
Cohesion: 0.33
Nodes (6): checkField(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 51 - "AgentCatalog.tsx"
Cohesion: 0.09
Nodes (24): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode, toForm() (+16 more)

### Community 52 - "BaileysTransport"
Cohesion: 0.08
Nodes (6): BaileysTransport, parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp, silentLogger

### Community 53 - "OpenCodeV2Adapter"
Cohesion: 0.15
Nodes (3): AgentMessage, OpenCodeV2Adapter, parseModelRef()

### Community 54 - "ChatThreadRecord"
Cohesion: 0.16
Nodes (6): ChatThreadRepository, VaultRepository, StartChatTurnInput, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 55 - "execute-workflow.ts"
Cohesion: 0.10
Nodes (28): AgentPromptTimeoutError, evaluateCondition(), executeHttpNode(), executeTransform(), parseAndValidateAgentOutput(), computeGraphHash(), computePayloadHash(), effectiveEdges() (+20 more)

### Community 57 - "WorkflowCanvasProps"
Cohesion: 0.16
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 58 - "NodeInspectorModal.tsx"
Cohesion: 0.14
Nodes (17): ProjectSettingsView, StepRun, GraphIssue, nodeIssues(), conditionLabel(), defaultBranch(), edgeSourceLabel(), edgeTargetLabel() (+9 more)

### Community 59 - "IntegrationManager"
Cohesion: 0.18
Nodes (4): deliverWebhook(), signWebhook(), IntegrationManager, WhatsAppChannelAdapter

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 64 - "ProjectPage.tsx"
Cohesion: 0.09
Nodes (44): api, RunRecord, ControlChannelsPanel(), KINDS, ProjectKnowledgePanel(), CHANNEL_KINDS, DATABASE_KINDS, DatabasePolicyEditor() (+36 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "ManageIntegrationsUseCase"
Cohesion: 0.26
Nodes (5): hashIntegrationKey(), ManageIntegrationsUseCase, withDatabaseDefaults(), useCase(), IntegrationScope

### Community 68 - "SqliteStore"
Cohesion: 0.16
Nodes (7): DatabaseHandle, createStore(), parse(), SqliteStore, captureLogger(), dirs, setup()

### Community 70 - "graph-edits.ts"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 72 - "IntegrationRecord"
Cohesion: 0.15
Nodes (4): IntegrationManagerPort, IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 73 - "telemetry.ts"
Cohesion: 0.10
Nodes (18): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, ChatHealthSummary, ChatHealthSummarySchema, EntryPointTypeSchema (+10 more)

### Community 74 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 75 - "WorkflowCanvas.tsx"
Cohesion: 0.14
Nodes (19): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+11 more)

### Community 76 - "ChatMessageRecord"
Cohesion: 0.24
Nodes (4): ChatRepository, TurnFailureError, ChatMessageRecord, ChatTurnErrorCode

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "legacy-migration.ts"
Cohesion: 0.16
Nodes (14): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+6 more)

### Community 80 - "WorkflowCanvas.tsx"
Cohesion: 0.21
Nodes (11): resolveConnection(), edgeTypes, EMPTY_ISSUES, nodeTypes, RunProgress, subtitle(), toEdges(), toNodes() (+3 more)

### Community 81 - "EmbeddingPort"
Cohesion: 0.25
Nodes (7): EmbeddingPort, buildGroundedContext(), cosineSimilarity(), createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 84 - "KnowledgeError"
Cohesion: 0.27
Nodes (3): KnowledgeFilePort, KnowledgeError, KnowledgeFileStore

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "shared/src/api.ts"
Cohesion: 0.12
Nodes (16): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+8 more)

### Community 89 - "chat-progress.ts"
Cohesion: 0.30
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "ChatTurnStatus"
Cohesion: 0.16
Nodes (8): ChatTurnResult, ChatTurnActions, ChatTurnConnection, ChatTurnController, statusFromEvent(), useChatTurn(), ChatTurnEvent, ChatTurnStatus

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 94 - "bootstrap.ts"
Cohesion: 0.20
Nodes (8): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing()

### Community 95 - "IntegrationValidationError"
Cohesion: 0.38
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 96 - "canvas-actions.ts"
Cohesion: 0.16
Nodes (7): CanvasActions, CanvasActionsContext, useCanvasActions(), PlatformEdge(), PlatformEdgeData, PlatformFlowEdge, @xyflow/react

### Community 98 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 101 - "notify-approval.test.ts"
Cohesion: 0.39
Nodes (5): NotifyApprovalUseCase, FakeEgress, integration(), logger(), setup()

### Community 102 - "ProjectsPage"
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

### Community 106 - "NodeInspector.tsx"
Cohesion: 0.18
Nodes (13): ExecuteDatabaseActionInput, CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS, InputFieldsEditor() (+5 more)

### Community 112 - "createApplication"
Cohesion: 0.12
Nodes (10): createApplication(), resolveProjectRouteTool(), safeEqual(), ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, ChatWithProjectUseCase, withTimeout() (+2 more)

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 749 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `createApplication` to `logger.ts`, `auth-routes.ts`, `SqliteStore`, `MarkdownAgentAdapter`, `AgentRuntimePort`, `Store`, `ChatTurnRecord`, `app.ts`, `channel-manager.ts`, `Store`, `server/package.json`, `input-contract.test.ts`, `SafeFsWorkspaceAdapter`, `AlertService`, `agents.test.ts`, `InMemoryMetrics`, `extractors.ts`, `opencode-adapter.ts`, `WorkflowRunRecord`, `ChatTurnService`, `NotebookRecord`, `tools.ts`, `cron.ts`, `execute-workflow.ts`, `IntegrationManager`, `ManageIntegrationsUseCase`, `SqliteStore`, `EmbeddingPort`, `KnowledgeError`, `search-knowledge.ts`, `ChatTurnStatus`, `bootstrap.ts`, `IntegrationValidationError`, `RouteProjectIntegrationMessageUseCase`, `notify-approval.test.ts`, `start-server.ts`, `.waitForTerminal`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Are the 74 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 74 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13756613756613756 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `SqliteStore`, `MarkdownAgentAdapter`, `opencode-adapter.ts`, `FakeAgentRuntime`, `Store`, `FakeAgent`, `app.ts`, `Store`, `input-contract.test.ts`, `OpenCodeV2Adapter`, `FakeRuntime`, `execute-workflow.ts`, `FakeAgent`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0750151240169389 - nodes in this community are weakly interconnected._
- **Why does `WorkflowGraph` connect `app.ts` to `SqliteStore`, `WorkflowVersionRecord`, `ui.test.tsx`, `sqlite-store.ts`, `input-contract.test.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `web/src/api.ts`, `WorkflowRunRecord`, `store.ts`, `cron.ts`, `AgentCatalog.tsx`, `execute-workflow.ts`, `WorkflowCanvasProps`, `NodeInspectorModal.tsx`, `ProjectPage.tsx`, `graph-edits.ts`, `WorkflowCanvas.tsx`, `WorkflowCanvas.tsx`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._