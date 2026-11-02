import { existsSync } from "node:fs";
import { join } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import {
  apiError,
  evaluateToolPermission,
  type AgentExecutionContext,
  type ChatProgressEvent,
  type WorkflowGraph,
} from "@platform/shared";
import type { IntegrationRecord, UserRecord } from "./domain/entities.ts";
import { InMemoryMetrics } from "./domain/telemetry/metrics.ts";
import type { Logger } from "./domain/telemetry/index.ts";
import { createLogger } from "./infrastructure/out/telemetry/logger.ts";
import { NoopErrorTracker, SentryErrorTracker } from "./infrastructure/out/telemetry/sentry.ts";
import { SqliteStore } from "./infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter, loadOrCreateMasterKey } from "./infrastructure/out/vault/aes-vault.ts";
import { BunPasswordHasher } from "./infrastructure/out/security/bun-password-hasher.ts";
import { BootstrapSystemUseCase } from "./application/use-cases/bootstrap.ts";
import { SessionCodec } from "./infrastructure/in/auth/session.ts";
import { authMiddleware } from "./infrastructure/in/auth/middleware.ts";
import { createAuthRoutes } from "./infrastructure/in/http/auth-routes.ts";
import { PROJECT_ISOLATION_PERMISSIONS, SafeFsWorkspaceAdapter } from "./infrastructure/out/workspace-fs/safe-workspace.ts";
import { BunWorkerPoolAdapter } from "./infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { createAgentRuntime } from "./infrastructure/out/opencode/fake-runtime.ts";
import { SseHub } from "./infrastructure/in/sse/sse-hub.ts";
import { MarkdownAgentAdapter } from "./infrastructure/out/agents/markdown-agent-adapter.ts";
import { KnowledgeFileStore } from "./infrastructure/out/knowledge/knowledge-files.ts";
import { DocumentExtractor, KnowledgeError } from "./infrastructure/out/knowledge/extractors.ts";
import { createEmbeddingAdapter } from "./infrastructure/out/knowledge/embeddings.ts";
import { DynamicDatabaseClientAdapter } from "./infrastructure/out/external-db/dynamic-adapter.ts";
import { ExecuteWorkflowRunUseCase } from "./application/use-cases/execute-workflow.ts";
import { ManageSubagentsUseCase } from "./application/use-cases/manage-subagents.ts";
import { IngestKnowledgeUseCase } from "./application/use-cases/ingest-knowledge.ts";
import { SearchKnowledgeUseCase, buildGroundedContext } from "./application/use-cases/search-knowledge.ts";
import {
  ConnectProviderUseCase,
  QueryDatabaseIntegrationUseCase,
  TestDatabaseIntegrationUseCase,
} from "./application/use-cases/connections.ts";
import {
  ChatWithProjectUseCase,
  CreateProjectUseCase,
  DeleteProjectUseCase,
  RollbackWorkflowVersionUseCase,
  SaveWorkflowUseCase,
  captureCodeBundle,
  syncProjectsFromDisk,
} from "./application/use-cases/projects.ts";
import { GetHealthUseCase } from "./application/use-cases/health.ts";
import {
  RouteGlobalIntegrationMessageUseCase,
  RouteProjectIntegrationMessageUseCase,
} from "./application/use-cases/route-channel-message.ts";
import { IntegrationEgressRouter } from "./infrastructure/in/channels/egress-router.ts";
import { createExternalChatRoutes } from "./infrastructure/in/http/external-chat-routes.ts";
import { IntegrationManager } from "./infrastructure/in/channels/channel-manager.ts";
import { WorkspaceError } from "./infrastructure/out/workspace-fs/safe-workspace.ts";
import {
  IdempotencyMismatchError,
  RunInFlightError,
  WorkflowValidationError,
  computeGraphHash,
} from "./domain/workflow/graph.ts";
import { WorkflowInputValidationError } from "./domain/workflow/input.ts";
import { ManageIntegrationsUseCase, type IntegrationCommand, type IntegrationUpdateCommand } from "./application/use-cases/manage-integrations.ts";
import { IntegrationValidationError } from "./domain/integrations/validation.ts";
import { GetProjectSettingsUseCase, UpdateProjectSettingsUseCase } from "./application/use-cases/project-settings.ts";
import { ChatWithOrchestratorUseCase } from "./application/use-cases/orchestrator.ts";
import { AlertService } from "./application/use-cases/alerts.ts";
import { validateWorkflowResources } from "./application/use-cases/workflow-resources.ts";
import { WorkflowScheduler } from "./domain/workflow/cron.ts";

export interface AppConfig {
  dataDir: string;
  databasePath?: string;
  initialAdminPassword?: string;
  serviceToken?: string;
  globalServiceToken?: string;
  sentryDsn?: string;
  webDist?: string;
  secureCookies?: boolean;
  env?: Record<string, string | undefined>;
  logger?: Logger;
}

export interface Application {
  app: Hono<{
    Variables: {
      requestId: string;
      user: UserRecord;
      serviceScope?: "project" | "global";
      serviceProject?: string;
    };
  }>;
  store: SqliteStore;
  events: SseHub;
  agent: import("./application/ports/runtime.ts").AgentRuntimePort;
  integrationManager: IntegrationManager;
  scheduler: WorkflowScheduler;
  close(): void;
}

type AppEnv = {
  Variables: {
    requestId: string;
    user: UserRecord;
    serviceScope?: "project" | "global";
    serviceProject?: string;
  };
};

