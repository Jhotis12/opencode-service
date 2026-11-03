# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 214 files · ~249,823 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2028 nodes · 5288 edges · 98 communities (80 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad9f47a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- LogBindings
- HttpPlatformClient
- auth-routes.ts
- SqliteStore
- agents.test.ts
- bootstrap.ts
- App.tsx
- manage-integrations.ts
- react
- shared/src/index.ts
- IntegrationEgressPort
- IntegrationValidationError
- server/package.json
- NodeInspectorModal.tsx
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
- WorkflowRunRecord
- RouteProjectIntegrationMessageUseCase
- web/tsconfig.json
- scripts
- shared/src/api.ts
- web/package.json
- knowledge.test.ts
- chat.ts
- setup.ts
- steps
- web/src/api.ts
- opencode-adapter.ts
- send-notification.ts
- opencode-plugin/package.json
- AgentRuntimePort
- GrammyTransport
- legacy-migration.ts
- chat-recovery.test.ts
- Store
- tools.ts
- cron.ts
- WorkflowVersionRecord
- artifacts
- compilerOptions
- execute-workflow.ts
- FakeClient
- input.ts
- EmbeddingPort
- execute-workflow.test.ts
- SessionContextRecord
- ChatThreadRecord
- migrate.ts
- RunQueueRepository
- ProjectRecord
- NotebookRecord
- app.ts
- shared/package.json
- PlatformClient
- store.ts
- WorkflowScheduleStateRecord
- WorkflowRunRepository
- WorkflowTimerRecord
- KbSourceRecord
- entities.ts
- extractors.ts
- WorkflowDeliveryRecord
- OpenCodeV2Adapter
- IntegrationManagerPort
- ChatPanel.tsx
- telemetry.ts
- FakeAgentRuntime
- WorkflowCanvas.tsx
- ErrorBoundary
- entrypoint.sh
- config.yaml
- alerts.ts
- FakeAgent
- worker-pool.test.ts
- server/tsconfig.json
- FakeAgent
- chat-progress.ts
- scripts
- worker-entry.ts
- ControlChannelsPanel
- .start
- contracts.test.ts
- src/events.ts
- opencode-plugin/tsconfig.json
- createAgentRuntime
- shared/tsconfig.json
- ErrorEventRecord
- migrate-legacy.ts
- CanvasActions
- json

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 130 edges
2. `Store` - 61 edges
3. `SqliteStore` - 56 edges
4. `Logger` - 54 edges
5. `IntegrationRecord` - 47 edges
6. `SafeFsWorkspaceAdapter` - 42 edges
7. `WorkspacePort` - 42 edges
8. `AgentRuntimePort` - 41 edges
9. `WorkflowGraph` - 39 edges
10. `ProjectPage()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `WorkflowRunRecord` --references--> `EntryPointType`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/telemetry.ts
- `ProjectSettingsView` --references--> `IntegrationRecord`  [EXTRACTED]
  apps/web/src/api.ts → packages/shared/src/integrations.ts
- `WorkflowVersionRecord` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/workflow.ts
- `IntegrationRecord` --references--> `IntegrationStatus`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts
- `WorkflowCanvasProps` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/web/src/components/WorkflowCanvas.tsx → packages/shared/src/workflow.ts

## Import Cycles
- None detected.

## Communities (98 total, 18 thin omitted)

### Community 0 - "LogBindings"
Cohesion: 0.08
Nodes (13): ErrorTracker, LogBindings, Metrics, MetricsSnapshot, redact(), SECRET_KEY_PATTERN, InMemoryMetrics, createMemoryLogger() (+5 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy(), MIN_PASSWORD_LENGTH (+17 more)

### Community 3 - "SqliteStore"
Cohesion: 0.09
Nodes (18): ExecuteDatabaseActionUseCase, GetProjectSettingsUseCase, UpdateProjectSettingsUseCase, SqliteStore, createLogger(), PROJECT_ISOLATION_PERMISSIONS, dirs, integration() (+10 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.08
Nodes (23): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+15 more)

### Community 5 - "bootstrap.ts"
Cohesion: 0.11
Nodes (15): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+7 more)

### Community 6 - "App.tsx"
Cohesion: 0.11
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "manage-integrations.ts"
Cohesion: 0.21
Nodes (9): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), createExternalChatRoutes(), cleanups, fakeManager (+1 more)

### Community 8 - "react"
Cohesion: 0.09
Nodes (52): api, AgentFormState, AgentMode, KINDS, ModalSize, SIZE_CLASS, ProjectKnowledgePanel(), CHANNEL_KINDS (+44 more)

### Community 9 - "shared/src/index.ts"
Cohesion: 0.11
Nodes (13): EventBus, WorkspacePort, captureCodeBundle(), CreateProjectUseCase, DeleteProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk() (+5 more)

### Community 10 - "IntegrationEgressPort"
Cohesion: 0.15
Nodes (8): EgressSendResult, IntegrationEgressPort, ManagedIntegration, IntegrationEgressRouter, TelegramChannelAdapter, FakeEgress, RecordingEgress, FakeEgress

### Community 11 - "IntegrationValidationError"
Cohesion: 0.13
Nodes (14): ConnectProviderUseCase, databaseConfig(), OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult (+6 more)

### Community 12 - "server/package.json"
Cohesion: 0.05
Nodes (55): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+47 more)

### Community 13 - "NodeInspectorModal.tsx"
Cohesion: 0.08
Nodes (27): ModelInfo, nodeIssues(), CodeEditor(), FallbackEditor(), Monaco, DATABASE_KINDS, DatabaseNodeFields(), HTTP_KINDS (+19 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (30): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, CreateIntegrationInputSchema, DATABASE_CAPABILITIES, DatabaseAccessPolicy, defaultRouting (+22 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.11
Nodes (21): formatDate(), ProjectsPage(), onNameChange(), slugify(), apiMock, primary, renderCatalog(), subagent (+13 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.14
Nodes (23): AppDatabase, DatabaseHandle, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks (+15 more)

### Community 17 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 18 - "workflow.ts"
Cohesion: 0.06
Nodes (32): AgentNodeConfig, DatabaseNodeConfig, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema, InputFieldSchema, InputFieldType (+24 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.10
Nodes (22): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeGlobalMessage(), routeProjectMessage(), senderMatchesAllowlist() (+14 more)

### Community 20 - "ProjectPage"
Cohesion: 0.07
Nodes (36): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+28 more)

### Community 21 - "channel-adapters.test.ts"
Cohesion: 0.10
Nodes (5): parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp, silentLogger

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "WorkflowRunRecord"
Cohesion: 0.32
Nodes (4): ExecuteWorkflowRunUseCase, WorkflowRunRecord, nextEdge(), WorkflowRunStatus

### Community 25 - "RouteProjectIntegrationMessageUseCase"
Cohesion: 0.30
Nodes (3): IncomingIntegrationMessage, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase

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
Cohesion: 0.06
Nodes (47): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+39 more)

### Community 30 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

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
Cohesion: 0.12
Nodes (18): ApiClientError, ApprovalRecord, chatStream(), DeliveryRecord, HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem (+10 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.10
Nodes (6): AgentPromptTimeoutError, extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 36 - "send-notification.ts"
Cohesion: 0.15
Nodes (9): NotifyApprovalUseCase, SendNotificationInput, SendNotificationResult, SendNotificationUseCase, SUPPORTED_CHANNELS, FakeEgress, integration(), logger() (+1 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "AgentRuntimePort"
Cohesion: 0.15
Nodes (6): AgentRuntimePort, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext()

### Community 39 - "GrammyTransport"
Cohesion: 0.12
Nodes (4): IntegrationTransport, GrammyTransport, TelegramTransport, FakeTelegram

### Community 40 - "legacy-migration.ts"
Cohesion: 0.22
Nodes (13): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+5 more)

### Community 41 - "chat-recovery.test.ts"
Cohesion: 0.10
Nodes (14): ChatRepository, ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview, resolveOrchestratorModel(), ChatWithProjectUseCase, ChatMessageRecord (+6 more)

### Community 42 - "Store"
Cohesion: 0.20
Nodes (6): ExternalDatabaseAdapter, SecretVault, Store, ExecutorDeps, Logger, ExternalChatRouteDeps

### Community 43 - "tools.ts"
Cohesion: 0.14
Nodes (15): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+7 more)

### Community 44 - "cron.ts"
Cohesion: 0.16
Nodes (16): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), nextCronDate() (+8 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "execute-workflow.ts"
Cohesion: 0.13
Nodes (9): buildNodePrompt(), evaluateCondition(), ExecuteRunInput, executeTransform(), RunState, renderParams(), renderTemplate(), resolvePath() (+1 more)

### Community 50 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 51 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 52 - "execute-workflow.test.ts"
Cohesion: 0.17
Nodes (14): executeHttpNode(), isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), RunInFlightError, stableStringify() (+6 more)

### Community 54 - "ChatThreadRecord"
Cohesion: 0.17
Nodes (5): ChatThreadRepository, VaultRepository, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 55 - "migrate.ts"
Cohesion: 0.31
Nodes (8): openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf(), migrate(), SQLITE_DDL, tableExists(), now

### Community 57 - "ProjectRecord"
Cohesion: 0.21
Nodes (5): ProjectRepository, ProjectReadinessItem, ProjectSettingsView, readinessFor(), ProjectRecord

### Community 58 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 59 - "app.ts"
Cohesion: 0.07
Nodes (18): AppConfig, AppEnv, Application, createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), ApprovalDecisionError (+10 more)

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "store.ts"
Cohesion: 0.23
Nodes (5): AgentSessionRef, SettingsRepository, ENTRY_POINTS, validateWorkflowResources(), ChannelRoutingSchema

### Community 64 - "WorkflowRunRepository"
Cohesion: 0.13
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, StepStatus

### Community 65 - "WorkflowTimerRecord"
Cohesion: 0.18
Nodes (4): WorkflowTimerRepository, WorkflowTimerRecord, workflowTimers, parse()

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "entities.ts"
Cohesion: 0.12
Nodes (19): IntegrationRepository, hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand, ManageIntegrationsUseCase, DeliveryStatus, IntegrationRecord, assertIntegrationInScope() (+11 more)

### Community 68 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 69 - "WorkflowDeliveryRecord"
Cohesion: 0.36
Nodes (3): WorkflowDeliveryRepository, WorkflowDeliveryRecord, workflowDeliveries

### Community 72 - "ChatPanel.tsx"
Cohesion: 0.18
Nodes (12): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+4 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointTypeSchema, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 75 - "WorkflowCanvas.tsx"
Cohesion: 0.07
Nodes (42): @xyflow/react@^12.3.6, AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), GraphIssue (+34 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "alerts.ts"
Cohesion: 0.13
Nodes (7): AlertService, redact(), SseHub, FakeEgress, logger, FakeEvents, SseEvent

### Community 81 - "worker-pool.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 84 - "chat-progress.ts"
Cohesion: 0.28
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 89 - "contracts.test.ts"
Cohesion: 0.20
Nodes (9): AgentNodeConfigSchema, DatabaseNodeConfigSchema, NodeErrorPolicySchema, NodeSpecSchema, NotifyNodeConfigSchema, ProjectTemplateSchema, TriggerConfigSchema, WorkflowVersionSchema (+1 more)

### Community 90 - "src/events.ts"
Cohesion: 0.22
Nodes (7): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, StepStatusSchema, WorkflowGraphSchema

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "createAgentRuntime"
Cohesion: 0.33
Nodes (3): createAgentRuntime(), OpenCodeClientFactory, ServiceClientFactory

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 94 - "ErrorEventRecord"
Cohesion: 0.50
Nodes (3): ErrorEventRepository, ErrorEventRecord, EntryPointType

### Community 95 - "migrate-legacy.ts"
Cohesion: 0.50
Nodes (3): [databasePath, mappingPath, backupPath], mapping, sqlite

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 700 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `shared/src/index.ts` to `web/src/api.ts`, `entities.ts`, `SqliteStore`, `react`, `WorkflowCanvas.tsx`, `WorkflowVersionRecord`, `NodeInspectorModal.tsx`, `ui.test.tsx`, `sqlite-store.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `execute-workflow.test.ts`, `ProjectPage`, `ProjectRecord`, `app.ts`, `store.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Are the 65 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 65 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `LogBindings` be split into smaller, more focused modules?**
  _Cohesion score 0.0797979797979798 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `app.ts` to `LogBindings`, `auth-routes.ts`, `SqliteStore`, `agents.test.ts`, `bootstrap.ts`, `manage-integrations.ts`, `shared/src/index.ts`, `IntegrationEgressPort`, `IntegrationValidationError`, `server/package.json`, `search-knowledge.ts`, `SafeFsWorkspaceAdapter`, `WorkflowRunRecord`, `RouteProjectIntegrationMessageUseCase`, `send-notification.ts`, `AgentRuntimePort`, `chat-recovery.test.ts`, `cron.ts`, `EmbeddingPort`, `ProjectRecord`, `NotebookRecord`, `store.ts`, `entities.ts`, `extractors.ts`, `alerts.ts`, `worker-pool.test.ts`, `chat-progress.ts`, `createAgentRuntime`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07683000604960677 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ui.test.tsx` to `setup.ts`, `App.tsx`, `react`, `WorkflowCanvas.tsx`, `NodeInspectorModal.tsx`, `ProjectPage`, `web/package.json`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._