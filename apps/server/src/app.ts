import { existsSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { apiError, type WorkflowGraph } from "@platform/shared";
import type { UserRecord } from "./domain/entities.ts";
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
  QueryExternalDatabaseUseCase,
  SaveExternalDatabaseUseCase,
  TestExternalDatabaseUseCase,
} from "./application/use-cases/connections.ts";
import { ChatWithProjectUseCase, CreateProjectUseCase, SaveWorkflowUseCase, syncProjectsFromDisk } from "./application/use-cases/projects.ts";
import { GetHealthUseCase } from "./application/use-cases/health.ts";
import { RouteIncomingMessageUseCase } from "./application/use-cases/route-channel-message.ts";
import { ChannelEgressRouter } from "./infrastructure/in/channels/egress-router.ts";
import { createChannelManagementRoutes, createExternalChatRoutes } from "./infrastructure/in/http/external-chat-routes.ts";
import { ChannelManager } from "./infrastructure/in/channels/channel-manager.ts";
import { WorkspaceError } from "./infrastructure/out/workspace-fs/safe-workspace.ts";
import {
  IdempotencyMismatchError,
  RunInFlightError,
  WorkflowValidationError,
} from "./domain/workflow/graph.ts";

export interface AppConfig {
  dataDir: string;
  databasePath?: string;
  initialAdminPassword?: string;
  serviceToken?: string;
  sentryDsn?: string;
  webDist?: string;
  secureCookies?: boolean;
  env?: Record<string, string | undefined>;
  logger?: Logger;
}

export interface Application {
  app: Hono<{ Variables: { requestId: string; user: UserRecord } }>;
  store: SqliteStore;
  events: SseHub;
  channelManager: ChannelManager;
  close(): void;
}

