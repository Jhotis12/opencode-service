import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApplication, type Application } from "../src/app.ts";
import type { TelegramTransport } from "../src/infrastructure/in/channels/telegram-adapter.ts";
import type { Logger, LogBindings } from "../src/domain/telemetry/index.ts";
import type { WorkflowGraph } from "@platform/shared";

let dir: string;
let application: Application;
let app: Application["app"];
let cookie = "";
const serviceToken = "service-token-test";
const globalServiceToken = "global-token-test";
const logEntries: Array<{ level: string; bindings: LogBindings }> = [];
const testLogger: Logger = {
  debug(bindings) {
    logEntries.push({ level: "debug", bindings });
  },
  info(bindings) {
    logEntries.push({ level: "info", bindings });
  },
  warn(bindings) {
    logEntries.push({ level: "warn", bindings });
  },
  error(bindings) {
    logEntries.push({ level: "error", bindings });
  },
  child() {
    return testLogger;
  },
};

function fakeTelegramTransport(): TelegramTransport {
  return {
    type: "telegram",
    async verify() {
      return { botId: "test-bot", username: "test_bot" };
    },
    async clearWebhook() {},
    async start() {},
    async send() {
      return { providerMessageId: "fake-1" };
    },
    async sendVoice() {
      return { providerMessageId: "fake-voice-1" };
    },
    async sendAudio() {
      return { providerMessageId: "fake-audio-1" };
    },
    async stop() {},
    status() {
      return "connected";
    },
  };
}

async function json(path: string, init: RequestInit = {}, useCookie = true) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (useCookie && cookie) headers.cookie = cookie;
  return app.request(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "platform-http-"));
  application = await createApplication({
    dataDir: dir,
    env: { ...process.env, OPENCODE_MODE: "fake", DEFAULT_MODEL: "opencode/deepseek-v4.1-flash-free", ORCHESTRATOR_MODEL: "opencode-go/fast", SENTRY_DSN: "" },
    serviceToken,
    globalServiceToken,
    logger: testLogger,
    telegramTransportFactory: () => fakeTelegramTransport(),
  });
  app = application.app;
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123!" }),
  });
  cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  await json("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword: "admin123!", newPassword: "plataforma-segura-2026" }),
  });
});

afterAll(async () => {
  application.close();
  await rm(dir, { recursive: true, force: true });
});

