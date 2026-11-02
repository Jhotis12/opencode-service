# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 199 files · ~211,138 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1800 nodes · 4651 edges · 97 communities (84 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9cb87de3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- input-contract.test.ts
- agents.test.ts
- NodeInspectorModal.tsx
- App.tsx
- WhatsAppCloudTransport
- ui.ts
- AgentRuntimePort
- WorkflowGraph
- ingest-knowledge.ts
- dependencies
- IntegrationEgressPort
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- WorkflowGraph
- workflow.ts
- SafeFsWorkspaceAdapter
- PlatformNode.tsx
- Logger
- ProjectPage
- environment
- IntegrationRecord
- store.ts
- web/tsconfig.json
- scripts
- WorkflowCanvas
- route-channel-message.ts
- NotebookRecord
- execute-workflow.test.ts
- web/package.json
- steps
- bootstrap.ts
- opencode-adapter.ts
- graph-edits.ts
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- GrammyTransport
- execute-workflow.ts
- ui.ts
- IntegrationValidationError
- WorkflowRunRecord
- cron.ts
- setup.ts
- artifacts
- compilerOptions
- legacy-migration.ts
- dynamic-adapter.ts
- ExecutorDeps
- ExecuteWorkflowRunUseCase
- extractors.ts
- ChatPanel.tsx
- chat.ts
- NodeInspector.tsx
- FakeAgentRuntime
- input.ts
- NotebookRecord
- IntegrationManager
- shared/package.json
- agents.ts
- validation.ts
- EntityScope
- FakeAgent
- shared/src/api.ts
- KbSourceRecord
- web/src/api.ts
- knowledge.test.ts
- SseEvent
- connections.test.ts
- ChatProgressEvent
- external-chat.ts
- telemetry.ts
- BaileysTransport
- EmbeddingPort
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- IntegrationManagerPort
- src/events.ts
- server/package.json
- server/tsconfig.json
- IntegrationTransport
- chunking.ts
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- ErrorBoundary
- opencode-plugin/tsconfig.json
- shared/tsconfig.json
- extractDocx
- extractPdf
- mssql
- mysql2

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 124 edges
2. `Store` - 53 edges
3. `IntegrationRecord` - 44 edges
4. `SqliteStore` - 43 edges
5. `WorkflowGraph` - 43 edges
6. `WorkspacePort` - 42 edges
7. `Logger` - 42 edges
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

## Communities (97 total, 13 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.07
Nodes (17): Application, ErrorEventRepository, ErrorEventRecord, ErrorTracker, LogBindings, Metrics, MetricsSnapshot, redact() (+9 more)

