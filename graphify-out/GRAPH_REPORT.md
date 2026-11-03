# Graph Report - Opencode-server  (2026-11-02)

## Corpus Check
- 202 files · ~218,367 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 1820 nodes · 4718 edges · 92 communities (72 shown, 20 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e89d0c10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth-routes.ts
- input-contract.test.ts
- agents.test.ts
- web/src/api.ts
- App.tsx
- WhatsAppCloudTransport
- ui.ts
- AgentRuntimePort
- ProjectRecord
- shared/src/index.ts
- server/package.json
- devDependencies
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- WorkflowGraph
- workflow.ts
- SafeFsWorkspaceAdapter
- PlatformNode.tsx
- channel-manager.ts
- OpenCodeV2Adapter
- environment
- IntegrationRecord
- ChatThreadRecord
- web/tsconfig.json
- scripts
- ProjectPage
- route-channel-message.ts
- legacy-migration.ts
- orchestrator-turn.test.ts
- web/package.json
- steps
- bootstrap.ts
- opencode-adapter.ts
- FakeAgent
- opencode-plugin/package.json
- ManageIntegrationsUseCase
- GrammyTransport
- execute-workflow.ts
- AgentCatalog.tsx
- IntegrationValidationError
- LogBindings
- app.ts
- setup.ts
- artifacts
- compilerOptions
- migrate.ts
- dynamic-adapter.ts
- ExecutorDeps
- Store
- AgentModelInfo
- ChatPanel.tsx
- chat.ts
- CodeEditor.tsx
- NoopErrorTracker
- input.ts
- NotebookRecord
- IntegrationManager
- shared/package.json
- agents.ts
- entities.ts
- EntityScope
- FakeAgent
- shared/src/api.ts
- KbSourceRecord
- validation.ts
- knowledge.test.ts
- SseEvent
- FakeRuntime
- ServiceClientFactory
- external-chat.ts
- telemetry.ts
- .mapRun
- vite.config.ts
- search-knowledge.ts
- entrypoint.sh
- config.yaml
- IntegrationManagerPort
- SettingsRepository
- ControlChannelsPanel
- server/tsconfig.json
- json
- scripts
- worker-entry.ts
- scripts
- CanvasActions
- ProjectsPage
- ErrorBoundary
- opencode-plugin/tsconfig.json
- shared/tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 125 edges
2. `Store` - 53 edges
3. `SqliteStore` - 45 edges
4. `IntegrationRecord` - 44 edges
5. `Logger` - 44 edges
6. `WorkflowGraph` - 43 edges
7. `WorkspacePort` - 42 edges
8. `AgentRuntimePort` - 40 edges
9. `SafeFsWorkspaceAdapter` - 40 edges
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
- `IntegrationRecord` --references--> `IntegrationCapability`  [EXTRACTED]
  apps/server/src/domain/entities.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (92 total, 20 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.18
Nodes (7): @sentry/bun@^9.0.0, redact(), createMemoryLogger(), LoggerOptions, sanitizeSentryEvent(), SentryErrorTracker, @sentry/bun

### Community 1 - "HttpPlatformClient"
Cohesion: 0.06
Nodes (16): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, HttpPlatformClient, objectSchema(), PlatformClient, PlatformClientScope (+8 more)

### Community 2 - "auth-routes.ts"
Cohesion: 0.08
Nodes (25): PasswordHasher, UserRepository, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, UserRecord, assertPasswordPolicy(), MIN_PASSWORD_LENGTH (+17 more)

### Community 3 - "input-contract.test.ts"
Cohesion: 0.08
Nodes (15): ConnectProviderUseCase, QueryDatabaseIntegrationUseCase, SqliteStore, dirs, FakeEgress, logger, dirs, cleanups (+7 more)

### Community 4 - "agents.test.ts"
Cohesion: 0.11
Nodes (12): ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter, McpServerConfig (+4 more)

### Community 5 - "web/src/api.ts"
Cohesion: 0.07
Nodes (34): ApiClientError, chatStream(), HealthPayload, ModelInfo, NotebookSummary, OrchestratorOverview, ProjectReadinessItem, ProjectSettingsView (+26 more)

### Community 6 - "App.tsx"
Cohesion: 0.11
Nodes (26): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+18 more)

### Community 7 - "WhatsAppCloudTransport"
Cohesion: 0.09
Nodes (4): BaileysTransport, WhatsAppCloudTransport, WhatsAppTransport, FakeWhatsApp

### Community 8 - "ui.ts"
Cohesion: 0.12
Nodes (38): api, AgentFormState, AgentMode, KINDS, KIND_OPTIONS, kindLabel(), ProjectResourcesPanel(), ProjectSettingsPanel() (+30 more)

### Community 9 - "AgentRuntimePort"
Cohesion: 0.10
Nodes (18): AgentRuntimePort, AgentSessionRef, commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName() (+10 more)

### Community 11 - "shared/src/index.ts"
Cohesion: 0.22
Nodes (5): ChatRepository, ProjectReadinessItem, ProjectSettingsView, ChatMessageRecord, ProjectTemplate

### Community 12 - "server/package.json"
Cohesion: 0.07
Nodes (39): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@^2.2.5 (+31 more)

### Community 13 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/react@^19.0.3, @types/react-dom@^19.0.2, typescript@^5.7.2 (+8 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.07
Nodes (27): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, CreateIntegrationInput, DATABASE_CAPABILITIES, defaultRouting, EMAIL_CAPABILITIES, EmailAccountSchema (+19 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.13
Nodes (18): ProjectKnowledgePanel(), apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage() (+10 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.15
Nodes (20): AppDatabase, DatabaseHandle, chatMessages, chatThreads, integrations, kbChunks, kbSources, notebooks (+12 more)

### Community 17 - "WorkflowGraph"
Cohesion: 0.06
Nodes (27): WorkflowRunRepository, WorkflowVersionRepository, buildNodePrompt(), executeHttpNode(), ExecuteRunInput, RunState, captureCodeBundle(), syncProjectsFromDisk() (+19 more)

### Community 18 - "workflow.ts"
Cohesion: 0.11
Nodes (17): AgentNodeConfig, EdgeSchema, InputFieldSchema, InputFieldType, InputFieldTypeSchema, InputSchemaSchema, NodeTypeSchema, RunProvenance (+9 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.07
Nodes (20): ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist(), FakeAgentRuntime, SafeFsWorkspaceAdapter (+12 more)

### Community 20 - "PlatformNode.tsx"
Cohesion: 0.09
Nodes (33): @xyflow/react@^12.3.6, GraphIssue, NodePaletteModal(), ShapePreview(), CanvasActionsContext, useCanvasActions(), NODE_CATALOG, NODE_CATEGORY_COLORS (+25 more)

### Community 21 - "channel-manager.ts"
Cohesion: 0.09
Nodes (10): IntegrationEgressPort, IntegrationTransport, ManagedIntegration, IntegrationEgressRouter, TelegramChannelAdapter, TelegramTransport, parseCloudWebhook(), WhatsAppChannelAdapter (+2 more)

### Community 23 - "environment"
Cohesion: 0.09
Nodes (22): EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL, EMBEDDINGS_URL, INITIAL_ADMIN_PASSWORD, OPENCODE_DB, OPENCODE_MODE, ORCHESTRATOR_MODEL, PLATFORM_GLOBAL_TOKEN (+14 more)

### Community 24 - "IntegrationRecord"
Cohesion: 0.29
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.09
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "ProjectPage"
Cohesion: 0.07
Nodes (36): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), issue(), MappedIssue (+28 more)

### Community 29 - "route-channel-message.ts"
Cohesion: 0.23
Nodes (7): IncomingIntegrationMessage, TriggerRef, ENTRY_POINTS, RouteGlobalIntegrationMessageUseCase, RouteProjectIntegrationMessageUseCase, routeGlobalMessage(), ChannelRoutingSchema

### Community 30 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 31 - "orchestrator-turn.test.ts"
Cohesion: 0.24
Nodes (6): ChatWithOrchestratorUseCase, OrchestratorConfigurationError, resolveOrchestratorModel(), captureLogger(), dirs, setup()

### Community 32 - "web/package.json"
Cohesion: 0.10
Nodes (24): dependencies, @fontsource-variable/inter@^5.3.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3, react-router-dom@^7.1.1 (+16 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "bootstrap.ts"
Cohesion: 0.12
Nodes (14): BootstrapOptions, BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing() (+6 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.12
Nodes (5): extractAssistantText(), MessageLike, ModelLike, OpenCodeClientLike, adapterWith()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "ManageIntegrationsUseCase"
Cohesion: 0.32
Nodes (3): ManageIntegrationsUseCase, useCase(), IntegrationScope

### Community 40 - "execute-workflow.ts"
Cohesion: 0.11
Nodes (14): evaluateCondition(), executeTransform(), renderTemplate(), resolvePath(), templateValue(), Metrics, MetricsSnapshot, SECRET_KEY_PATTERN (+6 more)

### Community 41 - "AgentCatalog.tsx"
Cohesion: 0.13
Nodes (19): RunRecord, AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), toForm(), Modal() (+11 more)

### Community 42 - "IntegrationValidationError"
Cohesion: 0.33
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 44 - "app.ts"
Cohesion: 0.07
Nodes (27): AppConfig, AppEnv, Application, createApplication(), integrationError(), resolveProjectRouteTool(), safeEqual(), GetHealthUseCase (+19 more)

### Community 45 - "setup.ts"
Cohesion: 0.13
Nodes (4): @testing-library/jest-dom@^6.6.3, EventSourceStub, ResizeObserverStub, @testing-library/jest-dom

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "migrate.ts"
Cohesion: 0.22
Nodes (10): [databasePath, mappingPath, backupPath], mapping, sqlite, openDatabase(), addColumnIfMissing(), columnsOf(), migrate(), SQLITE_DDL (+2 more)

### Community 49 - "dynamic-adapter.ts"
Cohesion: 0.31
Nodes (4): ExternalDbConfig, DynamicDatabaseClientAdapter, sanitizeDatabaseError(), withTimeout()

### Community 50 - "ExecutorDeps"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 51 - "Store"
Cohesion: 0.13
Nodes (9): EventBus, Store, WorkspacePort, ExecuteWorkflowRunUseCase, ExecutorDeps, ChannelRouterDeps, Logger, FIELD_RANGES (+1 more)

### Community 53 - "ChatPanel.tsx"
Cohesion: 0.20
Nodes (11): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+3 more)

### Community 54 - "chat.ts"
Cohesion: 0.14
Nodes (13): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+5 more)

### Community 55 - "CodeEditor.tsx"
Cohesion: 0.38
Nodes (5): @monaco-editor/react@^4.6.0, CodeEditor(), FallbackEditor(), Monaco, @monaco-editor/react

### Community 57 - "input.ts"
Cohesion: 0.21
Nodes (11): parseAndValidateAgentOutput(), checkField(), NodeValidationError, validateInputPayload(), validateNodeRules(), valueAt(), WorkflowInputValidationError, InputField (+3 more)

### Community 58 - "NotebookRecord"
Cohesion: 0.23
Nodes (3): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 61 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 62 - "entities.ts"
Cohesion: 0.15
Nodes (14): ExternalDatabaseAdapter, SecretVault, ErrorEventRepository, OPENCODE_GO_PROVIDER_ID, hashIntegrationKey(), IntegrationCommand, IntegrationUpdateCommand, ErrorEventRecord (+6 more)

### Community 63 - "EntityScope"
Cohesion: 0.39
Nodes (3): VaultRepository, EntityScope, VaultSecretRecord

### Community 65 - "shared/src/api.ts"
Cohesion: 0.12
Nodes (15): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+7 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 67 - "validation.ts"
Cohesion: 0.43
Nodes (6): assertIntegrationInScope(), requiredSecretRefs(), validateIntegrationInput(), CreateIntegrationInputSchema, defaultCapabilities(), parseIntegrationConfig()

### Community 68 - "knowledge.test.ts"
Cohesion: 0.07
Nodes (29): EmbeddingPort, KnowledgeExtractor, KnowledgeFilePort, IngestDeps, buildGroundedContext(), chunkMarkdown(), ChunkOptions, KnowledgeChunk (+21 more)

### Community 69 - "SseEvent"
Cohesion: 0.17
Nodes (6): AlertService, redact(), FakeEgress, logger, FakeEvents, SseEvent

### Community 72 - "external-chat.ts"
Cohesion: 0.35
Nodes (7): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), verifyIntegrationKey(), validateWorkflowResources(), createExternalChatRoutes()

### Community 73 - "telemetry.ts"
Cohesion: 0.11
Nodes (17): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, EntryPointTypeSchema, ErrorEvent, ErrorEventSchema (+9 more)

### Community 75 - "vite.config.ts"
Cohesion: 0.40
Nodes (4): @tailwindcss/vite@^4.3.3, @vitejs/plugin-react@^4.3.4, @tailwindcss/vite, @vitejs/plugin-react

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

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

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN`, `PLATFORM_GLOBAL_TOKEN`, `PLATFORM_API_URL` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 633 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WorkflowGraph` connect `WorkflowGraph` to `input-contract.test.ts`, `web/src/api.ts`, `execute-workflow.ts`, `ui.ts`, `AgentCatalog.tsx`, `shared/src/index.ts`, `app.ts`, `ui.test.tsx`, `sqlite-store.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `PlatformNode.tsx`, `ProjectPage`, `entities.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 62 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 62 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `../../tsconfig.base.json`, `PLATFORM_SERVICE_TOKEN` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `HttpPlatformClient` be split into smaller, more focused modules?**
  _Cohesion score 0.05547785547785548 - nodes in this community are weakly interconnected._
- **Why does `createApplication()` connect `app.ts` to `logger.ts`, `HttpPlatformClient`, `auth-routes.ts`, `input-contract.test.ts`, `agents.test.ts`, `AgentRuntimePort`, `WorkflowGraph`, `SafeFsWorkspaceAdapter`, `channel-manager.ts`, `route-channel-message.ts`, `orchestrator-turn.test.ts`, `bootstrap.ts`, `ManageIntegrationsUseCase`, `execute-workflow.ts`, `IntegrationValidationError`, `dynamic-adapter.ts`, `ExecutorDeps`, `Store`, `AgentModelInfo`, `NoopErrorTracker`, `NotebookRecord`, `IntegrationManager`, `knowledge.test.ts`, `SseEvent`, `external-chat.ts`, `search-knowledge.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `auth-routes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `ui.test.tsx` to `web/package.json`, `web/src/api.ts`, `App.tsx`, `ui.ts`, `vite.config.ts`, `devDependencies`, `setup.ts`, `PlatformNode.tsx`, `ProjectPage`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._