function resolveProjectRouteTool(method: string, path: string): string | undefined {
  if (method === "PUT" && (/\/workflow$/.test(path) || /\/nodes\//.test(path))) return "workflow_upsert";
  if (method === "POST" && /\/workflow\/versions\/\d+\/rollback$/.test(path)) return "workflow_upsert";
  if ((method === "PUT" || method === "DELETE") && /\/agents\/[^/]+\/[^/]+$/.test(path)) return "subagent_upsert";
  if (method === "POST" && /\/integrations\/[^/]+\/database\/query$/.test(path)) return "db_query";
  if (method === "POST" && /\/integrations\/[^/]+\/notify$/.test(path)) return "notify";
  if (method === "POST" && /\/runs$/.test(path)) return "workflow_trigger";
  if (method === "POST" && (/\/notebooks\/[^/]+\/search$/.test(path) || /\/knowledge\/search$/.test(path))) {
    return "kb_search";
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function integrationError(c: { json(body: unknown, status?: number): Response }, error: unknown): Response {
  if (error instanceof IntegrationValidationError) {
    const status =
      error.code === "FORBIDDEN" ? 403 : error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 422;
    return c.json(apiError(error.code, error.message), status);
  }
  if (error instanceof KnowledgeError) {
    return c.json(apiError(error.code, error.message), error.code === "UNSAFE_URL" ? 422 : 400);
  }
  throw error;
}

export async function createApplication(config: AppConfig): Promise<Application> {
  const env = config.env ?? process.env;
  const logger = config.logger ?? createLogger({ level: env.LOG_LEVEL ?? "info" });
  const store = new SqliteStore(config.databasePath ?? join(config.dataDir, "db", "platform.sqlite"));
  const masterKey = await loadOrCreateMasterKey(join(config.dataDir, "master.key"));
  const vault = new Aes256GcmVaultAdapter(masterKey);
  const hasher = new BunPasswordHasher();

  await new BootstrapSystemUseCase({
    dataDir: config.dataDir,
    store,
    passwordHasher: hasher,
    initialPassword: config.initialAdminPassword,
    logger,
  }).execute();

  const workspacesDir = join(config.dataDir, "workspaces");
  const controlDirectory = join(config.dataDir, "control");
  const workspace = new SafeFsWorkspaceAdapter(workspacesDir);
  await syncProjectsFromDisk(store, workspace);
  for (const slug of await workspace.listProjects()) {
    const project = store.projects.findBySlug(slug);
    await workspace.ensureProjectScaffold(slug, project?.name ?? slug);
    const projectConfig = await workspace.readOpencodeConfig(slug);
    if (!Array.isArray(projectConfig.permissions)) {
      projectConfig.permissions = PROJECT_ISOLATION_PERMISSIONS;
      await workspace.writeOpencodeConfig(slug, projectConfig);
    }
  }

  const agent = createAgentRuntime(env, config.dataDir);
  // OpenCode keeps provider integrations in its own state. Re-register the
  // encrypted platform keys on every start so a service restart does not look
  // like a missing OpenCode Go token to the user.
  for (const secret of store.vault.list({ scope: "global" })) {
    if (secret.kind !== "provider_key") continue;
    const providerID = secret.alias.replace(/^provider:/, "");
    try {
      await agent.registerProviderKey(providerID, vault.decrypt(secret.ciphertext));
      logger.info({ event: "provider_key_restored", providerID });
    } catch (error) {
      logger.warn({
        event: "provider_key_restore_failed",
        providerID,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const worker = new BunWorkerPoolAdapter();
  const events = new SseHub();
  const metrics = new InMemoryMetrics();
  const errorTracker = config.sentryDsn
    ? new SentryErrorTracker(config.sentryDsn, env.SENTRY_ENVIRONMENT ?? "production")
    : new NoopErrorTracker();
  const codec = new SessionCodec(masterKey.toString("base64"));
  const egress = new IntegrationEgressRouter();
  const externalDb = new DynamicDatabaseClientAdapter();
  const queryDatabase = new QueryDatabaseIntegrationUseCase(store, vault, externalDb);
  const testDatabase = new TestDatabaseIntegrationUseCase(store, vault, externalDb);
  const embeddings = createEmbeddingAdapter(env);
  const knowledgeFiles = new KnowledgeFileStore(workspacesDir);
  const ingest = new IngestKnowledgeUseCase({
    store,
    files: knowledgeFiles,
    embeddings,
    extractor: new DocumentExtractor(),
  });
  const search = new SearchKnowledgeUseCase(store, embeddings);

  const executor = new ExecuteWorkflowRunUseCase({
    store,
    workspace,
    worker,
    agent,
    events,
    metrics,
    errors: errorTracker,
    logger,
    workerHandlers: {
      db: ({ projectSlug, integrationId, sql, params }) =>
        queryDatabase.execute(integrationId, { scope: "project", projectSlug }, sql, params),
      notify: async ({ projectSlug, integrationId, text }) => {
        const integration = store.integrations.findById(integrationId);
        if (!integration || integration.scope !== "project" || integration.projectSlug !== projectSlug) {
          throw new IntegrationValidationError("FORBIDDEN", "integration scope mismatch");
        }
        await egress.send(integrationId, text);
      },
    },
    defaultModel: () => store.settings.get("default_model") || undefined,
    projectDefaultModel: (slug) => store.projects.findBySlug(slug)?.defaultModel,
    knowledgeContext: async (projectSlug, notebookIds, query, strict) => {
      const results = [];
      for (const notebookId of notebookIds) {
        const notebook = store.notebooks.findById(notebookId);
        if (!notebook || notebook.projectSlug !== projectSlug) continue;
        const hits = await search
          .execute(projectSlug, notebook.slug, JSON.stringify(query).slice(0, 500), 4)
          .catch(() => []);
        results.push(...hits);
      }
      return buildGroundedContext(results, strict);
    },
  });

  const projectRouter = new RouteProjectIntegrationMessageUseCase({
    store,
    workspace,
    agent,
    executor,
    egress,
    events,
    logger,
  });
  const globalRouter = new RouteGlobalIntegrationMessageUseCase({
    store,
    workspace,
    agent,
    executor,
    egress,
    events,
    logger,
    controlDirectory,
    orchestratorAgent: "orchestrator/agente",
  });
  const integrationManager = new IntegrationManager({
    store,
    vault,
    egress,
    events,
    logger,
    projectRouter,
    globalRouter,
    dataDir: config.dataDir,
    fetchImpl: fetch,
  });
  const integrations = new ManageIntegrationsUseCase({
    store,
    vault,
    events,
    manager: integrationManager,
    databaseAdapter: externalDb,
  });

  const createProject = new CreateProjectUseCase(store, workspace, events);
  const deleteProject = new DeleteProjectUseCase(store, workspace, events);
  const saveWorkflow = new SaveWorkflowUseCase(store, workspace, events);
  const rollbackWorkflow = new RollbackWorkflowVersionUseCase(store, workspace, events);
  await executor.recoverInterruptedRuns().catch(() => undefined);
  const chat = new ChatWithProjectUseCase({
    store,
    workspace,
    agent,
    events,
    defaultModel: () => store.settings.get("default_model") || undefined,
    timeoutMs: Number(env.AGENT_CHAT_TIMEOUT_MS ?? 900_000),
    logger,
  });
  const orchestrator = new ChatWithOrchestratorUseCase({
    store,
    agent,
    controlDirectory,
    orchestratorAgent: "orchestrator/agente",
    timeoutMs: Number(env.AGENT_CHAT_TIMEOUT_MS ?? 900_000),
    logger,
  });
  const agents = new ManageSubagentsUseCase(workspace, new MarkdownAgentAdapter(workspace), agent, events);
  const connectProvider = new ConnectProviderUseCase(store, vault, agent);
  const health = new GetHealthUseCase({ store, agent, metrics, startedAt: Date.now() });
  const projectSettings = new GetProjectSettingsUseCase(store, workspace);
  const updateProjectSettings = new UpdateProjectSettingsUseCase(store, events);
  const alerts = new AlertService({ store, egress, events, logger });
  alerts.start();
  const scheduler = new WorkflowScheduler({ store, workspace, executor, logger });
  scheduler.start();

  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    const started = Date.now();
    await next();
    metrics.recordRequest(c.req.path, c.res.status, Date.now() - started);
  });

  app.use("/api/*", async (c, next) => {
    const path = c.req.path;
    if (path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/me") return next();
    if (path.startsWith("/api/v1/integrations/") || path.startsWith("/api/v1/webhooks/")) return next();
    const token = c.req.header("x-platform-token");
    if (token) {
      const scopeHeader = c.req.header("x-platform-scope");
      const projectHeader = c.req.header("x-platform-project");
      if (scopeHeader === "global") {
        if (!config.globalServiceToken || !safeEqual(token, config.globalServiceToken)) {
          return c.json(apiError("FORBIDDEN", "invalid global scope credential"), 403);
        }
        c.set("serviceScope", "global");
        return next();
      }
      if (projectHeader) {
        if (!config.serviceToken || !safeEqual(token, config.serviceToken)) {
          return c.json(apiError("FORBIDDEN", "invalid project scope credential"), 403);
        }
        c.set("serviceScope", "project");
        c.set("serviceProject", projectHeader);
        return next();
      }
      if (config.globalServiceToken && safeEqual(token, config.globalServiceToken)) {
        c.set("serviceScope", "global");
        return next();
      }
      return c.json(apiError("FORBIDDEN", "service calls require an explicit scope"), 403);
    }
    return authMiddleware(store, codec)(c, next);
  });

  app.use("/api/projects/:slug/*", async (c, next) => {
    const scope = c.get("serviceScope");
    const slug = c.req.param("slug");
    if (scope === "project") {
      if (c.get("serviceProject") !== slug) {
        return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
      }
      const agentHeader = c.req.header("x-platform-agent")?.trim();
      const contextHeader = (c.req.header("x-platform-context")?.trim() as AgentExecutionContext | undefined) ?? "chat";
      const toolName = resolveProjectRouteTool(c.req.method, c.req.path);
      if (toolName && (agentHeader || contextHeader !== "chat")) {
        let permissions: Array<{ action: string; resource: string; effect: "allow" | "deny" | "ask" }> | undefined;
        if (agentHeader && agentHeader.includes("/")) {
          const [category, role] = agentHeader.split("/");
          if (category && role) {
            const profile = await agents.get(slug, category, role).catch(() => undefined);
            permissions = profile?.frontmatter.permissions;
          }
        }
        const verdict = evaluateToolPermission({
          tool: toolName,
          context: contextHeader,
          permissions,
        });
        if (!verdict.allowed) {
          logger.warn({
            event: "agent_tool_permission_denied",
            entryPoint: "worker",
            projectSlug: slug,
            agentId: agentHeader,
            tool: toolName,
            reason: verdict.reason,
          });
          return c.json(apiError("FORBIDDEN", verdict.reason ?? "tool permission denied"), 403);
        }
      }
      return next();
    }
    if (scope === "global" && c.req.method !== "GET") {
      return c.json(apiError("FORBIDDEN", "global orchestrator is read-only for project data"), 403);
    }
    const scoped = c.req.header("x-platform-project");
    if (scoped && slug !== scoped) {
      return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
    }
    await next();
  });

  app.use("/api/control/*", async (c, next) => {
    if (c.get("serviceScope") === "project") {
      return c.json(apiError("FORBIDDEN", "project scope cannot access the control plane"), 403);
    }
    await next();
  });

  app.use("/api/vault/*", async (c, next) => {
    if (c.get("serviceScope") === "project") {
      return c.json(apiError("FORBIDDEN", "project scope cannot access platform secrets"), 403);
    }
    await next();
  });
  app.use("/api/settings", async (c, next) => {
    if (c.get("serviceScope") === "project") {
      return c.json(apiError("FORBIDDEN", "project scope cannot access platform settings"), 403);
    }
    await next();
  });
  app.use("/api/providers/*", async (c, next) => {
    if (c.get("serviceScope") === "project") {
      return c.json(apiError("FORBIDDEN", "project scope cannot access platform providers"), 403);
    }
    await next();
  });

  app.route(
    "/api/auth",
    createAuthRoutes({ store, hasher, codec, secureCookies: config.secureCookies ?? env.NODE_ENV === "production" }),
  );
  app.route(
    "/api",
    createExternalChatRoutes({
      store,
      vault,
      agent,
      workspace,
      executor,
      controlDirectory,
      fetchImpl: fetch,
      logger,
    }),
  );

  app.post("/api/v1/webhooks/:projectSlug/:nodeId", async (c) => {
    const projectSlug = c.req.param("projectSlug");
    const nodeId = c.req.param("nodeId");
    const rawBody = await c.req.text();
    let payload: unknown = {};
    if (rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return c.json(apiError("VALIDATION_ERROR", "invalid JSON payload"), 422);
      }
    }
    const graph = await workspace.readWorkflow(projectSlug).catch(() => undefined);
    if (!graph) return c.json(apiError("NOT_FOUND", "workflow not found"), 404);
    const trigger = graph.nodes.find(
      (node) => node.id === nodeId && node.type === "trigger" && node.config.kind === "webhook",
    );
    if (!trigger) return c.json(apiError("NOT_FOUND", "webhook trigger not found"), 404);
    const secretAlias = String(trigger.config.secretAlias ?? "").trim();
    const secretRecord = secretAlias
      ? store.vault.findByAlias({ scope: "project", projectSlug, alias: secretAlias })
      : undefined;
    if (!secretRecord) return c.json(apiError("UNAUTHORIZED", "webhook secret is not configured"), 401);
    const secret = vault.decrypt(secretRecord.ciphertext);
    const headerSecret = c.req.header("x-webhook-secret") ?? "";
    const signatureHeader = c.req.header("x-webhook-signature") ?? "";
    const expectedSig = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const validSecret = Boolean(headerSecret && safeEqual(headerSecret, secret));
    const validSignature = Boolean(signatureHeader && safeEqual(signatureHeader, expectedSig));
    if (!validSecret && !validSignature) {
      return c.json(apiError("UNAUTHORIZED", "invalid webhook secret or signature"), 401);
    }
    try {
      await validateWorkflowResources(store, workspace, projectSlug, graph);
      const run = await executor.start({
        projectSlug,
        graph,
        payload,
        entryPoint: "webhook",
        idempotencyKey: c.req.header("idempotency-key") ?? undefined,
        launchedBy: "webhook",
        sourceDetail: `webhook:${nodeId}`,
      });
      return c.json({ runId: run.id, ...run, steps: store.runs.listSteps(run.id) }, 202);
    } catch (error) {
      if (error instanceof WorkflowInputValidationError) {
        return c.json(apiError("VALIDATION_ERROR", error.message, error.issues), 422);
      }
      if (error instanceof WorkflowValidationError) {
        return c.json(apiError("INVALID_WORKFLOW", error.message, error.issues), 422);
      }
      if (error instanceof IdempotencyMismatchError) return c.json(apiError("IDEMPOTENCY_MISMATCH", error.message), 422);
      if (error instanceof RunInFlightError) {
        return c.json(apiError("RUN_IN_FLIGHT", error.message, { runId: error.runId }), 409);
      }
      throw error;
    }
  });

  // Project integrations
  app.get("/api/projects/:slug/integrations", (c) =>
    c.json({ data: integrations.list({ scope: "project", projectSlug: c.req.param("slug") }) }),
  );
  app.post("/api/projects/:slug/integrations", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<IntegrationCommand>;
    try {
      const result = await integrations.create({
        ...(body as IntegrationCommand),
        scope: "project",
        projectSlug: c.req.param("slug"),
      });
      return c.json(result, 201);
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.get("/api/projects/:slug/integrations/:id", (c) => {
    try {
      return c.json(integrations.get(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.patch("/api/projects/:slug/integrations/:id", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as IntegrationUpdateCommand;
    try {
      return c.json(
        await integrations.update(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }, body),
      );
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.delete("/api/projects/:slug/integrations/:id", async (c) => {
    try {
      return c.json({ ok: await integrations.remove(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }) });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/test", async (c) => {
    try {
      return c.json(await integrations.test(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/connect", async (c) => {
    try {
      return c.json(await integrations.connect(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/disconnect", async (c) => {
    try {
      await integrations.disconnect(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") });
      return c.json({ ok: true });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.get("/api/projects/:slug/integrations/:id/qr", (c) => {
    const qr = integrationManager.qr(c.req.param("id"));
    return qr ? c.json({ qr }) : c.json(apiError("NOT_FOUND", "no QR available"), 404);
  });

  // Global control integrations and orchestrator
  app.get("/api/control/integrations", (c) => c.json({ data: integrations.list({ scope: "global" }) }));
  app.post("/api/control/integrations", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<IntegrationCommand>;
    try {
      return c.json(await integrations.create({ ...(body as IntegrationCommand), scope: "global", projectSlug: undefined }), 201);
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.get("/api/control/integrations/:id", (c) => {
    try {
      return c.json(integrations.get(c.req.param("id"), { scope: "global" }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.patch("/api/control/integrations/:id", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as IntegrationUpdateCommand;
    try {
      return c.json(await integrations.update(c.req.param("id"), { scope: "global" }, body));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.delete("/api/control/integrations/:id", async (c) => {
    try {
      return c.json({ ok: await integrations.remove(c.req.param("id"), { scope: "global" }) });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/control/integrations/:id/test", async (c) => {
    try {
      return c.json(await integrations.test(c.req.param("id"), { scope: "global" }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/control/integrations/:id/connect", async (c) => {
    try {
      return c.json(await integrations.connect(c.req.param("id"), { scope: "global" }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/control/integrations/:id/disconnect", async (c) => {
    try {
      await integrations.disconnect(c.req.param("id"), { scope: "global" });
      return c.json({ ok: true });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.get("/api/control/integrations/:id/qr", (c) => {
    const qr = integrationManager.qr(c.req.param("id"));
    return qr ? c.json({ qr }) : c.json(apiError("NOT_FOUND", "no QR available"), 404);
  });

  app.get("/api/control/overview", (c) => c.json(orchestrator.overview()));
  app.get("/api/control/chat", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 200) || 200, 500);
    return c.json({ data: orchestrator.history(limit) });
  });
  app.post("/api/control/chat", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { message?: string };
    if (!body.message) return c.json(apiError("VALIDATION_ERROR", "message is required"), 422);
    const messageText = body.message;
    const wantsStream = (c.req.header("accept") ?? "").includes("text/event-stream");
    if (wantsStream) {
      return streamSSE(c, async (stream) => {
        let finished = false;
        const heartbeat = setInterval(() => {
          if (!finished && !stream.aborted) void stream.writeSSE({ event: "heartbeat", data: "{}" }).catch(() => undefined);
        }, 15_000);
        stream.onAbort(() => {
          finished = true;
          clearInterval(heartbeat);
        });
        try {
          const result = await orchestrator.execute(messageText);
          await stream.writeSSE({ event: "done", data: JSON.stringify(result) });
        } catch (error) {
          await stream
            .writeSSE({ event: "error", data: JSON.stringify({ message: error instanceof Error ? error.message : String(error) }) })
            .catch(() => undefined);
        } finally {
          finished = true;
          clearInterval(heartbeat);
        }
      });
    }
    try {
      return c.json(await orchestrator.execute(body.message));
    } catch (error) {
      return c.json(apiError("AGENT_ERROR", error instanceof Error ? error.message : "orchestrator failed"), 502);
    }
  });
  app.post("/api/control/knowledge/search", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { query?: string; projectSlug?: string; limit?: number };
    if (!body.query) return c.json(apiError("VALIDATION_ERROR", "query is required"), 422);
    return c.json({ data: await search.searchAcrossProjects(body.query, body.limit ?? 5, body.projectSlug) });
  });

  // Project-scoped secrets
  app.get("/api/projects/:slug/secrets", (c) =>
    c.json({
      data: store.vault.list({ scope: "project", projectSlug: c.req.param("slug") }).map(({ alias, kind, metadata, createdAt }) => ({
        alias,
        kind,
        metadata,
        createdAt,
      })),
    }),
  );
  app.post("/api/projects/:slug/secrets", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { alias?: string; value?: string; kind?: string };
    if (!body.alias || !body.value) return c.json(apiError("VALIDATION_ERROR", "alias and value are required"), 422);
    if (!/^[a-z][a-z0-9:_-]{1,80}$/i.test(body.alias)) return c.json(apiError("VALIDATION_ERROR", "invalid alias"), 422);
    store.vault.upsert({
      id: crypto.randomUUID(),
      scope: "project",
      projectSlug: c.req.param("slug"),
      alias: body.alias,
      kind: body.kind ?? "generic",
      ciphertext: vault.encrypt(body.value),
      createdAt: new Date().toISOString(),
    });
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/projects/:slug/secrets/:alias", (c) =>
    c.json({
      ok: store.vault.remove({
        scope: "project",
        projectSlug: c.req.param("slug"),
        alias: c.req.param("alias"),
      }),
    }),
  );

  // Project settings
  app.get("/api/projects/:slug/settings", async (c) => {
    try {
      return c.json(await projectSettings.execute(c.req.param("slug")));
    } catch (error) {
      return c.json(apiError("NOT_FOUND", error instanceof Error ? error.message : "project not found"), 404);
    }
  });
  app.patch("/api/projects/:slug/settings", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<{
      name: string;
      description: string;
      defaultModel: string | null;
      primaryAgent: string | null;
    }>;
    try {
      return c.json(
        updateProjectSettings.execute(c.req.param("slug"), {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.defaultModel !== undefined ? { defaultModel: body.defaultModel } : {}),
          ...(body.primaryAgent !== undefined ? { primaryAgent: body.primaryAgent } : {}),
        }),
      );
    } catch (error) {
      return c.json(apiError("NOT_FOUND", error instanceof Error ? error.message : "project not found"), 404);
    }
  });

  // Projects
  app.get("/api/projects", (c) => {
    const scoped = c.req.header("x-platform-project");
    return c.json({
      data: store.projects
        .list()
        .filter((project) => !scoped || project.slug === scoped)
        .map(({ id, slug, name, description, defaultModel, primaryAgent, createdAt }) => ({
          id,
          slug,
          name,
          description,
          defaultModel,
          primaryAgent,
          createdAt,
        })),
    });
  });

  app.post("/api/projects", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      slug?: string;
      name?: string;
      description?: string;
      template?: "blank" | "triaje-operativo";
    };
    const scoped = c.req.header("x-platform-project");
    if (scoped && body.slug && body.slug !== scoped) {
      return c.json(apiError("FORBIDDEN", "a project agent cannot create another project"), 403);
    }
    if (!body.slug || !body.name) return c.json(apiError("VALIDATION_ERROR", "slug and name are required"), 422);
    try {
      return c.json(
        await createProject.execute({
          slug: body.slug,
          name: body.name,
          description: body.description,
          template: body.template === "triaje-operativo" ? "triaje-operativo" : "blank",
        }),
        201,
      );
    } catch (error) {
      return c.json(apiError("CONFLICT", error instanceof Error ? error.message : "could not create project"), 409);
    }
  });

  app.delete("/api/projects/:slug", async (c) => {
    if (c.get("serviceScope")) {
      return c.json(apiError("FORBIDDEN", "only an authenticated administrator can delete a project"), 403);
    }
    try {
      const projectSlug = c.req.param("slug");
      for (const integration of store.integrations.list({ scope: "project", projectSlug })) {
        await integrationManager.stop(integration.id).catch(() => undefined);
      }
      await deleteProject.execute(projectSlug);
      return c.body(null, 204);
    } catch (error) {
      return c.json(apiError("NOT_FOUND", error instanceof Error ? error.message : "project not found"), 404);
    }
  });

  app.get("/api/projects/:slug/workflow", async (c) => {
    try {
      return c.json(await workspace.readWorkflow(c.req.param("slug")));
    } catch {
      return c.json(apiError("NOT_FOUND", "project not found"), 404);
    }
  });

  app.put("/api/projects/:slug/workflow", async (c) => {
    const body = (await c.req.json().catch(() => undefined)) as WorkflowGraph | undefined;
    if (!body) return c.json(apiError("VALIDATION_ERROR", "workflow body is required"), 422);
    try {
      return c.json(await saveWorkflow.execute(c.req.param("slug"), body, c.get("user")?.username ?? "service"));
    } catch (error) {
      if (error instanceof WorkflowValidationError) {
        return c.json(apiError("INVALID_WORKFLOW", error.message, error.issues), 422);
      }
      if (error instanceof WorkspaceError) return c.json(apiError(error.code, error.message), 400);
      throw error;
    }
  });

  app.get("/api/projects/:slug/workflow/versions", (c) => {
    const slug = c.req.param("slug");
    if (!store.projects.findBySlug(slug)) return c.json(apiError("NOT_FOUND", "project not found"), 404);
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 100);
    return c.json({ data: store.versions.list(slug, limit) });
  });

  app.post("/api/projects/:slug/workflow/versions/:version/rollback", async (c) => {
    const slug = c.req.param("slug");
    const version = Number(c.req.param("version"));
    if (!Number.isInteger(version) || version < 1) {
      return c.json(apiError("VALIDATION_ERROR", "invalid version number"), 422);
    }
    try {
      const result = await rollbackWorkflow.execute(slug, version, c.get("user")?.username ?? "service");
      return c.json(result);
    } catch (error) {
      if (error instanceof WorkspaceError) {
        return c.json(apiError(error.code, error.message), error.code === "NOT_FOUND" ? 404 : 400);
      }
      throw error;
    }
  });

  app.get("/api/projects/:slug/runs", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);
    const runs = store.runs.listByProject(c.req.param("slug"), limit).map((run) => ({
      ...run,
      steps: store.runs.listSteps(run.id),
    }));
    return c.json({ data: runs });
  });

  app.post("/api/projects/:slug/runs", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { payload?: unknown; idempotencyKey?: string };
    try {
      const graph = await workspace.readWorkflow(c.req.param("slug"));
      await validateWorkflowResources(store, workspace, c.req.param("slug"), graph);
      const run = await executor.start({
        projectSlug: c.req.param("slug"),
        graph,
        payload: body.payload ?? {},
        entryPoint: "web_ui",
        idempotencyKey: body.idempotencyKey,
        launchedBy: c.get("user")?.username ?? (c.get("serviceScope") === "global" ? "orchestrator" : "service"),
        sourceDetail: "canvas:web",
      });
      return c.json({ ...run, steps: store.runs.listSteps(run.id) }, 202);
    } catch (error) {
      if (error instanceof WorkflowInputValidationError) {
        return c.json(apiError("VALIDATION_ERROR", error.message, error.issues), 422);
      }
      if (error instanceof WorkflowValidationError) return c.json(apiError("INVALID_WORKFLOW", error.message, error.issues), 422);
      if (error instanceof IdempotencyMismatchError) return c.json(apiError("IDEMPOTENCY_MISMATCH", error.message), 422);
      if (error instanceof RunInFlightError) return c.json(apiError("RUN_IN_FLIGHT", error.message, { runId: error.runId }), 409);
      throw error;
    }
  });

  app.get("/api/runs/:id", (c) => {
    const run = store.runs.findById(c.req.param("id"));
    const scoped = c.req.header("x-platform-project");
    if (!run) return c.json(apiError("NOT_FOUND", "run not found"), 404);
    if (scoped && run.projectSlug !== scoped) return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
    return c.json({ ...run, steps: store.runs.listSteps(run.id) });
  });

  app.post("/api/runs/:id/replay", async (c) => {
    if (c.get("serviceScope") === "global") {
      return c.json(apiError("FORBIDDEN", "global orchestrator is read-only for project data"), 403);
    }
    const body = (await c.req.json().catch(() => ({}))) as { fromNodeId?: string };
    const scoped = c.req.header("x-platform-project");
    const existing = store.runs.findById(c.req.param("id"));
    if (existing && scoped && existing.projectSlug !== scoped) {
      return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
    }
    const run = await executor.replay(
      c.req.param("id"),
      body.fromNodeId,
      "replay",
      c.get("user")?.username ?? "service",
    );
    return c.json({ ...run, steps: store.runs.listSteps(run.id) });
  });

  // Project chat
  app.get("/api/projects/:slug/chat", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 200) || 200, 500);
    return c.json({ data: chat.history(c.req.param("slug"), limit) });
  });

  app.post("/api/projects/:slug/chat", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { message?: string };
    if (!body.message) return c.json(apiError("VALIDATION_ERROR", "message is required"), 422);
    const message = body.message;
    const projectSlug = c.req.param("slug");
    const wantsStream = (c.req.header("accept") ?? "").includes("text/event-stream");
    if (wantsStream) {
      return streamSSE(c, async (stream) => {
        let finished = false;
        let writes: Promise<unknown> = Promise.resolve();
        const heartbeat = setInterval(() => {
          if (!finished && !stream.aborted) {
            void stream.writeSSE({ event: "heartbeat", data: "{}" }).catch(() => undefined);
          }
        }, 15_000);
        stream.onAbort(() => {
          finished = true;
          clearInterval(heartbeat);
        });
        const publish = (event: ChatProgressEvent) => {
          if (finished || stream.aborted) return;
          writes = writes
            .then(() =>
              stream.writeSSE({
                event: event.type === "text" ? "delta" : "activity",
                data: JSON.stringify(event),
              }),
            )
            .catch(() => undefined);
        };
        try {
          const result = await chat.execute(projectSlug, message, publish);
          await writes;
          await stream.writeSSE({ event: "done", data: JSON.stringify(result) });
        } catch (error) {
          await writes;
          const messageText = error instanceof Error ? error.message : String(error);
          await stream.writeSSE({ event: "error", data: JSON.stringify({ message: messageText }) }).catch(() => undefined);
        } finally {
          finished = true;
          clearInterval(heartbeat);
        }
      });
    }
    try {
      return c.json(await chat.execute(projectSlug, message));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "project not found";
      return c.json(
        apiError(messageText.startsWith("project not found") ? "NOT_FOUND" : "AGENT_ERROR", messageText),
        messageText.startsWith("project not found") ? 404 : 502,
      );
    }
  });

  app.get("/api/projects/:slug/nodes", async (c) => {
    try {
      return c.json({ data: await workspace.listNodes(c.req.param("slug")) });
    } catch {
      return c.json(apiError("NOT_FOUND", "project not found"), 404);
    }
  });

  app.get("/api/projects/:slug/nodes/:file{.+}", async (c) => {
    const file = c.req.param("file").replace(/^nodes\//, "");
    try {
      const code = await workspace.readNode(c.req.param("slug"), `nodes/${file}`);
      return c.json({ file, code });
    } catch (error) {
      if (error instanceof WorkspaceError) return c.json(apiError(error.code, error.message), 404);
      throw error;
    }
  });

  app.put("/api/projects/:slug/nodes/:file{.+}", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { code?: string };
    if (typeof body.code !== "string") return c.json(apiError("VALIDATION_ERROR", "code is required"), 422);
    const slug = c.req.param("slug");
    const file = c.req.param("file").replace(/^nodes\//, "");
    try {
      await workspace.writeNode(slug, `nodes/${file}`, body.code);
      const graph = await workspace.readWorkflow(slug).catch(() => undefined);
      if (graph) {
        const codeBundle = await captureCodeBundle(workspace, slug, graph);
        store.versions.record({
          projectSlug: slug,
          graphHash: computeGraphHash(graph),
          graph,
          codeBundle,
          createdBy: c.get("user")?.username ?? "service",
        });
      }
      return c.json({ ok: true });
    } catch (error) {
      if (error instanceof WorkspaceError) return c.json(apiError(error.code, error.message), 400);
      throw error;
    }
  });

  app.get("/api/projects/:slug/agents", async (c) => c.json({ data: await agents.list(c.req.param("slug")) }));

  app.put("/api/projects/:slug/agents/:category/:role", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      description?: string;
      mode?: "primary" | "subagent" | "all";
      model?: string;
      body?: string;
      permissions?: Array<{ action: string; resource: string; effect: "allow" | "deny" | "ask" }>;
      notebooks?: string[];
    };
    if (!body.description || !body.body) return c.json(apiError("VALIDATION_ERROR", "description and body are required"), 422);
    try {
      const profile = await agents.upsert(c.req.param("slug"), {
        category: c.req.param("category"),
        role: c.req.param("role"),
        frontmatter: {
          description: body.description,
          mode: body.mode ?? "subagent",
          model: body.model,
          permissions: body.permissions ?? [],
          notebooks: body.notebooks ?? [],
        },
        body: body.body,
      });
      if (profile.frontmatter.mode === "primary") {
        store.projects.update(c.req.param("slug"), { primaryAgent: `${profile.category}/${profile.role}` });
      }
      return c.json(profile);
    } catch (error) {
      return c.json(apiError("VALIDATION_ERROR", error instanceof Error ? error.message : "invalid agent"), 422);
    }
  });

  app.delete("/api/projects/:slug/agents/:category/:role", async (c) => {
    await agents.remove(c.req.param("slug"), c.req.param("category"), c.req.param("role"));
    return c.json({ ok: true });
  });

  app.get("/api/projects/:slug/mcp", async (c) => c.json({ data: await agents.listMcp(c.req.param("slug")) }));
  app.put("/api/projects/:slug/mcp", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { name?: string; config?: never };
    if (!body.name || !body.config) return c.json(apiError("VALIDATION_ERROR", "name and config are required"), 422);
    await agents.upsertMcp(c.req.param("slug"), body.name, body.config);
    return c.json({ ok: true });
  });
  app.delete("/api/projects/:slug/mcp/:name", async (c) => {
    await agents.removeMcp(c.req.param("slug"), c.req.param("name"));
    return c.json({ ok: true });
  });

  // Knowledge inside projects
  app.get("/api/projects/:slug/notebooks", (c) =>
    c.json({
      data: store.notebooks.list(c.req.param("slug")).map((notebook) => ({
        ...notebook,
        sources: store.knowledge.listSources(notebook.id).length,
      })),
    }),
  );
  app.post("/api/projects/:slug/notebooks", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { slug?: string; name?: string; description?: string };
    if (!body.slug || !body.name) return c.json(apiError("VALIDATION_ERROR", "slug and name are required"), 422);
    try {
      return c.json(ingest.createNotebook(c.req.param("slug"), { slug: body.slug, name: body.name, description: body.description }), 201);
    } catch (error) {
      return c.json(apiError("CONFLICT", error instanceof Error ? error.message : "could not create notebook"), 409);
    }
  });
  app.get("/api/projects/:slug/notebooks/:notebookSlug/sources", (c) => {
    const notebook = store.notebooks.findBySlug(c.req.param("slug"), c.req.param("notebookSlug"));
    if (!notebook) return c.json(apiError("NOT_FOUND", "notebook not found"), 404);
    return c.json({ data: store.knowledge.listSources(notebook.id) });
  });
  app.post("/api/projects/:slug/notebooks/:notebookSlug/sources", async (c) => {
    const body = await c.req.parseBody().catch(() => undefined);
    const file = body?.file;
    if (!(file instanceof File)) return c.json(apiError("VALIDATION_ERROR", "multipart field 'file' is required"), 422);
    try {
      const result = await ingest.ingestFile(c.req.param("slug"), c.req.param("notebookSlug"), {
        filename: file.name,
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json(result, 201);
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/notebooks/:notebookSlug/url", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { url?: string };
    if (!body.url) return c.json(apiError("VALIDATION_ERROR", "url is required"), 422);
    try {
      return c.json(await ingest.ingestUrl(c.req.param("slug"), c.req.param("notebookSlug"), body.url), 201);
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/notebooks/:notebookSlug/search", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { query?: string; limit?: number };
    if (!body.query) return c.json(apiError("VALIDATION_ERROR", "query is required"), 422);
    return c.json({
      data: await search.execute(c.req.param("slug"), c.req.param("notebookSlug"), body.query, body.limit ?? 5),
    });
  });
  app.post("/api/projects/:slug/knowledge/search", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { query?: string; limit?: number };
    if (!body.query) return c.json(apiError("VALIDATION_ERROR", "query is required"), 422);
    return c.json({ data: await search.searchProject(c.req.param("slug"), body.query, body.limit ?? 5) });
  });

  app.get("/api/models", async (c) => c.json({ data: await agent.listModels() }));

  app.post("/api/providers/opencode-go", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { apiKey?: string };
    if (!body.apiKey) return c.json(apiError("VALIDATION_ERROR", "apiKey is required"), 422);
    try {
      return c.json(await connectProvider.execute(body.apiKey));
    } catch (error) {
      return c.json(apiError("PROVIDER_ERROR", error instanceof Error ? error.message : "provider failed"), 502);
    }
  });

  // Platform/global secrets. Project secrets live under /api/projects/:slug/secrets.
  app.get("/api/vault/secrets", (c) =>
    c.json({
      data: store.vault.list({ scope: "global" }).map(({ alias, kind, metadata, createdAt }) => ({ alias, kind, metadata, createdAt })),
    }),
  );
  app.post("/api/vault/secrets", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { alias?: string; value?: string; kind?: string };
    if (!body.alias || !body.value) return c.json(apiError("VALIDATION_ERROR", "alias and value are required"), 422);
    if (!/^[a-z][a-z0-9:_-]{1,80}$/i.test(body.alias)) return c.json(apiError("VALIDATION_ERROR", "invalid alias"), 422);
    store.vault.upsert({
      id: crypto.randomUUID(),
      scope: "global",
      alias: body.alias,
      kind: body.kind ?? "generic",
      ciphertext: vault.encrypt(body.value),
      createdAt: new Date().toISOString(),
    });
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/vault/secrets/:alias", (c) =>
    c.json({ ok: store.vault.remove({ scope: "global", alias: c.req.param("alias") }) }),
  );

  // External database test/query through integration IDs.
  app.post("/api/control/integrations/:id/database/test", async (c) => {
    try {
      return c.json(await testDatabase.execute(c.req.param("id"), { scope: "global" }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/database/test", async (c) => {
    try {
      return c.json(await testDatabase.execute(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") }));
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/database/query", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { sql?: string; params?: unknown[] };
    if (!body.sql) return c.json(apiError("VALIDATION_ERROR", "sql is required"), 422);
    try {
      return c.json({
        data: await queryDatabase.execute(
          c.req.param("id"),
          { scope: "project", projectSlug: c.req.param("slug") },
          body.sql,
          body.params ?? [],
        ),
      });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/control/integrations/:id/database/query", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { sql?: string; params?: unknown[] };
    if (!body.sql) return c.json(apiError("VALIDATION_ERROR", "sql is required"), 422);
    try {
      return c.json({
        data: await queryDatabase.execute(c.req.param("id"), { scope: "global" }, body.sql, body.params ?? []),
      });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/projects/:slug/integrations/:id/notify", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { text?: string; recipient?: string };
    if (!body.text) return c.json(apiError("VALIDATION_ERROR", "text is required"), 422);
    try {
      integrations.get(c.req.param("id"), { scope: "project", projectSlug: c.req.param("slug") });
      await integrationManager.send(c.req.param("id"), body.text, body.recipient);
      return c.json({ ok: true });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.post("/api/control/integrations/:id/notify", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { text?: string; recipient?: string };
    if (!body.text) return c.json(apiError("VALIDATION_ERROR", "text is required"), 422);
    try {
      integrations.get(c.req.param("id"), { scope: "global" });
      await integrationManager.send(c.req.param("id"), body.text, body.recipient);
      return c.json({ ok: true });
    } catch (error) {
      return integrationError(c, error);
    }
  });
  app.get("/api/control/runs", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 20) || 20, 100);
    return c.json({
      data: store.runs.listRecent(limit).map((run) => ({ ...run, steps: store.runs.listSteps(run.id) })),
    });
  });
  app.get("/api/control/errors", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    return c.json({ data: store.errors.recent(limit) });
  });

  app.get("/api/settings", (c) =>
    c.json({
      data: {
        opencodeMode: env.OPENCODE_MODE ?? "auto",
        sentryConfigured: Boolean(store.vault.findByAlias({ scope: "global", alias: "setting:sentry_dsn" }) || config.sentryDsn),
        providerConnected: Boolean(store.vault.findByAlias({ scope: "global", alias: "provider:opencode-go" })),
        defaultModel: store.settings.get("default_model") || undefined,
        dataDir: config.dataDir,
      },
    }),
  );
  app.put("/api/settings", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as {
      sentryDsn?: string;
      defaultModel?: string | null;
    };
    if (body.sentryDsn) {
      store.vault.upsert({
        id: crypto.randomUUID(),
        scope: "global",
        alias: "setting:sentry_dsn",
        kind: "sentry_dsn",
        ciphertext: vault.encrypt(body.sentryDsn),
        createdAt: new Date().toISOString(),
      });
    }
    if (body.defaultModel !== undefined) {
      if (body.defaultModel === null || body.defaultModel.trim() === "") {
        store.settings.set("default_model", "");
      } else {
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*(#[a-zA-Z0-9._-]+)?$/.test(body.defaultModel)) {
          return c.json(apiError("VALIDATION_ERROR", "defaultModel must use provider/model#variant format"), 422);
        }
        store.settings.set("default_model", body.defaultModel);
      }
    }
    return c.json({ ok: true, requiresRestart: Boolean(body.sentryDsn) });
  });

  app.get("/api/system/health", async (c) => c.json(await health.execute()));
  app.get("/api/system/errors", (c) => {
    const limit = Math.min(Number(c.req.query("limit") ?? 50) || 50, 200);
    return c.json({ data: store.errors.recent(limit) });
  });

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) });
      const unsubscribe = events.subscribe((event) => {
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) }).catch(() => undefined);
      });
      stream.onAbort(unsubscribe);
      while (!stream.aborted) {
        await stream.sleep(25_000);
        if (stream.aborted) break;
        await stream.writeSSE({ event: "ping", data: JSON.stringify({ at: new Date().toISOString() }) }).catch(() => undefined);
      }
    }),
  );

  const webDist = config.webDist ?? join(import.meta.dir, "../../web/dist");
  const indexHtmlPath = join(webDist, "index.html");
  if (existsSync(indexHtmlPath)) {
    const indexHtml = await Bun.file(indexHtmlPath).text();
    app.use("/assets/*", serveStatic({ root: webDist }));
    app.get("*", (c) =>
      c.req.path.startsWith("/api/") ? c.json(apiError("NOT_FOUND", "route not found"), 404) : c.html(indexHtml),
    );
  } else {
    app.get("/", (c) => c.text("Agentic platform API. Build apps/web to serve the UI."));
  }

  app.onError((error, c) => {
    const requestId = c.get("requestId");
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ event: "request_failed", entryPoint: "web_ui", requestId, error: message, path: c.req.path });
    errorTracker.captureException(error, { entryPoint: "web_ui", requestId });
    store.errors.insert({
      id: crypto.randomUUID(),
      requestId,
      entryPoint: "web_ui",
      level: "error",
      message,
      stack: error instanceof Error ? error.stack : undefined,
      context: JSON.stringify({ path: c.req.path }),
      createdAt: new Date().toISOString(),
    });
    return c.json(apiError("INTERNAL_ERROR", "unexpected server error", { requestId }), 500);
  });

  await integrationManager.startAll();
  return {
    app,
    store,
    events,
    agent,
    integrationManager,
    scheduler,
    close: () => {
      scheduler.stop();
      alerts.stop();
      void integrationManager.stopAll();
      store.close();
    },
  };
}