type AppEnv = { Variables: { requestId: string; user: UserRecord } };

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
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

  const workspace = new SafeFsWorkspaceAdapter(join(config.dataDir, "workspaces"));
  await syncProjectsFromDisk(store, workspace);
  // Backfill isolation permissions for projects created before this rule existed.
  for (const slug of await workspace.listProjects()) {
    const projectConfig = await workspace.readOpencodeConfig(slug);
    if (!Array.isArray(projectConfig.permissions)) {
      projectConfig.permissions = PROJECT_ISOLATION_PERMISSIONS;
      await workspace.writeOpencodeConfig(slug, projectConfig);
    }
  }

  const agent = createAgentRuntime(env);
  const worker = new BunWorkerPoolAdapter();
  const events = new SseHub();
  const metrics = new InMemoryMetrics();
  const errorTracker = config.sentryDsn ? new SentryErrorTracker(config.sentryDsn, env.SENTRY_ENVIRONMENT ?? "production") : new NoopErrorTracker();
  const codec = new SessionCodec(masterKey.toString("base64"));
  const egress = new ChannelEgressRouter();
  const externalDb = new DynamicDatabaseClientAdapter();
  const queryDatabase = new QueryExternalDatabaseUseCase(store, vault, externalDb);
  const embeddings = createEmbeddingAdapter(env);
  const knowledgeFiles = new KnowledgeFileStore(join(config.dataDir, "knowledge"));
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
      db: ({ alias, sql, params }) => queryDatabase.execute(alias, sql, params),
      notify: ({ channelSlug, text }) => egress.send(channelSlug, text),
    },
    defaultModel: () => store.settings.get("default_model") || undefined,
    knowledgeContext: async (notebookIds, query, strict) => {
      const results = [];
      for (const notebookId of notebookIds) {
        const hits = await search.execute(notebookId, JSON.stringify(query).slice(0, 500), 4).catch(() => []);
        results.push(...hits);
      }
      return buildGroundedContext(results, strict);
    },
  });

  const createProject = new CreateProjectUseCase(store, workspace, events);
  const saveWorkflow = new SaveWorkflowUseCase(workspace, events);
  const chat = new ChatWithProjectUseCase({
    store,
    workspace,
    agent,
    events,
    defaultModel: () => store.settings.get("default_model") || undefined,
    timeoutMs: Number(env.AGENT_CHAT_TIMEOUT_MS ?? 900_000),
  });
  const agents = new ManageSubagentsUseCase(workspace, new MarkdownAgentAdapter(workspace), agent, events);
  const connectProvider = new ConnectProviderUseCase(store, vault, agent);
  const saveDatabase = new SaveExternalDatabaseUseCase(store, vault);
  const testDatabase = new TestExternalDatabaseUseCase(store, vault, externalDb);
  const health = new GetHealthUseCase({ store, agent, metrics, startedAt: Date.now() });
  const router = new RouteIncomingMessageUseCase({
    store,
    workspace,
    agent,
    executor,
    egress,
    events,
    logger,
    orchestratorDirectory: config.dataDir,
  });
  const channelManager = new ChannelManager({
    store,
    vault,
    egress,
    events,
    logger,
    router,
    dataDir: config.dataDir,
    env,
    fetchImpl: fetch,
  });

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
    if (path.startsWith("/api/v1/channels/")) return next();
    const token = c.req.header("x-platform-token");
    if (config.serviceToken && token && safeEqual(token, config.serviceToken)) return next();
    return authMiddleware(store, codec)(c, next);
  });

  // Project-scoped service calls (the OpenCode plugin sends this header from
  // ctx.location.directory). A project agent can never read or mutate a sibling.
  app.use("/api/projects/:slug/*", async (c, next) => {
    const scoped = c.req.header("x-platform-project");
    if (scoped && c.req.param("slug") !== scoped) {
      return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
    }
    await next();
  });

  app.route("/api/auth", createAuthRoutes({ store, hasher, codec, secureCookies: config.secureCookies ?? env.NODE_ENV === "production" }));
  app.route(
    "/api",
    createExternalChatRoutes({
      store,
      vault,
      agent,
      workspace,
      executor,
      egress,
      events,
      defaultDirectory: config.dataDir,
    }),
  );
  app.route(
    "/api",
    createChannelManagementRoutes({
      store,
      vault,
      events,
      egress,
      onCreated: (channel) => channelManager.start(channel),
    }),
  );

  app.post("/api/channels/:slug/start", async (c) => {
    const channel = store.channels.findBySlug(c.req.param("slug"));
    if (!channel) return c.json(apiError("NOT_FOUND", "channel not found"), 404);
    try {
      await channelManager.start(channel);
      return c.json({ ok: true, status: store.channels.findBySlug(channel.slug)?.status });
    } catch (error) {
      return c.json(apiError("CHANNEL_ERROR", error instanceof Error ? error.message : "start failed"), 503);
    }
  });

  app.post("/api/channels/:slug/stop", async (c) => {
    await channelManager.stop(c.req.param("slug"));
    return c.json({ ok: true });
  });

  app.get("/api/projects", (c) => {
    const scoped = c.req.header("x-platform-project");
    return c.json({
      data: store.projects
        .list()
        .filter((project) => !scoped || project.slug === scoped)
        .map(({ id, slug, name, description, createdAt }) => ({ id, slug, name, description, createdAt })),
    });
  });

  app.post("/api/projects", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { slug?: string; name?: string; description?: string };
    const scoped = c.req.header("x-platform-project");
    if (scoped && body.slug && body.slug !== scoped) {
      return c.json(apiError("FORBIDDEN", "a project agent cannot create another project"), 403);
    }
    if (!body.slug || !body.name) return c.json(apiError("VALIDATION_ERROR", "slug and name are required"), 422);
    try {
      return c.json(await createProject.execute({ slug: body.slug, name: body.name, description: body.description }), 201);
    } catch (error) {
      return c.json(apiError("CONFLICT", error instanceof Error ? error.message : "could not create project"), 409);
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
      return c.json(await saveWorkflow.execute(c.req.param("slug"), body));
    } catch (error) {
      if (error instanceof WorkflowValidationError) {
        return c.json(apiError("INVALID_WORKFLOW", error.message, error.issues), 422);
      }
      if (error instanceof WorkspaceError) return c.json(apiError(error.code, error.message), 400);
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
      const run = await executor.execute({
        projectSlug: c.req.param("slug"),
        graph,
        payload: body.payload ?? {},
        entryPoint: "web_ui",
        idempotencyKey: body.idempotencyKey,
      });
      return c.json({ ...run, steps: store.runs.listSteps(run.id) }, 202);
    } catch (error) {
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
    const body = (await c.req.json().catch(() => ({}))) as { fromNodeId?: string };
    const scoped = c.req.header("x-platform-project");
    const existing = store.runs.findById(c.req.param("id"));
    if (existing && scoped && existing.projectSlug !== scoped) {
      return c.json(apiError("FORBIDDEN", "project scope mismatch"), 403);
    }
    const run = await executor.replay(c.req.param("id"), body.fromNodeId);
    return c.json({ ...run, steps: store.runs.listSteps(run.id) });
  });

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
        const heartbeat = setInterval(() => {
          if (!finished && !stream.aborted) {
            void stream.writeSSE({ event: "heartbeat", data: "{}" }).catch(() => undefined);
          }
        }, 15_000);
        stream.onAbort(() => {
          finished = true;
          clearInterval(heartbeat);
        });
        try {
          const result = await chat.execute(projectSlug, message);
          await stream.writeSSE({ event: "done", data: JSON.stringify(result) });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await stream.writeSSE({ event: "error", data: JSON.stringify({ message }) }).catch(() => undefined);
        } finally {
          finished = true;
          clearInterval(heartbeat);
        }
      });
    }
    try {
      return c.json(await chat.execute(projectSlug, message));
    } catch (error) {
      const message = error instanceof Error ? error.message : "project not found";
      return c.json(apiError(message.startsWith("project not found") ? "NOT_FOUND" : "AGENT_ERROR", message), message.startsWith("project not found") ? 404 : 502);
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
    const file = c.req.param("file").replace(/^nodes\//, "");
    try {
      await workspace.writeNode(c.req.param("slug"), `nodes/${file}`, body.code);
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

  app.get("/api/vault/secrets", (c) =>
    c.json({ data: store.vault.list().map(({ alias, kind, metadata, createdAt }) => ({ alias, kind, metadata, createdAt })) }),
  );
  app.post("/api/vault/secrets", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { alias?: string; value?: string; kind?: string };
    if (!body.alias || !body.value) return c.json(apiError("VALIDATION_ERROR", "alias and value are required"), 422);
    if (!/^[a-z][a-z0-9:_-]{1,80}$/i.test(body.alias)) return c.json(apiError("VALIDATION_ERROR", "invalid alias"), 422);
    store.vault.upsert({
      id: crypto.randomUUID(),
      alias: body.alias,
      kind: body.kind ?? "generic",
      ciphertext: vault.encrypt(body.value),
      createdAt: new Date().toISOString(),
    });
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/vault/secrets/:alias", (c) => c.json({ ok: store.vault.remove(c.req.param("alias")) }));

  app.get("/api/databases", (c) => c.json({ data: saveDatabase.list() }));
  app.post("/api/databases", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { alias?: string; config?: never };
    if (!body.alias || !body.config) return c.json(apiError("VALIDATION_ERROR", "alias and config are required"), 422);
    saveDatabase.execute(body.alias, body.config);
    return c.json({ ok: true }, 201);
  });
  app.delete("/api/databases/:alias", (c) => c.json({ ok: saveDatabase.remove(c.req.param("alias")) }));
  app.post("/api/databases/:alias/test", async (c) => c.json(await testDatabase.execute(c.req.param("alias"))));
  app.post("/api/databases/:alias/query", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { sql?: string; params?: unknown[] };
    if (!body.sql) return c.json(apiError("VALIDATION_ERROR", "sql is required"), 422);
    try {
      return c.json({ data: await queryDatabase.execute(c.req.param("alias"), body.sql, body.params) });
    } catch (error) {
      return c.json(apiError("DATABASE_ERROR", error instanceof Error ? error.message : "query failed"), 400);
    }
  });

  app.get("/api/notebooks", (c) =>
    c.json({
      data: store.notebooks.list().map((notebook) => ({
        ...notebook,
        sources: store.knowledge.listSources(notebook.id).length,
      })),
    }),
  );
  app.post("/api/notebooks", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { slug?: string; name?: string; description?: string };
    if (!body.slug || !body.name) return c.json(apiError("VALIDATION_ERROR", "slug and name are required"), 422);
    try {
      return c.json(ingest.createNotebook({ slug: body.slug, name: body.name, description: body.description }), 201);
    } catch (error) {
      return c.json(apiError("CONFLICT", error instanceof Error ? error.message : "could not create notebook"), 409);
    }
  });
  app.get("/api/notebooks/:slug/sources", (c) => {
    const notebook = store.notebooks.findBySlug(c.req.param("slug"));
    if (!notebook) return c.json(apiError("NOT_FOUND", "notebook not found"), 404);
    return c.json({ data: store.knowledge.listSources(notebook.id) });
  });
  app.post("/api/notebooks/:slug/sources", async (c) => {
    const body = await c.req.parseBody().catch(() => undefined);
    const file = body?.file;
    if (!(file instanceof File)) return c.json(apiError("VALIDATION_ERROR", "multipart field 'file' is required"), 422);
    try {
      const result = await ingest.ingestFile(c.req.param("slug"), {
        filename: file.name,
        mime: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
      return c.json(result, 201);
    } catch (error) {
      if (error instanceof KnowledgeError) return c.json(apiError(error.code, error.message), error.code === "UNSAFE_URL" ? 422 : 400);
      throw error;
    }
  });
  app.post("/api/notebooks/:slug/url", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { url?: string };
    if (!body.url) return c.json(apiError("VALIDATION_ERROR", "url is required"), 422);
    try {
      return c.json(await ingest.ingestUrl(c.req.param("slug"), body.url), 201);
    } catch (error) {
      if (error instanceof KnowledgeError) return c.json(apiError(error.code, error.message), error.code === "UNSAFE_URL" ? 422 : 400);
      throw error;
    }
  });
  app.post("/api/notebooks/:slug/search", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { query?: string; limit?: number };
    if (!body.query) return c.json(apiError("VALIDATION_ERROR", "query is required"), 422);
    return c.json({ data: await search.execute(c.req.param("slug"), body.query, body.limit ?? 5) });
  });

  app.get("/api/settings", (c) =>
    c.json({
      data: {
        opencodeMode: env.OPENCODE_MODE ?? "auto",
        sentryConfigured: Boolean(store.vault.findByAlias("setting:sentry_dsn") || config.sentryDsn),
        providerConnected: Boolean(store.vault.findByAlias("provider:opencode-go")),
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

  return {
    app,
    store,
    events,
    channelManager,
    close: () => store.close(),
  };
}
