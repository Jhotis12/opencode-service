import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApplication, type Application } from "../src/app.ts";
import { createLogger } from "../src/infrastructure/out/telemetry/logger.ts";
import type { WorkflowGraph } from "@platform/shared";

let dir: string;
let application: Application;
let app: Application["app"];
let cookie = "";
const serviceToken = "service-token-test";

async function json(path: string, init: RequestInit = {}, useCookie = true) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (useCookie && cookie) headers.cookie = cookie;
  return app.request(path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "platform-http-"));
  application = await createApplication({
    dataDir: dir,
    env: { ...process.env, OPENCODE_MODE: "fake" },
    serviceToken,
    logger: createLogger({ level: "silent", destination: { write() {} } }),
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
    const service = await app.request("/api/projects", { headers: { "x-platform-token": serviceToken } });
    expect(service.status).toBe(200);
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

  it("runs a workflow through the HTTP API", async () => {
    const response = await json("/api/projects/ventas-bot/runs", {
      method: "POST",
      body: JSON.stringify({ payload: { message: "hola" }, idempotencyKey: "http-1" }),
    });
    expect(response.status).toBe(202);
    const run = (await response.json()) as { status: string; steps: Array<{ nodeId: string }> };
    expect(run.status).toBe("succeeded");
    expect(run.steps.map((step) => step.nodeId)).toEqual(["start", "reply"]);
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
    expect(body.data[0]).toMatchObject({ category: "ventas", role: "calificador" });
  });

  it("creates notebooks, uploads text and searches with citations", async () => {
    const created = await json("/api/notebooks", {
      method: "POST",
      body: JSON.stringify({ slug: "manual-ventas", name: "Manual de ventas" }),
    });
    expect(created.status).toBe(201);
    const form = new FormData();
    form.set("file", new File(["# Descuentos\n\nEl descuento máximo es del 15%."], "descuentos.md", { type: "text/markdown" }));
    const upload = await app.request("/api/notebooks/manual-ventas/sources", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(upload.status).toBe(201);
    const search = await json("/api/notebooks/manual-ventas/search", {
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
    ) as { permissions: Array<{ action: string; effect: string }> };
    expect(config.permissions).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "external_directory", effect: "deny" })]),
    );
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
  });

  it("serves the model catalog from the runtime", async () => {
    const response = await json("/api/models");
    const body = (await response.json()) as { data: Array<{ providerID: string }> };
    expect(body.data.some((model) => model.providerID === "opencode-go")).toBe(true);
  });
});
