# Graph Report - Opencode-server  (2026-11-04)

## Corpus Check
- 232 files · ~286,794 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 6, .example 1, .css 1)

## Summary
- 2316 nodes · 6144 edges · 124 communities (100 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 177 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b83c7480`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- logger.ts
- HttpPlatformClient
- auth.ts
- aes-vault.ts
- WorkspacePort
- AgentRuntimePort
- App.tsx
- Store
- ChatTurnRecord
- app.ts
- ref_bun_test
- connections.ts
- server/package.json
- WorkflowVersionRecord
- src/integrations.ts
- ui.test.tsx
- sqlite-store.ts
- input-contract.test.ts
- workflow.ts
- SafeFsWorkspaceAdapter
- alerts.ts
- runtime.ts
- FakeRuntime
- environment
- knowledge.test.ts
- channel-router.test.ts
- web/tsconfig.json
- scripts
- web/package.json
- execute-workflow.test.ts
- extractors.ts
- chat.ts
- web/src/api.ts
- steps
- ChatPanel.tsx
- opencode-adapter.ts
- WorkflowRunRecord
- opencode-plugin/package.json
- FakeAgentRuntime
- channel-adapters.test.ts
- ChatTurnService
- entities.ts
- NotebookRecord
- tools.ts
- ProjectPage
- cron.ts
- artifacts
- compilerOptions
- validation.ts
- FakeClient
- execute-workflow.ts
- fs-media-store.ts
- channel-manager.ts
- OpenCodeV2Adapter
- ChatThreadRecord
- graph.ts
- openai-compatible-transcription-service.ts
- WorkflowCanvasProps
- NodeInspectorModal.tsx
- IntegrationManager
- shared/package.json
- PlatformClient
- store.ts
- WorkflowScheduleStateRecord
- ProjectPage.tsx
- WorkflowTimerRecord
- KbSourceRecord
- ManageIntegrationsUseCase
- SqliteStore
- WorkflowDeliveryRecord
- app.ts
- FakeAgent
- IntegrationRecord
- telemetry.ts
- agents.ts
- shared/src/index.ts
- ChatMessageRecord
- entrypoint.sh
- config.yaml
- legacy-migration.ts
- WorkflowCanvas.tsx
- EmbeddingPort
- server/tsconfig.json
- legacy-migration.ts
- manage-integrations.ts
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
- CanvasActions
- RouteProjectIntegrationMessageUseCase
- devDependencies
- SessionContextRecord
- contracts.test.ts
- EgressSendResult
- ProjectsPage
- integration-manager.test.ts
- fake-runtime.ts
- WorkflowRunRepository
- route-channel-message.ts
- vault-bootstrap.test.ts
- GrammyTransport
- health.ts
- ref_node_os
- WhatsAppTransport
- orchestrator.ts
- ProjectRecord
- chat-turns.ts
- domain/media.ts
- transcription-init
- AgentMessage
- healthcheck
- platform
- services
- transcription
- IntegrationCapability
- server/src/index.ts

## God Nodes (most connected - your core abstractions)
1. `createApplication()` - 147 edges
2. `SqliteStore` - 68 edges
3. `Store` - 65 edges
4. `Logger` - 58 edges
5. `AgentRuntimePort` - 50 edges
6. `IntegrationRecord` - 50 edges
7. `ChatTurnService` - 47 edges
8. `WorkflowGraph` - 47 edges
9. `SafeFsWorkspaceAdapter` - 44 edges
10. `WorkspacePort` - 42 edges

## Surprising Connections (you probably didn't know these)
- `createApplication()` --calls--> `evaluateToolPermission()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/agents.ts
- `createApplication()` --calls--> `apiError()`  [EXTRACTED]
  apps/server/src/app.ts → packages/shared/src/api.ts
- `StartChatTurnInput` --references--> `MediaRef`  [EXTRACTED]
  apps/server/src/application/use-cases/chat-turns.ts → packages/shared/src/media.ts
- `ExecuteRunInput` --references--> `WorkflowGraph`  [EXTRACTED]
  apps/server/src/application/use-cases/execute-workflow.ts → packages/shared/src/workflow.ts
- `IntegrationCommand` --references--> `IntegrationScope`  [EXTRACTED]
  apps/server/src/application/use-cases/manage-integrations.ts → packages/shared/src/integrations.ts

## Import Cycles
- None detected.

## Communities (124 total, 24 thin omitted)

### Community 0 - "logger.ts"
Cohesion: 0.14
Nodes (10): ErrorTracker, LogBindings, redact(), SECRET_KEY_PATTERN, createLogger(), createMemoryLogger(), LoggerOptions, PinoLoggerAdapter (+2 more)

### Community 2 - "auth.ts"
Cohesion: 0.17
Nodes (10): PasswordHasher, ChangePasswordUseCase, InvalidCredentialsError, LoginUseCase, BootstrapOptions, assertPasswordPolicy(), MIN_PASSWORD_LENGTH, PasswordPolicyError (+2 more)

### Community 3 - "aes-vault.ts"
Cohesion: 0.27
Nodes (4): Aes256GcmVaultAdapter, loadOrCreateMasterKey(), VaultError, dirs

### Community 4 - "WorkspacePort"
Cohesion: 0.10
Nodes (13): WorkspacePort, ManageSubagentsUseCase, AgentMarkdownError, agentRelativePath(), parseAgentMarkdown(), parseAgentPath(), serializeAgentMarkdown(), MarkdownAgentAdapter (+5 more)

### Community 6 - "App.tsx"
Cohesion: 0.09
Nodes (29): App(), RequireAuth(), AuthContext, AuthProvider(), AuthState, useAuth(), BrandLockup(), BrandMark() (+21 more)

### Community 7 - "Store"
Cohesion: 0.13
Nodes (9): AppConfig, EventBus, SecretVault, Store, QueryDatabaseIntegrationUseCase, ExecutorDeps, ChannelRouterDeps, Logger (+1 more)

### Community 9 - "app.ts"
Cohesion: 0.11
Nodes (20): createApplication(), resolveProjectRouteTool(), safeEqual(), GetProjectSettingsUseCase, ProjectReadinessItem, readinessFor(), UpdateProjectSettingsUseCase, captureCodeBundle() (+12 more)

### Community 10 - "ref_bun_test"
Cohesion: 0.13
Nodes (11): IntegrationEgressPort, NotifyApprovalUseCase, SendNotificationUseCase, dirs, FakeEgress, logger, FakeEgress, integration() (+3 more)

### Community 11 - "connections.ts"
Cohesion: 0.15
Nodes (13): ExternalDatabaseAdapter, OPENCODE_GO_PROVIDER_ID, DatabaseActionValidationError, ExecuteDatabaseActionInput, ExecuteDatabaseActionResult, ExecuteDatabaseActionUseCase, classifySql(), SqlStatementKind (+5 more)

### Community 12 - "server/package.json"
Cohesion: 0.06
Nodes (44): dependencies, drizzle-orm@^0.38.3, grammy@^1.32.0, hono@^4.6.14, mammoth@^1.9.0, mssql@^11.0.1, mysql2@^3.12.0, @opencode/client@2.2.5 (+36 more)

### Community 14 - "src/integrations.ts"
Cohesion: 0.06
Nodes (29): CHANNEL_CAPABILITIES, ChannelModeSchema, ChannelRouting, ChannelRoutingSchema, CreateIntegrationInput, DATABASE_CAPABILITIES, DatabaseAccessPolicy, defaultRouting (+21 more)

### Community 15 - "ui.test.tsx"
Cohesion: 0.16
Nodes (15): apiMock, primary, renderCatalog(), subagent, apiMock, graph, renderPage(), apiMock (+7 more)

### Community 16 - "sqlite-store.ts"
Cohesion: 0.13
Nodes (25): chatMessages, chatThreads, chatTurns, integrations, kbChunks, kbSources, notebooks, projects (+17 more)

### Community 17 - "input-contract.test.ts"
Cohesion: 0.24
Nodes (7): CodeWorkerPort, WorkerRpcHandlers, WorkerTimeoutError, BunWorkerPoolAdapter, RpcMessage, dirs, pool

### Community 18 - "workflow.ts"
Cohesion: 0.06
Nodes (35): AgentNodeConfig, DatabaseNodeConfig, DatabaseStatementSchema, EdgeSchema, ForeachNodeConfig, ForeachNodeConfigSchema, InputFieldSchema, InputFieldType (+27 more)

### Community 19 - "SafeFsWorkspaceAdapter"
Cohesion: 0.17
Nodes (10): SafeFsWorkspaceAdapter, WorkspaceError, setup(), setup(), setup(), setup(), setupScheduler(), setup() (+2 more)

### Community 20 - "alerts.ts"
Cohesion: 0.19
Nodes (4): AlertService, redact(), FakeEgress, logger

### Community 21 - "runtime.ts"
Cohesion: 0.17
Nodes (13): AgentSessionRef, ExternalDatabaseStatement, ExternalDatabaseStatementResult, ExternalDbConfig, DynamicDatabaseClientAdapter, isReadStatement(), sanitizeDatabaseError(), sqliteStatement() (+5 more)

### Community 23 - "environment"
Cohesion: 0.10
Nodes (21): AGENT_CHAT_TIMEOUT_MS, AGENT_TURN_IDLE_MS, AGENT_TURN_MAX_MS, AGENT_TURN_POLL_MS, AGENT_TURN_RETRY_MS, CHAT_TURN_ENGINE, EMBEDDINGS_API_KEY, EMBEDDINGS_MODEL (+13 more)

### Community 24 - "knowledge.test.ts"
Cohesion: 0.18
Nodes (12): chunkMarkdown(), ChunkOptions, KnowledgeChunk, splitLongText(), summarize(), assertSafeUrl(), ipv4Parts(), isPrivateAddress() (+4 more)

### Community 25 - "channel-router.test.ts"
Cohesion: 0.17
Nodes (12): TriggerRef, ApprovalCommand, normalizeSender(), parseApprovalCommand(), ProjectRouteDecision, routeProjectMessage(), senderMatchesAllowlist(), dirs (+4 more)

### Community 26 - "web/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 27 - "scripts"
Cohesion: 0.08
Nodes (21): devDependencies, @playwright/test@^1.49.1, @types/bun@latest, typescript@^5.7.2, @types/bun, typescript, name, private (+13 more)

### Community 28 - "web/package.json"
Cohesion: 0.10
Nodes (26): dependencies, @fontsource-variable/inter@^5.3.0, @monaco-editor/react@^4.6.0, @platform/shared@workspace:*, qrcode@^1.5.4, react@^19.0.0, react-dom@^19.0.0, react-markdown@^9.0.3 (+18 more)

### Community 29 - "execute-workflow.test.ts"
Cohesion: 0.08
Nodes (11): executeHttpNode(), MetricsSnapshot, InMemoryMetrics, RunInFlightError, SseHub, NoopErrorTracker, setup(), dirs (+3 more)

### Community 30 - "extractors.ts"
Cohesion: 0.13
Nodes (9): KnowledgeExtractor, KnowledgeFilePort, IngestDeps, ALLOWED_EXTENSIONS, csvToMarkdown(), DocumentExtractor, extensionOf(), KnowledgeError (+1 more)

### Community 31 - "chat.ts"
Cohesion: 0.08
Nodes (25): ChatMessage, ChatMessageSchema, ChatProgressEventSchema, ChatRole, ChatRoleSchema, ChatScope, ChatScopeSchema, ChatThread (+17 more)

### Community 32 - "web/src/api.ts"
Cohesion: 0.07
Nodes (33): ApiClientError, ApprovalRecord, attachTurnStream(), chatStream(), ChatTurnStreamError, DeliveryRecord, HealthPayload, ModelInfo (+25 more)

### Community 33 - "steps"
Cohesion: 0.10
Nodes (19): OPENCODE_MODE, jobs, verify, name, on, pull_request, push, branches (+11 more)

### Community 34 - "ChatPanel.tsx"
Cohesion: 0.17
Nodes (13): ChatHistoryMessage, ChatActivity, ChatMessage, ChatPanel(), submit(), upsertActivity(), ChatSurface, copyText() (+5 more)

### Community 35 - "opencode-adapter.ts"
Cohesion: 0.08
Nodes (8): AgentInboxItem, AgentPromptTimeoutError, extractAssistantText(), MessageLike, ModelLike, OpenCodeClientFactory, OpenCodeClientLike, adapterWith()

### Community 36 - "WorkflowRunRecord"
Cohesion: 0.24
Nodes (5): ApprovalDecisionError, DecideApprovalUseCase, ExecuteWorkflowRunUseCase, WorkflowRunRecord, nextEdge()

### Community 37 - "opencode-plugin/package.json"
Cohesion: 0.12
Nodes (20): dependencies, @opencode/plugin@^2.2.5, @platform/shared@workspace:*, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports (+12 more)

### Community 38 - "FakeAgentRuntime"
Cohesion: 0.14
Nodes (3): AgentFileAttachment, AgentPromptInput, FakeAgentRuntime

### Community 39 - "channel-adapters.test.ts"
Cohesion: 0.14
Nodes (7): IncomingAttachment, IntegrationTransport, IntegrationEgressRouter, TelegramHandler, TelegramTransport, FakeTelegram, silentLogger

### Community 40 - "ChatTurnService"
Cohesion: 0.20
Nodes (7): AgentSessionState, ChatTurnService, extractTurnReply(), isTransportError(), nowIso(), TurnNotFoundError, ChatTurnEvent

### Community 41 - "entities.ts"
Cohesion: 0.13
Nodes (10): ErrorEventRepository, RunQueueRepository, ChatTarget, ChatTurnDeliveryState, ChatTurnEventRecord, DeliveryStatus, ErrorEventRecord, QueuedRunRecord (+2 more)

### Community 42 - "NotebookRecord"
Cohesion: 0.21
Nodes (4): NotebookRepository, IngestKnowledgeUseCase, NotebookRecord, setup()

### Community 43 - "tools.ts"
Cohesion: 0.14
Nodes (15): setup(), agentSegment, createPlatformTools(), GLOBAL_READ_ONLY_TOOLS, objectSchema(), PlatformClientScope, PlatformTool, PlatformToolContext (+7 more)

### Community 44 - "ProjectPage"
Cohesion: 0.17
Nodes (16): ProjectTopBar(), ProjectPage(), addNode(), changeEdgeCondition(), changeGraph(), closeInspector(), connect(), deleteEdge() (+8 more)

### Community 45 - "cron.ts"
Cohesion: 0.12
Nodes (22): cronMinuteKey(), cronWindowsBetween(), FIELD_RANGES, formatterCache, matchesCron(), matchesCronInTimeZone(), matchesParts(), nextCronDate() (+14 more)

### Community 46 - "artifacts"
Cohesion: 0.13
Nodes (14): apply, instruction, requires, tracks, artifacts, description, generates, id (+6 more)

### Community 47 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+6 more)

### Community 48 - "validation.ts"
Cohesion: 0.18
Nodes (11): assertIntegrationInScope(), DATABASE_KINDS, requiredSecretRefs(), validateIntegrationInput(), withDatabaseDefaults(), manager, transcription, useCase() (+3 more)

### Community 50 - "execute-workflow.ts"
Cohesion: 0.11
Nodes (26): buildNodePrompt(), evaluateCondition(), ExecuteRunInput, executeTransform(), parseAndValidateAgentOutput(), RunState, SendNotificationInput, SendNotificationResult (+18 more)

### Community 51 - "fs-media-store.ts"
Cohesion: 0.16
Nodes (17): MEDIA_MAX_BYTES, MEDIA_MAX_DURATION_SECONDS, MediaScope, MediaStoreError, MediaStorePort, SaveMediaInput, ascii(), DetectedMedia (+9 more)

### Community 52 - "channel-manager.ts"
Cohesion: 0.10
Nodes (5): ManagedIntegration, TelegramChannelAdapter, BaileysTransport, parseCloudWebhook(), WhatsAppCloudTransport

### Community 54 - "ChatThreadRecord"
Cohesion: 0.16
Nodes (6): ChatThreadRepository, VaultRepository, StartChatTurnInput, ChatThreadRecord, EntityScope, VaultSecretRecord

### Community 55 - "graph.ts"
Cohesion: 0.21
Nodes (12): validateWorkflowResources(), isValidCronExpression(), computePayloadHash(), effectiveEdges(), IdempotencyMismatchError, reachableFrom(), stableStringify(), startNode() (+4 more)

### Community 56 - "openai-compatible-transcription-service.ts"
Cohesion: 0.16
Nodes (13): TranscriptionAccess, TranscriptionError, TranscriptionPort, TranscriptionRequest, TranscriptionResult, TranscriptionTestResult, Connection, OpenAiCompatibleTranscriptionService (+5 more)

### Community 57 - "WorkflowCanvasProps"
Cohesion: 0.16
Nodes (3): handleConnect(), handleNodeClick(), WorkflowCanvasProps

### Community 58 - "NodeInspectorModal.tsx"
Cohesion: 0.10
Nodes (29): changeEdgeCondition(), connectNodes(), cycleNodes(), visit(), getConnectionIssue(), getGraphIssues(), GraphIssue, issue() (+21 more)

### Community 60 - "shared/package.json"
Cohesion: 0.14
Nodes (16): dependencies, zod@^3.24.1, devDependencies, @types/bun@latest, typescript@^5.7.2, exports, @types/bun, typescript (+8 more)

### Community 62 - "store.ts"
Cohesion: 0.21
Nodes (3): SettingsRepository, UserRepository, UserRecord

### Community 64 - "ProjectPage.tsx"
Cohesion: 0.08
Nodes (51): api, RunRecord, AgentFormState, AgentMode, ControlChannelsPanel(), KINDS, ModalSize, SIZE_CLASS (+43 more)

### Community 66 - "KbSourceRecord"
Cohesion: 0.27
Nodes (3): KnowledgeRepository, KbChunkRecord, KbSourceRecord

### Community 68 - "SqliteStore"
Cohesion: 0.15
Nodes (4): DatabaseHandle, createStore(), parse(), SqliteStore

### Community 70 - "app.ts"
Cohesion: 0.17
Nodes (13): AppEnv, integrationError(), IntegrationUpdateCommand, authMiddleware(), AuthVariables, PASSWORD_CHANGE_ALLOWLIST, readUser(), SESSION_COOKIE (+5 more)

### Community 72 - "IntegrationRecord"
Cohesion: 0.29
Nodes (3): IntegrationRepository, IntegrationRecord, IntegrationStatus

### Community 73 - "telemetry.ts"
Cohesion: 0.11
Nodes (18): ChatMessageRequest, ChatMessageRequestSchema, ChatMessageResponse, ChatMessageResponseSchema, SseEventSchema, ChatHealthSummary, ChatHealthSummarySchema, EntryPointTypeSchema (+10 more)

### Community 74 - "agents.ts"
Cohesion: 0.17
Nodes (11): AgentExecutionContextSchema, AgentMode, AgentModeSchema, ModelRef, ModelRefSchema, modelRefToString(), PermissionRuleSchema, PlatformToolName (+3 more)

### Community 75 - "shared/src/index.ts"
Cohesion: 0.12
Nodes (23): AgentCard(), AgentCatalog(), agentKey(), deniedTools(), AgentEditorModal(), patch(), toForm(), Modal() (+15 more)

### Community 77 - "entrypoint.sh"
Cohesion: 0.25
Nodes (7): OPENCODE_DB, OPENCODE_MODE, PLATFORM_API_URL, PLATFORM_GLOBAL_TOKEN, PLATFORM_SERVICE_TOKEN, entrypoint.sh script, XDG_STATE_HOME

### Community 78 - "config.yaml"
Cohesion: 0.25
Nodes (7): guidance, guidance, context, operations, apply, archive, schema

### Community 79 - "legacy-migration.ts"
Cohesion: 0.12
Nodes (16): [databasePath, mappingPath, backupPath], mapping, sqlite, AppDatabase, openDatabase(), addColumnIfMissing(), backfillDatabasePolicies(), columnsOf() (+8 more)

### Community 80 - "WorkflowCanvas.tsx"
Cohesion: 0.11
Nodes (24): CanvasActionsContext, useCanvasActions(), ConnectRole, NodeStatusIcon(), PlatformFlowNode, PlatformNode(), PlatformNodeData, statusColor (+16 more)

### Community 81 - "EmbeddingPort"
Cohesion: 0.26
Nodes (5): EmbeddingPort, createEmbeddingAdapter(), fnv1a(), HashEmbeddingAdapter, HttpEmbeddingAdapter

### Community 82 - "server/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, jsx, lib, types, extends, include, ../../tsconfig.base.json

### Community 83 - "legacy-migration.ts"
Cohesion: 0.23
Nodes (12): channelKind(), createMigrationBackup(), databaseKind(), ensureIntegrationsTable(), hasColumn(), LegacyChannelRow, LegacyDatabaseRow, LegacyMigrationMapping (+4 more)

### Community 84 - "manage-integrations.ts"
Cohesion: 0.21
Nodes (11): ChannelAuthError, deliverWebhook(), SendExternalChatMessageUseCase, signWebhook(), hashIntegrationKey(), verifyIntegrationKey(), createExternalChatRoutes(), cleanups (+3 more)

### Community 85 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 86 - "worker-entry.ts"
Cohesion: 0.33
Nodes (4): allowlistedEnv, ctx, pending, RpcMethod

### Community 87 - "shared/src/api.ts"
Cohesion: 0.18
Nodes (9): ApiError, ApiErrorSchema, CreateProjectRequest, CreateProjectRequestSchema, PaginationMeta, PaginationMetaSchema, PaginationQuery, PaginationQuerySchema (+1 more)

### Community 88 - "search-knowledge.ts"
Cohesion: 0.44
Nodes (4): KnowledgeSearchResult, buildGroundedContext(), SearchKnowledgeUseCase, cosineSimilarity()

### Community 89 - "chat-progress.ts"
Cohesion: 0.30
Nodes (9): commandText(), createChatProgressHandler(), fileEditText(), filePathFromInput(), fileReadText(), normalizeToolName(), RawAgentEvent, toolText() (+1 more)

### Community 91 - "opencode-plugin/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 92 - "ChatTurnStatus"
Cohesion: 0.17
Nodes (7): ChatTurnResult, ChatTurnActions, ChatTurnConnection, ChatTurnController, statusFromEvent(), useChatTurn(), ChatTurnStatus

### Community 93 - "shared/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.base.json

### Community 94 - "bootstrap.ts"
Cohesion: 0.22
Nodes (7): BootstrapResult, BootstrapSystemUseCase, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME, ensureControlWorkspace(), SUBDIRECTORIES, writeIfMissing()

### Community 95 - "IntegrationValidationError"
Cohesion: 0.29
Nodes (3): databaseConfig(), TestDatabaseIntegrationUseCase, IntegrationValidationError

### Community 98 - "devDependencies"
Cohesion: 0.05
Nodes (26): devDependencies, jsdom@^25.0.1, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @testing-library/jest-dom@^6.6.3, @testing-library/react@^16.1.0, @testing-library/user-event@^14.5.2, @types/qrcode@^1.5.5 (+18 more)

### Community 100 - "contracts.test.ts"
Cohesion: 0.10
Nodes (10): TranscriptionIntegrationConfigSchema, AgentNodeConfigSchema, DatabaseNodeConfigSchema, NodeErrorPolicySchema, NodeSpecSchema, NotifyNodeConfigSchema, ProjectTemplateSchema, TranscribeNodeConfigSchema (+2 more)

### Community 101 - "EgressSendResult"
Cohesion: 0.13
Nodes (3): EgressSendResult, IntegrationManagerPort, RecordingEgress

### Community 102 - "ProjectsPage"
Cohesion: 0.40
Nodes (4): formatDate(), ProjectsPage(), onNameChange(), slugify()

### Community 104 - "fake-runtime.ts"
Cohesion: 0.25
Nodes (3): AgentModelInfo, createAgentRuntime(), ServiceClientFactory

### Community 105 - "WorkflowRunRepository"
Cohesion: 0.13
Nodes (4): WorkflowRunRepository, ApprovalRecord, StepRunRecord, StepStatus

### Community 106 - "route-channel-message.ts"
Cohesion: 0.20
Nodes (12): ChatSessionFactory, ensureChatSession(), isSessionNotFoundError(), promptWithSessionRecovery(), registerSessionContext(), deliverChatTurn(), deliveriesInFlight, ENTRY_POINTS (+4 more)

### Community 107 - "vault-bootstrap.test.ts"
Cohesion: 0.16
Nodes (5): RateLimiter, AuthRouteDeps, BunPasswordHasher, buildApp(), dirs

### Community 109 - "health.ts"
Cohesion: 0.20
Nodes (3): GetHealthUseCase, Metrics, ServiceHealth

### Community 110 - "ref_node_os"
Cohesion: 0.24
Nodes (5): Application, json(), logEntries, testLogger, waitForApproval()

### Community 112 - "orchestrator.ts"
Cohesion: 0.18
Nodes (9): ChatWithOrchestratorUseCase, EmptyAgentReplyError, OrchestratorConfigurationError, OrchestratorOverview, resolveOrchestratorModel(), dirs, captureLogger(), dirs (+1 more)

### Community 113 - "ProjectRecord"
Cohesion: 0.36
Nodes (3): ProjectRepository, ProjectSettingsView, ProjectRecord

### Community 114 - "chat-turns.ts"
Cohesion: 0.17
Nodes (9): assertChatTimeoutsCoverOpenCode(), ChatTurnPolicy, positive(), resolveChatTurnPolicy(), TurnFailureError, TurnInProgressError, TurnInterruptedError, TurnTimeoutError (+1 more)

### Community 115 - "domain/media.ts"
Cohesion: 0.43
Nodes (5): MediaAttachmentError, readMedia(), ResolvedAttachment, resolveMediaPath(), toAttachmentFiles()

### Community 116 - "transcription-init"
Cohesion: 0.25
Nodes (8): transcription, depends_on, transcription-init, condition, command, depends_on, image, restart

### Community 118 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 119 - "platform"
Cohesion: 0.33
Nodes (6): build, image, ports, restart, volumes, platform

### Community 120 - "services"
Cohesion: 0.40
Nodes (4): services, volumes, platform-data, whisper-models

### Community 121 - "transcription"
Cohesion: 0.40
Nodes (5): transcription, expose, image, restart, volumes

### Community 122 - "IntegrationCapability"
Cohesion: 0.67
Nodes (4): IntegrationCommand, ValidatedIntegrationInput, IntegrationCapability, IntegrationKind

## Knowledge Gaps
- **10 isolated node(s):** `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE`, `PLATFORM_API_URL`, `PLATFORM_GLOBAL_TOKEN` (+5 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 802 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createApplication()` connect `app.ts` to `logger.ts`, `auth.ts`, `aes-vault.ts`, `WorkspacePort`, `AgentRuntimePort`, `Store`, `ChatTurnRecord`, `ref_bun_test`, `connections.ts`, `input-contract.test.ts`, `SafeFsWorkspaceAdapter`, `alerts.ts`, `runtime.ts`, `execute-workflow.test.ts`, `extractors.ts`, `WorkflowRunRecord`, `channel-adapters.test.ts`, `ChatTurnService`, `NotebookRecord`, `tools.ts`, `cron.ts`, `validation.ts`, `fs-media-store.ts`, `graph.ts`, `openai-compatible-transcription-service.ts`, `IntegrationManager`, `ManageIntegrationsUseCase`, `SqliteStore`, `app.ts`, `shared/src/index.ts`, `ChatMessageRecord`, `legacy-migration.ts`, `EmbeddingPort`, `manage-integrations.ts`, `search-knowledge.ts`, `bootstrap.ts`, `IntegrationValidationError`, `RouteProjectIntegrationMessageUseCase`, `EgressSendResult`, `fake-runtime.ts`, `route-channel-message.ts`, `vault-bootstrap.test.ts`, `health.ts`, `ref_node_os`, `orchestrator.ts`, `chat-turns.ts`, `server/src/index.ts`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 74 inferred relationships involving `createApplication()` (e.g. with `.start()` and `.stop()`) actually correct?**
  _`createApplication()` has 74 INFERRED edges - model-reasoned connections that need verification._
- **What connects `../../tsconfig.base.json`, `OPENCODE_DB`, `OPENCODE_MODE` to the rest of the system?**
  _10 weakly-connected nodes found - possible missing edges._
- **Should `logger.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.135632183908046 - nodes in this community are weakly interconnected._
- **Why does `WorkflowGraph` connect `app.ts` to `App.tsx`, `WorkflowVersionRecord`, `ui.test.tsx`, `sqlite-store.ts`, `workflow.ts`, `SafeFsWorkspaceAdapter`, `execute-workflow.test.ts`, `web/src/api.ts`, `WorkflowRunRecord`, `entities.ts`, `cron.ts`, `execute-workflow.ts`, `graph.ts`, `WorkflowCanvasProps`, `NodeInspectorModal.tsx`, `store.ts`, `ProjectPage.tsx`, `app.ts`, `shared/src/index.ts`, `WorkflowCanvas.tsx`, `ref_node_os`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `WorkspacePort` be split into smaller, more focused modules?**
  _Cohesion score 0.09551020408163265 - nodes in this community are weakly interconnected._
- **Why does `AgentRuntimePort` connect `AgentRuntimePort` to `WorkspacePort`, `Store`, `app.ts`, `connections.ts`, `runtime.ts`, `FakeRuntime`, `execute-workflow.test.ts`, `opencode-adapter.ts`, `FakeAgentRuntime`, `execute-workflow.ts`, `OpenCodeV2Adapter`, `FakeAgent`, `manage-integrations.ts`, `FakeAgent`, `fake-runtime.ts`, `route-channel-message.ts`, `health.ts`, `orchestrator.ts`, `chat-turns.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._