describe("application HTTP surface", () => {
  it("blocks unauthenticated API access and accepts the service token", async () => {
    const anonymous = await app.request("/api/projects");
    expect(anonymous.status).toBe(401);
    const service = await app.request("/api/projects", {
      headers: { "x-platform-token": globalServiceToken, "x-platform-scope": "global" },
    });
    expect(service.status).toBe(200);
  });

  it("rejects service calls without an explicit scope", async () => {
    const missing = await app.request("/api/projects", { headers: { "x-platform-token": serviceToken } });
    expect(missing.status).toBe(403);
    const escalated = await app.request("/api/control/overview", {
      headers: { "x-platform-token": serviceToken, "x-platform-project": "ventas-bot" },
    });
    expect(escalated.status).toBe(403);
    const globalMutation = await app.request("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-platform-token": globalServiceToken,
        "x-platform-scope": "global",
      },
      body: JSON.stringify({}),
    });
    expect(globalMutation.status).toBe(403);
    expect(logEntries.some((entry) => entry.bindings.event === "global_mutation_rejected")).toBe(true);
    const projectVault = await app.request("/api/vault/secrets", {
      headers: { "x-platform-token": serviceToken, "x-platform-project": "ventas-bot" },
    });
    expect(projectVault.status).toBe(403);
  });

  it("creates a project and serves its workflow", async () => {
    const created = await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "ventas-bot", name: "Ventas Bot", description: "Atención de leads" }),
    });
    expect(created.status).toBe(201);
    const workflow = await json("/api/projects/ventas-bot/workflow");
    expect(workflow.status).toBe(200);
    const graph = (await workflow.json()) as WorkflowGraph;
    expect(graph.nodes[0]?.type).toBe("trigger");
  });

  it("deletes a project vault secret through the shared vault alias route", async () => {
    const slug = "vault-alias-bot";
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug, name: "Vault Alias Bot" }),
    });
    await json(`/api/projects/${slug}/secrets`, {
      method: "POST",
      body: JSON.stringify({ alias: "api_key", value: "project-value" }),
    });
    await json("/api/vault/secrets", {
      method: "POST",
      body: JSON.stringify({ alias: "api_key", value: "global-value" }),
    });

    const blank = await json("/api/vault/secrets/api_key?project=%20", { method: "DELETE" });
    expect(blank.status).toBe(400);
    const invalid = await json("/api/vault/secrets/api_key?project=Bad_Slug", { method: "DELETE" });
    expect(invalid.status).toBe(400);
    const missing = await json("/api/vault/secrets/api_key?project=missing-bot", { method: "DELETE" });
    expect(missing.status).toBe(404);

    const removed = await json(`/api/vault/secrets/api_key?project=${slug}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect((await removed.json()) as { ok: boolean }).toEqual({ ok: true });

    const projectSecrets = await json(`/api/projects/${slug}/secrets`);
    expect(((await projectSecrets.json()) as { data: unknown[] }).data).toEqual([]);
    const globalSecrets = await json("/api/vault/secrets");
    const global = (await globalSecrets.json()) as { data: Array<{ alias: string }> };
    expect(global.data.some((secret) => secret.alias === "api_key")).toBe(true);
  });

  it("manages project destinations and keeps them scoped", async () => {
    const project = await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "destinos-bot", name: "Destinos Bot" }),
    });
    expect(project.status).toBe(201);
    const created = await json("/api/projects/destinos-bot/destinations", {
      method: "POST",
      body: JSON.stringify({ kind: "telegram_chat", label: "Admin", value: "123456" }),
    });
    expect(created.status).toBe(201);
    const destination = (await created.json()) as { id: string };
    const list = await json("/api/projects/destinos-bot/destinations");
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1);
    const updated = await json(`/api/projects/destinos-bot/destinations/${destination.id}`, {
      method: "PATCH",
      body: JSON.stringify({ label: "Supervisor" }),
    });
    expect(updated.status).toBe(200);
    const forbidden = await json(`/api/projects/ventas-bot/destinations/${destination.id}`, {
      method: "PATCH",
      body: JSON.stringify({ label: "Nope" }),
    });
    expect(forbidden.status).toBe(403);
    const removed = await json(`/api/projects/destinos-bot/destinations/${destination.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
  });

  it("exposes effective configuration with source and masked secrets", async () => {
    await json("/api/projects/ventas-bot/settings", {
      method: "PATCH",
      body: JSON.stringify({ defaultModel: "opencode-go/vision" }),
    });
    const response = await json("/api/config/effective?project=ventas-bot");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      platform: Array<{ key: string; source: string; value: unknown; editable: boolean; masked?: string }>;
      project: Array<{ key: string; source: string; value: unknown }>;
    };
    expect(body.platform.find((item) => item.key === "orchestratorModel")?.source).toBe("environment");
    expect(body.platform.find((item) => item.key === "defaultModel")?.value).toBe("opencode/deepseek-v4.1-flash-free");
    expect(body.platform.find((item) => item.key === "defaultModel")?.source).toBe("platform");
    expect(body.platform.find((item) => item.key === "opencodeMode")?.editable).toBe(false);
    expect(body.project.find((item) => item.key === "defaultModel")?.source).toBe("project");
    expect(body.project.find((item) => item.key === "defaultModel")?.value).toBe("opencode-go/vision");
  });

  it("persists a UI Sentry DSN and exposes it masked", async () => {
    const saved = await json("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ sentryDsn: "https://public@example.com/1" }),
    });
    expect(saved.status).toBe(200);
    const effective = await json("/api/config/effective");
    const body = (await effective.json()) as { platform: Array<{ key: string; source: string; masked?: string; value: unknown }> };
    const sentry = body.platform.find((item) => item.key === "sentryDsn");
    expect(sentry?.source).toBe("platform");
    expect(sentry?.masked).toContain("…");
    expect(JSON.stringify(sentry)).not.toContain("public@example.com");

    const invalid = await json("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ sentryDsn: "not-a-url" }),
    });
    expect(invalid.status).toBe(422);
  });

  it("creates project-owned integrations and keeps them scoped", async () => {
    const created = await json("/api/projects/ventas-bot/integrations", {
      method: "POST",
      body: JSON.stringify({
        kind: "telegram",
        name: "Bot de ventas",
        slug: "bot-ventas",
        config: { routing: { mode: "hybrid", allowlist: ["123"], public: true } },
        secrets: { token: "telegram-secret" },
      }),
    });
    expect(created.status).toBe(201);
    const payload = (await created.json()) as { integration: { id: string; scope: string }; };
    expect(payload.integration.scope).toBe("project");
    const list = await json("/api/projects/ventas-bot/integrations");
    const body = (await list.json()) as { data: Array<{ id: string }> };
    expect(body.data.some((integration) => integration.id === payload.integration.id)).toBe(true);
    const sibling = await app.request(`/api/projects/otro-bot/integrations/${payload.integration.id}`, {
      headers: { "x-platform-token": serviceToken, "x-platform-project": "otro-bot" },
    });
    expect(sibling.status).toBe(403);
    const tested = await json(`/api/projects/ventas-bot/integrations/${payload.integration.id}/test`, { method: "POST" });
    expect(tested.status).toBe(200);
  });

  it("saves workflows and node files, rejecting traversal", async () => {
    const graph = (await (await json("/api/projects/ventas-bot/workflow")).json()) as WorkflowGraph;
    graph.nodes.push({
      id: "reply",
      type: "code",
      codeFile: "nodes/reply.ts",
      position: { x: 200, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 5000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e1", source: "start", target: "reply" });
    const saved = await json("/api/projects/ventas-bot/workflow", { method: "PUT", body: JSON.stringify(graph) });
    expect(saved.status).toBe(200);

    const node = await json("/api/projects/ventas-bot/nodes/reply.ts", {
      method: "PUT",
      body: JSON.stringify({ code: `export default async () => ({ ok: true });` }),
    });
    expect(node.status).toBe(200);
    const read = await json("/api/projects/ventas-bot/nodes/reply.ts");
    expect(((await read.json()) as { code: string }).code).toContain("ok: true");

    const traversal = await json("/api/projects/ventas-bot/nodes/..%2F..%2Fescape.ts", {
      method: "PUT",
      body: JSON.stringify({ code: "x" }),
    });
    expect(traversal.status).toBe(400);
  });

  it("validates workflow resource references before saving", async () => {
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "refs-bot", name: "Refs Bot" }),
    });
    const created = await json("/api/projects/refs-bot/integrations", {
      method: "POST",
      body: JSON.stringify({
        kind: "external_chat",
        name: "Refs chat",
        slug: "refs-chat",
        config: { routing: { mode: "workflow", allowlist: [], public: true } },
      }),
    });
    const integration = (await created.json()) as { integration: { id: string } };
    const workflow = (await (await json("/api/projects/refs-bot/workflow")).json()) as WorkflowGraph;
    workflow.nodes[0] = {
      ...workflow.nodes[0]!,
      config: { kind: "integration", integrationId: integration.integration.id, event: "message.received" },
    };
    const valid = await json("/api/projects/refs-bot/workflow", { method: "PUT", body: JSON.stringify(workflow) });
    expect(valid.status).toBe(200);

    const missing = structuredClone(workflow);
    missing.nodes[0] = { ...missing.nodes[0]!, config: { kind: "integration", integrationId: "missing", event: "message.received" } };
    const invalid = await json("/api/projects/refs-bot/workflow", { method: "PUT", body: JSON.stringify(missing) });
    expect(invalid.status).toBe(422);

    const badAgent = structuredClone(workflow);
    badAgent.nodes.push({
      id: "agent",
      type: "agent",
      agentId: "nope/nope",
      position: { x: 200, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    badAgent.edges.push({ id: "e-agent", source: "start", target: "agent" });
    const bad = await json("/api/projects/refs-bot/workflow", { method: "PUT", body: JSON.stringify(badAgent) });
    expect(bad.status).toBe(422);
  });

  it("answers 422 when a workflow node omits notebookIds or the payload is malformed", async () => {
    const graph = (await (await json("/api/projects/ventas-bot/workflow")).json()) as WorkflowGraph;
    const missingNotebooks = structuredClone(graph);
    delete (missingNotebooks.nodes[0] as Partial<WorkflowGraph["nodes"][number]>).notebookIds;
    const rejected = await json("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      body: JSON.stringify(missingNotebooks),
    });
    expect(rejected.status).toBe(422);
    expect(((await rejected.json()) as { error: { code: string } }).error.code).toBe("INVALID_WORKFLOW");

    const malformed = await json("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      body: JSON.stringify({ ...graph, version: 2 }),
    });
    expect(malformed.status).toBe(422);
    expect(((await malformed.json()) as { error: { code: string } }).error.code).toBe("INVALID_WORKFLOW");

    const stillThere = await json("/api/projects/ventas-bot/workflow");
    expect(stillThere.status).toBe(200);
  });

  it("runs a workflow through the HTTP API", async () => {
    const response = await json("/api/projects/ventas-bot/runs", {
      method: "POST",
      body: JSON.stringify({ payload: { message: "hola" }, idempotencyKey: "http-1" }),
    });
    expect(response.status).toBe(202);
    const accepted = (await response.json()) as { id: string; status: string };
    expect(accepted.status).toBe("running");
    let run: { status: string; steps: Array<{ nodeId: string }> } | undefined;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const detail = await json(`/api/runs/${accepted.id}`);
      run = (await detail.json()) as { status: string; steps: Array<{ nodeId: string }> };
      if (run.status !== "running" && run.status !== "paused") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(run?.status).toBe("succeeded");
    expect(run?.steps.map((step) => step.nodeId)).toEqual(["start", "reply"]);
  });

  it("chats with the primary agent and reuses the session", async () => {
    const first = await json("/api/projects/ventas-bot/chat", { method: "POST", body: JSON.stringify({ message: "hola" }) });
    const second = await json("/api/projects/ventas-bot/chat", { method: "POST", body: JSON.stringify({ message: "otra" }) });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { sessionId: string; reply: string };
    const secondBody = (await second.json()) as { sessionId: string };
    expect(firstBody.sessionId).toBe(secondBody.sessionId);
    expect(firstBody.reply).toContain("[simulado");

    const history = await json("/api/projects/ventas-bot/chat");
    const messages = (await history.json()) as { data: Array<{ role: string; content: string }> };
    expect(messages.data).toHaveLength(4);
    expect(messages.data.map((message) => message.role)).toEqual(["user", "agent", "user", "agent"]);
    expect(messages.data[1]?.content).toContain("[simulado");
  });

  it("tests a speech connection through the integration route", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        if (url.pathname.endsWith("/models")) {
          return Response.json({ data: [{ id: "kokoro" }] });
        }
        return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), {
          headers: { "content-type": "audio/mpeg" },
        });
      },
    });
    try {
      const created = await json("/api/projects/ventas-bot/integrations", {
        method: "POST",
        body: JSON.stringify({
          kind: "speech",
          name: "Voz salud",
          slug: "voz-salud",
          config: {
            baseUrl: `http://127.0.0.1:${server.port}/v1`,
            model: "kokoro",
            voice: "ef_dora",
          },
        }),
      });
      expect(created.status).toBe(201);
      const body = (await created.json()) as { integration: { id: string } };
      const tested = await json(`/api/projects/ventas-bot/integrations/${body.integration.id}/test`, {
        method: "POST",
      });
      expect(tested.status).toBe(200);
      const result = (await tested.json()) as { ok: boolean; models?: string[] };
      expect(result.ok).toBe(true);
      expect(result.models).toEqual(["kokoro"]);
      await json(`/api/projects/ventas-bot/integrations/${body.integration.id}`, { method: "DELETE" });
    } finally {
      server.stop(true);
    }
  });

  it("shows transcription connections in the health snapshot", async () => {
    const created = await json("/api/projects/ventas-bot/integrations", {
      method: "POST",
      body: JSON.stringify({
        kind: "transcription",
        name: "ASR salud",
        slug: "asr-salud",
        config: { baseUrl: "http://transcription:8000/v1", model: "Systran/faster-whisper-small" },
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { integration: { id: string } };
    const health = (await (await json("/api/system/health")).json()) as {
      services: Array<{ name: string; detail?: string }>;
    };
    const transcription = health.services.find((service) => service.name.includes("Transcription ASR salud"));
    expect(transcription?.detail).toContain("Systran/faster-whisper-small");
    const speechCreated = await json("/api/projects/ventas-bot/integrations", {
      method: "POST",
      body: JSON.stringify({
        kind: "speech",
        name: "Voz salud",
        slug: "voz-salud",
        config: {
          baseUrl: "http://transcription:8000/v1",
          model: "speaches-ai/Kokoro-82M-v1.0-ONNX",
          voice: "ef_dora",
        },
      }),
    });
    expect(speechCreated.status).toBe(201);
    const speechBody = (await speechCreated.json()) as { integration: { id: string } };
    const speechHealth = (await (await json("/api/system/health")).json()) as {
      services: Array<{ name: string; detail?: string }>;
    };
    const speech = speechHealth.services.find((service) => service.name.includes("Speech Voz salud"));
    expect(speech?.detail).toContain("ef_dora");
    await json(`/api/projects/ventas-bot/integrations/${speechBody.integration.id}`, { method: "DELETE" });
    await json(`/api/projects/ventas-bot/integrations/${body.integration.id}`, { method: "DELETE" });
  });

  it("retries a project turn with its original attachments", async () => {
    const thread = application.store.chatThreads.findOrCreate({
      scope: "project",
      projectSlug: "ventas-bot",
      externalThreadId: "web",
    });
    const first = await application.chatTurns.start({
      thread,
      target: {
        scope: "project",
        projectSlug: "ventas-bot",
        directory: join(dir, "workspaces", "ventas-bot"),
        agentId: "principal/agente",
        context: "chat",
        entryPoint: "web_ui",
      },
      message: "mira",
      attachments: [{ kind: "image", path: ".opencode/media/abc.jpg", mime: "image/jpeg", filename: "foto.jpg" }],
    });
    await application.chatTurns.waitForTerminal(first.id, 2_000);
    const retried = await json(`/api/projects/ventas-bot/chat/turns/${first.id}/retry`, { method: "POST" });
    expect(retried.status).toBe(200);
    const payload = (await retried.json()) as { turn: { id: string } };
    await application.chatTurns.waitForTerminal(payload.turn.id, 2_000);
    const detail = (await (await json(`/api/projects/ventas-bot/chat/turns/${payload.turn.id}`)).json()) as {
      messages: Array<{ role: string; attachments?: Array<{ filename?: string }> }>;
    };
    const user = detail.messages.find((message) => message.role === "user");
    expect(user?.attachments?.[0]?.filename).toBe("foto.jpg");
  });

  it("creates sub-agents and lists them", async () => {
    const created = await json("/api/projects/ventas-bot/agents/ventas/calificador", {
      method: "PUT",
      body: JSON.stringify({
        description: "Califica leads",
        mode: "subagent",
        body: "Clasifica al lead.",
        model: "opencode-go/fast",
        notebooks: [],
      }),
    });
    expect(created.status).toBe(200);
    const list = await json("/api/projects/ventas-bot/agents");
    const body = (await list.json()) as { data: Array<{ category: string; role: string }> };
    expect(body.data.some((agent) => agent.category === "ventas" && agent.role === "calificador")).toBe(true);
  });

  it("creates notebooks, uploads text and searches with citations", async () => {
    const created = await json("/api/projects/ventas-bot/notebooks", {
      method: "POST",
      body: JSON.stringify({ slug: "manual-ventas", name: "Manual de ventas" }),
    });
    expect(created.status).toBe(201);
    const form = new FormData();
    form.set("file", new File(["# Descuentos\n\nEl descuento máximo es del 15%."], "descuentos.md", { type: "text/markdown" }));
    const upload = await app.request("/api/projects/ventas-bot/notebooks/manual-ventas/sources", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(upload.status).toBe(201);
    const search = await json("/api/projects/ventas-bot/notebooks/manual-ventas/search", {
      method: "POST",
      body: JSON.stringify({ query: "descuento" }),
    });
    const results = (await search.json()) as { data: Array<{ citation: string }> };
    expect(results.data[0]?.citation).toContain("descuentos.md");
  });

  it("reports health with OpenCode and database services", async () => {
    const response = await json("/api/system/health");
    const health = (await response.json()) as { status: string; services: Array<{ name: string; status: string }> };
    expect(health.services.some((service) => service.name === "OpenCode V2" && service.status === "ok")).toBe(true);
    expect(health.services.some((service) => service.name === "Database" && service.status === "ok")).toBe(true);
    expect(health.status).toBe("ok");
  });

  it("isolates project agents by project scope", async () => {
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "otro-bot", name: "Otro Bot" }),
    });

    const scopedList = await app.request("/api/projects", {
      headers: { "x-platform-token": serviceToken, "x-platform-project": "ventas-bot" },
    });
    const scopedBody = (await scopedList.json()) as { data: Array<{ slug: string }> };
    expect(scopedBody.data.map((project) => project.slug)).toEqual(["ventas-bot"]);

    const forbiddenRead = await app.request("/api/projects/otro-bot/workflow", {
      headers: { "x-platform-token": serviceToken, "x-platform-project": "ventas-bot" },
    });
    expect(forbiddenRead.status).toBe(403);

    const forbiddenCreate = await app.request("/api/projects", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-token": serviceToken,
        "x-platform-project": "ventas-bot",
      },
      body: JSON.stringify({ slug: "tercero", name: "Tercero" }),
    });
    expect(forbiddenCreate.status).toBe(403);

    const config = JSON.parse(
      await readFile(join(dir, "workspaces", "ventas-bot", "opencode.jsonc"), "utf8"),
    ) as { permissions: Array<{ action: string; effect: string }>; default_agent?: string };
    expect(config.default_agent).toBe("principal/agente");
    expect(config.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "external_directory", effect: "deny" })]),
    );
    const primary = await readFile(
      join(dir, "workspaces", "ventas-bot", ".opencode", "agents", "principal", "agente.md"),
      "utf8",
    );
    expect(primary).toContain("mode: primary");
    expect(primary).toContain("No menciones rutas");
  });

  it("keeps a separate chat session per project", async () => {
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "chat-bot", name: "Chat Bot" }),
    });
    const first = await json("/api/projects/ventas-bot/chat", {
      method: "POST",
      body: JSON.stringify({ message: "proyecto A" }),
    });
    const second = await json("/api/projects/chat-bot/chat", {
      method: "POST",
      body: JSON.stringify({ message: "proyecto B" }),
    });
    const firstBody = (await first.json()) as { sessionId: string };
    const secondBody = (await second.json()) as { sessionId: string };
    expect(firstBody.sessionId).not.toBe(secondBody.sessionId);
  });

  it("deletes a project and all of its owned data", async () => {
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "delete-bot", name: "Delete Bot", description: "Temporal" }),
    });
    const integration = await json("/api/projects/delete-bot/integrations", {
      method: "POST",
      body: JSON.stringify({
        kind: "external_chat",
        name: "Delete chat",
        slug: "delete-chat",
        config: { routing: { mode: "agent", allowlist: [], public: false } },
      }),
    });
    expect(integration.status).toBe(201);

    const forbidden = await app.request("/api/projects/delete-bot", {
      method: "DELETE",
      headers: { "x-platform-token": serviceToken, "x-platform-project": "delete-bot" },
    });
    expect(forbidden.status).toBe(403);

    const deleted = await app.request("/api/projects/delete-bot", { method: "DELETE", headers: { cookie } });
    expect(deleted.status).toBe(204);
    const list = await json("/api/projects");
    const body = (await list.json()) as { data: Array<{ slug: string }> };
    expect(body.data.some((project) => project.slug === "delete-bot")).toBe(false);
    await expect(access(join(dir, "workspaces", "delete-bot"))).rejects.toBeDefined();
    const workflow = await json("/api/projects/delete-bot/workflow");
    expect(workflow.status).toBe(404);
  });

  it("persists the global default model", async () => {
    const saved = await json("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ defaultModel: "opencode-go/fast" }),
    });
    expect(saved.status).toBe(200);
    const current = await json("/api/settings");
    const body = (await current.json()) as { data: { defaultModel?: string } };
    expect(body.data.defaultModel).toBe("opencode-go/fast");

    const invalid = await json("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ defaultModel: "not-a-model" }),
    });
    expect(invalid.status).toBe(422);

    await json("/api/settings", { method: "PUT", body: JSON.stringify({ defaultModel: "" }) });
    const cleared = await json("/api/settings");
    const clearedBody = (await cleared.json()) as { data: { defaultModel?: string } };
    expect(clearedBody.data.defaultModel).toBe("opencode/deepseek-v4.1-flash-free");
  });

  it("serves the model catalog from the runtime", async () => {
    const response = await json("/api/models");
    const body = (await response.json()) as { data: Array<{ providerID: string }> };
    expect(body.data.some((model) => model.providerID === "opencode-go")).toBe(true);
  });

  it("lists workflow version snapshots and rolls back to a prior version", async () => {
    const versionsRes = await json("/api/projects/ventas-bot/workflow/versions");
    expect(versionsRes.status).toBe(200);
    const versionsBody = (await versionsRes.json()) as { data: Array<{ version: number; graph: WorkflowGraph }> };
    expect(versionsBody.data.length).toBeGreaterThanOrEqual(2);
    const v1 = versionsBody.data.find((v) => v.version === 1);
    expect(v1?.graph.nodes).toHaveLength(1);

    const rollbackRes = await json("/api/projects/ventas-bot/workflow/versions/1/rollback", {
      method: "POST",
    });
    expect(rollbackRes.status).toBe(200);
    const rolled = (await rollbackRes.json()) as { graph: WorkflowGraph; version: { version: number } };
    expect(rolled.graph.nodes).toHaveLength(1);
    expect(rolled.version.version).toBeGreaterThan(2);

    const currentWorkflow = (await (await json("/api/projects/ventas-bot/workflow")).json()) as WorkflowGraph;
    expect(currentWorkflow.nodes).toHaveLength(1);
  });

  it("lists, approves and rejects pending approvals through the project API", async () => {
    const slug = "approval-bot";
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug, name: "Approval bot" }),
    });
    const workflow = {
      version: 1,
      id: slug,
      name: "Approval bot",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "review",
          type: "approval",
          position: { x: 100, y: 0 },
          config: { message: "Revisar" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "done",
          type: "transform",
          position: { x: 200, y: 0 },
          config: { template: '{"ok":true}' },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "review" },
        { id: "e2", source: "review", target: "done" },
      ],
      updatedAt: new Date().toISOString(),
    };
    expect((await json(`/api/projects/${slug}/workflow`, { method: "PUT", body: JSON.stringify(workflow) })).status).toBe(200);

    async function waitForApproval(runId: string) {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const response = await json(`/api/projects/${slug}/runs/${runId}/approvals`);
        const body = (await response.json()) as { data: Array<{ nodeId: string; status: string }> };
        if (body.data.length > 0) return body.data[0]!;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error("approval did not appear");
    }

    const launched = await json(`/api/projects/${slug}/runs`, {
      method: "POST",
      body: JSON.stringify({ payload: {} }),
    });
    const launchedRun = (await launched.json()) as { id: string };
    expect(await waitForApproval(launchedRun.id)).toMatchObject({ nodeId: "review", status: "pending" });
    const approved = await json(`/api/projects/${slug}/runs/${launchedRun.id}/approvals/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(approved.status).toBe(200);
    expect((await approved.json()) as { status: string }).toMatchObject({ status: "succeeded" });

    const rejectedRunResponse = await json(`/api/projects/${slug}/runs`, {
      method: "POST",
      body: JSON.stringify({ payload: {} }),
    });
    const rejectedRun = (await rejectedRunResponse.json()) as { id: string };
    await waitForApproval(rejectedRun.id);
    const rejected = await json(`/api/projects/${slug}/runs/${rejectedRun.id}/approvals/review`, {
      method: "POST",
      body: JSON.stringify({ decision: "reject" }),
    });
    expect(rejected.status).toBe(200);
    expect((await rejected.json()) as { status: string }).toMatchObject({ status: "failed" });

    const missing = await json(`/api/projects/${slug}/runs/ghost/approvals`);
    expect(missing.status).toBe(404);
    const anonymous = await app.request(`/api/projects/${slug}/runs/${launchedRun.id}/approvals/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approve" }),
    });
    expect(anonymous.status).toBe(401);
  });

  it("executes webhook and schedule triggers with secret/HMAC verification and per-window idempotency", async () => {
    await json("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug: "auto-bot", name: "Auto Bot" }),
    });
    await json("/api/projects/auto-bot/secrets", {
      method: "POST",
      body: JSON.stringify({ alias: "wh-key", value: "top-secret-wh", kind: "webhook" }),
    });
    const wf = (await (await json("/api/projects/auto-bot/workflow")).json()) as WorkflowGraph;
    wf.nodes[0] = {
      ...wf.nodes[0]!,
      config: { kind: "webhook", secretAlias: "wh-key" },
    };
    const savedWh = await json("/api/projects/auto-bot/workflow", {
      method: "PUT",
      body: JSON.stringify(wf),
    });
    expect(savedWh.status).toBe(200);

    const unauthorized = await app.request("/api/v1/webhooks/auto-bot/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-secret": "wrong" },
      body: JSON.stringify({ event: "order.created" }),
    });
    expect(unauthorized.status).toBe(401);

    const payloadText = JSON.stringify({ event: "order.created" });
    const sig = `sha256=${createHmac("sha256", "top-secret-wh").update(payloadText).digest("hex")}`;
    const authorized = await app.request("/api/v1/webhooks/auto-bot/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-webhook-signature": sig },
      body: payloadText,
    });
    expect(authorized.status).toBe(202);
    const whRun = (await authorized.json()) as { runId: string; entryPoint: string };
    expect(whRun.entryPoint).toBe("webhook");

    // Switch trigger to schedule and verify scheduler tick
    wf.nodes[0] = {
      ...wf.nodes[0]!,
      config: { kind: "schedule", cron: "* * * * *" },
    };
    const savedCron = await json("/api/projects/auto-bot/workflow", {
      method: "PUT",
      body: JSON.stringify(wf),
    });
    expect(savedCron.status).toBe(200);

    const tickTime = new Date("2026-11-02T10:00:00.000Z");
    const firstTick = await application.scheduler.tick(tickTime);
    expect(firstTick.some((run) => run.projectSlug === "auto-bot" && run.entryPoint === "schedule")).toBe(true);
    const scheduleResponse = await json("/api/projects/auto-bot/workflow/schedule");
    expect(scheduleResponse.status).toBe(200);
    const scheduleBody = (await scheduleResponse.json()) as {
      data: Array<{ nextWindowAt?: string; timezone: string; enabled: boolean }>;
    };
    expect(scheduleBody.data[0]?.nextWindowAt).toBeTruthy();
    expect(scheduleBody.data[0]?.timezone).toBe("UTC");
    expect(scheduleBody.data[0]?.enabled).toBe(true);
    // Second tick in the same minute window is deduplicated via idempotencyKey
    const secondTick = await application.scheduler.tick(tickTime);
    const firstRunId = firstTick.find((r) => r.projectSlug === "auto-bot")?.id;
    const secondRunId = secondTick.find((r) => r.projectSlug === "auto-bot")?.id;
    if (secondRunId && firstRunId) expect(secondRunId).toBe(firstRunId);
  });

  it("enforces per-agent tool permissions and blocks design mutations in workflow/external_channel context", async () => {
    await json("/api/projects/ventas-bot/agents/ventas/restringido", {
      method: "PUT",
      body: JSON.stringify({
        description: "Agente con permisos restringidos",
        mode: "subagent",
        body: "Solo lectura.",
        permissions: [
          { action: "tool", resource: "db_query", effect: "deny" },
          { action: "tool", resource: "notify", effect: "deny" },
        ],
        notebooks: [],
      }),
    });

    const wf = (await (await json("/api/projects/ventas-bot/workflow")).json()) as WorkflowGraph;

    // Workflow step context cannot mutate workflow definition by default
    const blockedUpsert = await app.request("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-platform-token": serviceToken,
        "x-platform-project": "ventas-bot",
        "x-platform-agent": "ventas/calificador",
        "x-platform-context": "workflow",
      },
      body: JSON.stringify(wf),
    });
    expect(blockedUpsert.status).toBe(403);

    const sessionNow = new Date().toISOString();
    application.store.sessionContexts.upsert({
      sessionId: "workflow-session-1",
      scope: "project",
      projectSlug: "ventas-bot",
      agentId: "ventas/calificador",
      context: "workflow",
      createdAt: sessionNow,
      updatedAt: sessionNow,
    });
    const sessionBlocked = await app.request("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-platform-token": serviceToken,
        "x-platform-project": "ventas-bot",
        "x-platform-session": "workflow-session-1",
      },
      body: JSON.stringify(wf),
    });
    expect(sessionBlocked.status).toBe(403);

    // Deny rule on notify is enforced even in chat context
    const blockedNotify = await app.request("/api/projects/ventas-bot/integrations/any-id/notify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-token": serviceToken,
        "x-platform-project": "ventas-bot",
        "x-platform-agent": "ventas/restringido",
        "x-platform-context": "chat",
      },
      body: JSON.stringify({ text: "hola" }),
    });
    expect(blockedNotify.status).toBe(403);

    // Primary agent in chat context without deny rules can still update workflow
    const allowedPrimary = await app.request("/api/projects/ventas-bot/workflow", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-platform-token": serviceToken,
        "x-platform-project": "ventas-bot",
        "x-platform-agent": "principal/agente",
        "x-platform-context": "chat",
      },
      body: JSON.stringify(wf),
    });
    expect(allowedPrimary.status).toBe(200);
  });

  it("streams control-chat progress and a non-empty reply", async () => {
    const fake = application.agent as typeof application.agent & {
      scriptedReplies: string[];
      scriptedEvents: Array<{ type: string; data?: Record<string, unknown> }>;
    };
    fake.scriptedReplies.push("respuesta de prueba");
    fake.scriptedEvents.push(
      { type: "session.tool.called", data: { id: "t1", name: "platform_workflow_get", input: {} } },
      { type: "session.tool.success", data: { id: "t1" } },
    );
    const response = await app.request("/api/control/chat", {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "hola" }),
    });
    const body = await response.text();
    expect(body).toContain("event: delta");
    expect(body).toContain("event: activity");
    expect(body).toContain("Revisando el flujo");
    expect(body).toContain("event: done");
    expect(body).toContain("respuesta de prueba");
    expect(body).not.toContain('"reply":""');
  });

  it("exposes a durable turn for status and reattachment", async () => {
    const fake = application.agent as typeof application.agent & { scriptedReplies: string[] };
    fake.scriptedReplies.push("respuesta durable");
    const stream = await app.request("/api/control/chat", {
      method: "POST",
      headers: { accept: "text/event-stream", cookie, "content-type": "application/json" },
      body: JSON.stringify({ message: "turno durable" }),
    });
    const body = await stream.text();
    const first = body.split("\n\n")[0] ?? "";
    const payload = JSON.parse(first.replace(/^event: turn\ndata: /, "")) as { turn: { id: string } };
    const turnId = payload.turn.id;

    const status = await app.request(`/api/control/chat/turns/${turnId}`, { headers: { cookie } });
    expect(status.status).toBe(200);
    const statusBody = (await status.json()) as { turn: { status: string; assistantMessageId?: string } };
    expect(statusBody.turn.status).toBe("succeeded");
    expect(statusBody.turn.assistantMessageId).toBeTruthy();

    const attach = await app.request(`/api/control/chat/turns/${turnId}/events`, {
      headers: { accept: "text/event-stream", cookie },
    });
    expect(await attach.text()).toContain("respuesta durable");

    const forbidden = await app.request(`/api/projects/ventas-bot/chat/turns/${turnId}`, { headers: { cookie } });
    expect(forbidden.status).toBe(403);
  });

  it("returns 502 and a visible error for an empty control-chat reply", async () => {
    const fake = application.agent as typeof application.agent & { scriptedReplies: string[] };
    fake.scriptedReplies.push("");
    const response = await json("/api/control/chat", {
      method: "POST",
      body: JSON.stringify({ message: "consulta vacía" }),
    });
    expect(response.status).toBe(502);
    const payload = (await response.json()) as { error?: { message?: string } };
    expect(payload.error?.message).toMatch(/textual|empty/i);

    fake.scriptedReplies.push("");
    const stream = await app.request("/api/control/chat", {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ message: "consulta vacía SSE" }),
    });
    const body = await stream.text();
    expect(body).toContain("event: error");
    expect(body).not.toContain('"reply":""');

    const historyResponse = await json("/api/control/chat?limit=20");
    const history = (await historyResponse.json()) as {
      data: Array<{ role: string; content: string }>;
    };
    expect(history.data.some((message) => message.role === "system" && /textual|empty/i.test(message.content))).toBe(
      true,
    );
    expect(history.data.some((message) => message.role === "agent" && message.content.trim() === "")).toBe(false);
  });

  it("shows integration lastError in health", async () => {
    const now = new Date().toISOString();
    application.store.integrations.create({
      id: "health-error",
      scope: "project",
      projectSlug: "ventas-bot",
      kind: "telegram",
      name: "Health Error",
      slug: "health-error",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "error",
      lastError: "invalid token",
      createdAt: now,
      updatedAt: now,
    });
    const response = await json("/api/system/health");
    const body = (await response.json()) as { services: Array<{ name: string; detail?: string }> };
    expect(body.services.find((service) => service.name === "Integration Health Error")?.detail).toContain(
      "invalid token",
    );
    application.store.integrations.remove("health-error");
  });
});

