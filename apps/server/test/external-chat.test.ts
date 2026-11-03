import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { SendExternalChatMessageUseCase, signWebhook } from "../src/application/use-cases/external-chat.ts";
import { ManageIntegrationsUseCase, verifyIntegrationKey } from "../src/application/use-cases/manage-integrations.ts";
import { createExternalChatRoutes } from "../src/infrastructure/in/http/external-chat-routes.ts";
import type { IntegrationManagerPort } from "../src/application/ports/integrations.ts";

const cleanups: string[] = [];
async function cleanup() {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

const fakeManager: IntegrationManagerPort = {
  async start() {},
  async stop() {},
  async stopAll() {},
  async test() {
    return { ok: true };
  },
  status() {
    return "connected";
  },
  qr() {
    return undefined;
  },
  async send() {
    return {};
  },
};

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-chat-"));
  cleanups.push(dir);
  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  store.projects.create({
    id: "p1",
    slug: "ventas",
    name: "Ventas",
    description: "",
    primaryAgent: "principal/agente",
    createdAt: now,
    updatedAt: now,
  });
  const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 3));
  const agent = new FakeAgentRuntime();
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const created = await new ManageIntegrationsUseCase({
    store,
    vault,
    events: { publish() {} },
    manager: fakeManager,
    databaseAdapter: {} as never,
  }).create({
    scope: "project",
    projectSlug: "ventas",
    kind: "external_chat",
    name: "Chat de mi app",
    slug: "mi-app",
    config: { routing: { mode: "agent", allowlist: [], public: false } },
  });
  const sentWebhooks: Array<{ url: string; body: string; signature: string }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sentWebhooks.push({
      url: String(url),
      body: String(init.body),
      signature: String((init.headers as Record<string, string>)["x-platform-signature"]),
    });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const executor = { execute: async () => ({ id: "r1", status: "succeeded", output: "workflow-reply" }) };
  const send = new SendExternalChatMessageUseCase({
    store,
    vault,
    agent,
    workspace,
    executor: executor as never,
    controlDirectory: dir,
    fetchImpl,
    webhookValidator: async () => undefined,
  });
  const app = new Hono();
  app.route(
    "/api",
    createExternalChatRoutes({
      store,
      vault,
      agent,
      workspace,
      executor: executor as never,
      controlDirectory: dir,
      fetchImpl,
      webhookValidator: async () => undefined,
    }),
  );
  return { dir, store, vault, agent, workspace, created, send, app, sentWebhooks };
}

describe("external chat integration", () => {
  it("creates an integration with a one-time key and encrypted secrets", async () => {
    const { created, store } = await setup();
    expect(created.apiKey!.startsWith("sk_chat_")).toBe(true);
    expect(created.webhookSecret).toHaveLength(48);
    const integration = store.integrations.findById(created.integration.id)!;
    expect(integration.keyHash).not.toContain(created.apiKey!);
    expect(verifyIntegrationKey(created.apiKey!, integration.keyHash)).toBe(true);
    expect(verifyIntegrationKey("wrong", integration.keyHash)).toBe(false);
    expect(store.vault.findByAlias({
      scope: "project",
      projectSlug: "ventas",
      alias: integration.secretRefs.webhookSecret,
    })).toBeDefined();
    await cleanup();
  });

  it("keeps one agent session per external thread across turns", async () => {
    const { created, send, agent } = await setup();
    const first = await send.execute({
      integrationId: created.integration.id,
      apiKey: created.apiKey!,
      threadId: "cliente-1",
      message: "hola",
    });
    const second = await send.execute({
      integrationId: created.integration.id,
      apiKey: created.apiKey!,
      threadId: "cliente-1",
      message: "otra vez",
    });
    expect(first.sessionId).toBe(second.sessionId);
    expect(agent.sessionCount).toBe(1);
    expect(second.reply).toContain("[simulado");
    const other = await send.execute({
      integrationId: created.integration.id,
      apiKey: created.apiKey!,
      threadId: "cliente-2",
      message: "hola",
    });
    expect(other.sessionId).not.toBe(first.sessionId);
    expect(agent.sessionCount).toBe(2);
    await cleanup();
  });

  it("rejects invalid integration keys", async () => {
    const { send, created } = await setup();
    await expect(
      send.execute({ integrationId: created.integration.id, apiKey: "nope", threadId: "t", message: "hola" }),
    ).rejects.toThrow(/invalid integration key/);
    await cleanup();
  });

  it("signs webhook payloads with HMAC-SHA256", async () => {
    const { send, created, sentWebhooks } = await setup();
    await send.execute({
      integrationId: created.integration.id,
      apiKey: created.apiKey!,
      threadId: "cliente-1",
      message: "hola",
      webhookUrl: "https://example.com/hook",
    });
    expect(sentWebhooks).toHaveLength(1);
    const body = sentWebhooks[0]!.body;
    expect(sentWebhooks[0]!.signature).toBe(`sha256=${signWebhook(created.webhookSecret!, body)}`);
    expect(sentWebhooks[0]!.url).toBe("https://example.com/hook");
    await cleanup();
  });

  it("serves JSON and SSE responses over HTTP", async () => {
    const { app, created } = await setup();
    const path = `/api/v1/integrations/${created.integration.id}/messages`;
    const json = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-key": created.apiKey! },
      body: JSON.stringify({ threadId: "cliente-http", message: "hola" }),
    });
    expect(json.status).toBe(200);
    const payload = (await json.json()) as { reply: string; sessionId: string };
    expect(payload.reply).toContain("[simulado");

    const sse = await app.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        "x-integration-key": created.apiKey!,
      },
      body: JSON.stringify({ threadId: "cliente-http", message: "stream" }),
    });
    expect(sse.status).toBe(200);
    expect(sse.headers.get("content-type")).toContain("text/event-stream");
    const text = await sse.text();
    expect(text).toContain("event: token");
    expect(text).toContain("[simulado");
    expect(text).toContain("event: done");
    await cleanup();
  });

  it("rejects invalid keys and malformed bodies over HTTP", async () => {
    const { app, created } = await setup();
    const path = `/api/v1/integrations/${created.integration.id}/messages`;
    const unauthorized = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-integration-key": "bad" },
      body: JSON.stringify({ threadId: "t", message: "hola" }),
    });
    expect(unauthorized.status).toBe(401);
    const invalid = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: "" }),
    });
    expect(invalid.status).toBe(422);
    await cleanup();
  });
});