### Community 1 - "HttpPlatformClient"
Cohesion: 0.06
Nodes (15): setup(), agentSegment, createPlatformTools(), HttpPlatformClient, objectSchema(), PlatformClient, PlatformClientScope, PlatformTool (+7 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.07
Nodes (30): AppEnv, integrationError(), PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord (+22 more)

### Community 3 - "input-contract.test.ts"
Cohesion: 0.10
Nodes (14): dirs, silentLogger, trigger, dirs, logger, dirs, logger, dirs (+6 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.12
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "NodeInspectorModal.tsx"
Cohesion: 0.16
Nodes (15): StepRun, nodeIssues(), conditionLabel(), defaultBranch(), edgeSourceLabel(), edgeTargetLabel(), InspectorTab, NodeInspectorModal() (+7 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (24): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+16 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.08
Nodes (7): TelegramTransport, parseCloudWebhook(), WhatsAppCloudTransport, WhatsAppTransport, FakeTelegram, FakeWhatsApp, silentLogger

### Community 8 - "ui.ts"
Cohesion: 0.16
Nodes (23): api, ControlChannelsPanel(), KINDS, ProjectKnowledgePanel(), KIND_OPTIONS, kindLabel(), ProjectResourcesPanel(), ProjectSettingsPanel() (+15 more)

### Community 9 - "AgentRuntimePort"
Cohesion: 0.09
Nodes (10): AgentRuntimePort, AgentSessionRef, ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), ConnectProviderUseCase, GetHealthUseCase (+2 more)

### Community 10 - "WorkflowGraph"
Cohesion: 0.12
Nodes (9): ProjectRepository, Store, GetProjectSettingsUseCase, ProjectReadinessItem, ProjectSettingsView, readinessFor(), UpdateProjectSettingsUseCase, DeleteProjectUseCase (+1 more)

### Community 11 - "ingest-knowledge.ts"
Cohesion: 0.29
Nodes (4): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, KnowledgeFileStore

### Community 12 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, @opencode/client@^2.2.5, pg@^8.13.1, pino@^9.6.0, @platform/shared@workspace:* (+9 more)

### Community 13 - "IntegrationEgressPort"
Cohesion: 0.18
Nodes (5): IntegrationEgressPort, ChannelRouterDeps, IntegrationEgressRouter, FakeEgress, FakeEgress

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (28): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES (+20 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.14
Nodes (18): apiMock, primary, renderCatalog(), subagent, css, apiMock, graph, renderPage() (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.10
Nodes (24): AppDatabase, DatabaseHandle, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks (+16 more)

### Community 17 - "WorkflowGraph"
Cohesion: 0.11
Nodes (12): WorkflowVersionRepository, WorkspacePort, captureCodeBundle(), CreateProjectUseCase, RollbackWorkflowVersionUseCase, SaveWorkflowUseCase, syncProjectsFromDisk(), withTimeout() (+4 more)

### Community 18 - "workflow.ts"
Cohesion: 0.11
Nodes (17): AgentNodeConfig, EdgeSchema, InputFieldSchema, InputFieldType, InputFieldTypeSchema, InputSchemaSchema, NodeTypeSchema, RunProvenance (+9 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.14
Nodes (9): NoopErrorTracker, SafeFsWorkspaceAdapter, WorkspaceError, FakeEgress, setup(), setup(), setup(), setup() (+1 more)

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.16
Nodes (17): NodePaletteModal(), ShapePreview(), NODE_CATALOG, NODE_CATEGORY_COLORS, NODE_META, PALETTE_GROUPS, NodeIcon(), NODE_SHAPES (+9 more)

### Community 21 - "Logger"
Cohesion: 0.15
Nodes (5): AppConfig, EventBus, Logger, ManagedIntegration, TelegramChannelAdapter

### Community 22 - "ProjectPage"
Cohesion: 0.25
Nodes (15): ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge(), duplicateNode() (+7 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (21): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN (+13 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.29
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 25 - "store.ts"
Cohesion: 0.13
Nodes (6): ChatRepository, ChatThreadRepository, SettingsRepository, ChatWithProjectUseCase, ChatMessageRecord, ChatThreadRecord

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "WorkflowCanvas"
Cohesion: 0.08
Nodes (22): GraphIssue, CanvasActionsContext, useCanvasActions(), ConnectRole, PlatformFlowNode, PlatformEdge(), PlatformEdgeData, PlatformFlowEdge (+14 more)

### Community 29 - "route-channel-message.ts"
Cohesion: 0.16
Nodes (13): IncomingIntegrationMessage, TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, ApprovalCommand, normalizeSender(), parseApprovalCommand() (+5 more)

### Community 30 - "NotebookRecord"
Cohesion: 0.21
Nodes (5): IngestKnowledgeUseCase, summarize(), htmlToMarkdown(), KnowledgeError, setup()

### Community 31 - "execute-workflow.test.ts"
Cohesion: 0.19
Nodes (13): isValidCronExpression(), computeGraphHash(), computePayloadHash(), IdempotencyMismatchError, reachableFrom(), RunInFlightError, stableStringify(), startNode() (+5 more)

### Community 32 - "web/package.json"
Cohesion: 0.06
Nodes (46): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-router-dom@^7.1.1 (+38 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "bootstrap.ts"
Cohesion: 0.15
Nodes (12): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+4 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.08
Nodes (10): createAgentRuntime(), extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, OpenCodeV2Adapter, ServiceClientFactory (+2 more)

### Community 36 - "graph-edits.ts"
Cohesion: 0.19
Nodes (14): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+6 more)

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 40 - "execute-workflow.ts"
Cohesion: 0.29
Nodes (10): buildNodePrompt(), evaluateCondition(), executeHttpNode(), executeTransform(), parseAndValidateAgentOutput(), renderTemplate(), resolvePath(), templateValue() (+2 more)

### Community 41 - "ui.ts"
Cohesion: 0.07
Nodes (37): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), AgentFormState, AgentMode, toForm() (+29 more)

### Community 42 - "IntegrationValidationError"
Cohesion: 0.21
Nodes (6): ExternalDatabaseAdapter, databaseConfig(), OPENCODE_GO_PROVIDER_ID, QueryDatabaseIntegrationUseCase, TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 43 - "WorkflowRunRecord"
Cohesion: 0.14
Nodes (8): WorkflowRunRepository, ExecuteRunInput, RunState, ApprovalRecord, StepRunRecord, WorkflowRunRecord, StepStatus, WorkflowRunStatus

### Community 44 - "cron.ts"
Cohesion: 0.27
Nodes (6): cronMinuteKey(), FIELD_RANGES, matchesCron(), parseCronField(), parseFieldToken(), WorkflowScheduler

### Community 45 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "legacy-migration.ts"
Cohesion: 0.11
Nodes (24): [databasePath, mappingPath, backupPath], mapping, sqlite, openDatabase(), channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable() (+16 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "ExecutorDeps"
Cohesion: 0.23
Nodes (8): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, ExecutorDeps, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 52 - "extractors.ts"
Cohesion: 0.27
Nodes (4): ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf()

### Community 53 - "ChatPanel.tsx"
Cohesion: 0.17
Nodes (13): react-markdown@^9.0.3, ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface (+5 more)

### Community 54 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 55 - "NodeInspector.tsx"
Cohesion: 0.33
Nodes (7): ModelInfo, CodeEditor(), FallbackEditor(), Monaco, InputFieldsEditor(), NodeInspector(), ValidateRulesEditor()

### Community 57 - "input.ts"
Cohesion: 0.27
Nodes (8): checkField(), NodeValidationError, validateNodeRules(), valueAt(), InputField, InputSchema, ValidateConfig, ValidateRule

### Community 59 - "IntegrationManager"
Cohesion: 0.20
Nodes (4): createApplication(), resolveProjectRouteTool(), safeEqual(), IntegrationManager

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 62 - "validation.ts"
Cohesion: 0.24
Nodes (12): IntegrationCommand, IntegrationUpdateCommand, assertIntegrationInScope(), requiredSecretRefs(), ValidatedIntegrationInput, validateIntegrationInput(), manager, useCase() (+4 more)

### Community 63 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 65 - "shared/src/api.ts"
Cohesion: 0.12
Nodes (15): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+7 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "web/src/api.ts"
Cohesion: 0.16
Nodes (14): ApiClientError, chatStream(), HealthPayload, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView, ProjectSummary (+6 more)

### Community 68 - "knowledge.test.ts"
Cohesion: 0.21
Nodes (6): buildGroundedContext(), ipv4Parts(), isPrivateAddress(), Resolver, UnsafeUrlError, dirs

### Community 69 - "SseEvent"
Cohesion: 0.15
Nodes (6): AlertService, redact(), SseHub, logger, FakeEvents, SseEvent

### Community 70 - "connections.test.ts"
Cohesion: 0.08
Nodes (4): AgentModelInfo, dirs, FakeRuntime, FakeAgent

### Community 71 - "ChatProgressEvent"
Cohesion: 0.39
Nodes (5): createChatProgressHandler(), fileText(), RawAgentEvent, toolText(), ChatProgressEvent

### Community 72 - "external-chat.ts"
Cohesion: 0.20
Nodes (13): SecretVault, ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), hashIntegrationKey(), verifyIntegrationKey(), assertSafeUrl() (+5 more)

### Community 73 - "telemetry.ts"
Cohesion: 0.18
Nodes (10): EntryPointTypeSchema, ErrorEvent, ErrorEventSchema, HealthSnapshotSchema, HealthStatus, HealthStatusSchema, MetricsSummary, MetricsSummarySchema (+2 more)

### Community 75 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 76 - "search-knowledge.ts"
Cohesion: 0.54
Nodes (3): KnowledgeSearchResult, SearchKnowledgeUseCase, cosineSimilarity()

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 80 - "src/events.ts"
Cohesion: 0.22
Nodes (7): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, StepStatusSchema, WorkflowGraphSchema

### Community 81 - "server/package.json"
Cohesion: 0.17
Nodes (14): @sentry/bun@^9.0.0, devDependencies, @types/bun@latest, @types/mssql@^9.1.7, @types/pg@^8.11.10, typescript@^5.7.2, @types/bun, typescript (+6 more)

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 84 - "chunking.ts"
Cohesion: 0.50
Nodes (4): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText()

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
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 96 - "extractDocx"
Cohesion: 0.67
Nodes (3): mammoth@^1.9.0, extractDocx(), mammoth

### Community 97 - "extractPdf"
Cohesion: 0.67
Nodes (3): unpdf@^0.12.1, extractPdf(), unpdf

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 626 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `WorkflowGraph` to `logger.ts`, `auth-routes.ts`, `input-contract.test.ts`, `NodeInspectorModal.tsx`, `ui.ts`, `WorkflowGraph`, `ui.test.tsx`, `sqlite-store.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `store.ts`, `WorkflowCanvas`, `execute-workflow.test.ts`, `graph-edits.ts`, `execute-workflow.ts`, `ui.ts`, `WorkflowRunRecord`, `ExecuteWorkflowRunUseCase`, `validation.ts`, `web/src/api.ts`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06748911465892599 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `IntegrationManager` to `logger.ts`, `HttpPlatformClient`, `auth-routes.ts`, `input-contract.test.ts`, `agents.test.ts`, `AgentRuntimePort`, `WorkflowGraph`, `ingest-knowledge.ts`, `IntegrationEgressPort`, `sqlite-store.ts`, `WorkflowGraph`, `SafeFsWorkspaceAdapter`, `store.ts`, `route-channel-message.ts`, `NotebookRecord`, `execute-workflow.test.ts`, `bootstrap.ts`, `opencode-adapter.ts`, `ManageIntegrationsUseCase`, `IntegrationValidationError`, `cron.ts`, `dynamic-adapter.ts`, `ExecutorDeps`, `ExecuteWorkflowRunUseCase`, `extractors.ts`, `knowledge.test.ts`, `SseEvent`, `external-chat.ts`, `EmbeddingPort`, `search-knowledge.ts`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `HttpPlatformClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05673076923076923 - nodes in this community are weakly interconnected._
- **Why does `ProjectPage()` connect `ProjectPage` to `graph-edits.ts`, `NodeInspectorModal.tsx`, `App.tsx`, `ui.ts`, `ui.ts`, `ui.test.tsx`, `PlatformNode.tsx`, `ChatPanel.tsx`, `WorkflowCanvas`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._