describe("knowledge delete routes", () => {
  async function createProject(slug: string) {
    await json("/api/projects", { method: "POST", body: JSON.stringify({ slug, name: slug }) });
  }

  async function createNotebook(projectSlug: string, notebookSlug: string) {
    const response = await json(`/api/projects/${projectSlug}/notebooks`, {
      method: "POST",
      body: JSON.stringify({ slug: notebookSlug, name: notebookSlug }),
    });
    expect(response.status).toBe(201);
  }

  async function uploadSource(projectSlug: string, notebookSlug: string, filename: string, content: string) {
    const form = new FormData();
    form.set("file", new File([content], filename, { type: "text/markdown" }));
    const response = await app.request(`/api/projects/${projectSlug}/notebooks/${notebookSlug}/sources`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(response.status).toBe(201);
    return (await response.json()) as { source: { id: string; title: string }; chunks: number };
  }

  async function listSources(projectSlug: string, notebookSlug: string) {
    const response = await json(`/api/projects/${projectSlug}/notebooks/${notebookSlug}/sources`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: Array<{ id: string; title: string }> }).data;
  }

  async function listNotebooks(projectSlug: string) {
    const response = await json(`/api/projects/${projectSlug}/notebooks`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { data: Array<{ slug: string; sources: number }> }).data;
  }

  async function exists(path: string) {
    return access(path).then(
      () => true,
      () => false,
    );
  }

  const sourceFile = (projectSlug: string, notebookSlug: string, sourceId: string) =>
    join(dir, "workspaces", projectSlug, "knowledge", notebookSlug, "sources", `${sourceId}.md`);

  it("deletes a source and its file while keeping siblings intact", async () => {
    await createProject("lab-delete");
    await createNotebook("lab-delete", "politicas");
    const first = await uploadSource(
      "lab-delete",
      "politicas",
      "devoluciones.md",
      "# Devoluciones\n\nLas devoluciones tardan 5 días.",
    );
    const second = await uploadSource("lab-delete", "politicas", "envios.md", "# Envíos\n\nLos envíos salen cada martes.");

    const response = await json(`/api/projects/lab-delete/notebooks/politicas/sources/${first.source.id}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true);

    const remaining = await listSources("lab-delete", "politicas");
    expect(remaining.map((source) => source.title)).toEqual(["envios.md"]);
    expect(await exists(sourceFile("lab-delete", "politicas", first.source.id))).toBe(false);
    expect(await exists(sourceFile("lab-delete", "politicas", second.source.id))).toBe(true);

    const deleted = await json("/api/projects/lab-delete/notebooks/politicas/search", {
      method: "POST",
      body: JSON.stringify({ query: "devoluciones" }),
    });
    const deletedHits = ((await deleted.json()) as { data: Array<{ citation: string }> }).data;
    expect(deletedHits.every((hit) => !hit.citation.includes("devoluciones.md"))).toBe(true);

    const kept = await json("/api/projects/lab-delete/notebooks/politicas/search", {
      method: "POST",
      body: JSON.stringify({ query: "envíos" }),
    });
    const keptHits = ((await kept.json()) as { data: Array<{ citation: string }> }).data;
    expect(keptHits.some((hit) => hit.citation.includes("envios.md"))).toBe(true);
  });

  it("deletes a notebook with its directory and rows, keeping sibling notebooks", async () => {
    await createNotebook("lab-delete", "manual");
    await uploadSource("lab-delete", "manual", "manual.md", "# Manual\n\nEl horario es de 9 a 18.");
    await createNotebook("lab-delete", "otros");
    await uploadSource("lab-delete", "otros", "otros.md", "# Otros\n\nOtras notas.");

    const response = await json("/api/projects/lab-delete/notebooks/manual", { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(true);

    const notebooks = await listNotebooks("lab-delete");
    expect(notebooks.map((notebook) => notebook.slug)).not.toContain("manual");
    expect(await exists(join(dir, "workspaces", "lab-delete", "knowledge", "manual"))).toBe(false);
    expect(await exists(join(dir, "workspaces", "lab-delete", "knowledge", "otros", "sources"))).toBe(true);

    const sources = await listSources("lab-delete", "otros");
    expect(sources.map((source) => source.title)).toEqual(["otros.md"]);
  });

  it("returns 404 without side effects when the target belongs to another project", async () => {
    await createProject("lab-vecino");
    await createNotebook("lab-vecino", "politicas");
    await createNotebook("lab-delete", "privado");
    const privado = await uploadSource("lab-delete", "privado", "privado.md", "# Privado\n\nDatos privados.");
    const own = await uploadSource(
      "lab-delete",
      "politicas",
      "garantias.md",
      "# Garantías\n\nLa garantía dura 12 meses.",
    );

    const sourceResponse = await json(`/api/projects/lab-vecino/notebooks/politicas/sources/${own.source.id}`, {
      method: "DELETE",
    });
    expect(sourceResponse.status).toBe(404);
    const sources = await listSources("lab-delete", "politicas");
    expect(sources.some((source) => source.id === own.source.id)).toBe(true);
    expect(await exists(sourceFile("lab-delete", "politicas", own.source.id))).toBe(true);

    const notebookResponse = await json("/api/projects/lab-vecino/notebooks/privado", { method: "DELETE" });
    expect(notebookResponse.status).toBe(404);
    const notebooks = await listNotebooks("lab-delete");
    expect(notebooks.map((notebook) => notebook.slug)).toContain("privado");
    expect(await exists(sourceFile("lab-delete", "privado", privado.source.id))).toBe(true);
  });

  it("returns 404 for missing notebooks, sources and projects", async () => {
    const notebook = await json("/api/projects/lab-delete/notebooks/no-existe", { method: "DELETE" });
    expect(notebook.status).toBe(404);

    const source = await json(`/api/projects/lab-delete/notebooks/politicas/sources/${crypto.randomUUID()}`, {
      method: "DELETE",
    });
    expect(source.status).toBe(404);

    const phantomProject = await json("/api/projects/proyecto-fantasma/notebooks/politicas", { method: "DELETE" });
    expect(phantomProject.status).toBe(404);
  });

  it("rejects unsafe paths with 400 UNSAFE_PATH and no filesystem changes", async () => {
    const source = await json("/api/projects/lab-delete/notebooks/politicas/sources/..%2F..%2Fopencode", {
      method: "DELETE",
    });
    expect(source.status).toBe(400);
    expect(((await source.json()) as { error?: { code?: string } }).error?.code).toBe("UNSAFE_PATH");

    const notebook = await json("/api/projects/lab-delete/notebooks/..%2F..%2Flab-delete", { method: "DELETE" });
    expect(notebook.status).toBe(400);
    expect(((await notebook.json()) as { error?: { code?: string } }).error?.code).toBe("UNSAFE_PATH");

    expect(await exists(join(dir, "workspaces", "lab-delete", "opencode.jsonc"))).toBe(true);
    const notebooks = await listNotebooks("lab-delete");
    expect(notebooks.map((notebook) => notebook.slug)).toContain("politicas");
    expect(notebooks.find((notebook) => notebook.slug === "politicas")?.sources).toBeGreaterThan(0);
  });
});
