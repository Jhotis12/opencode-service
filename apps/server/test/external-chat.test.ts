import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import {
  CreateChannelUseCase,
  SendExternalChatMessageUseCase,
  signWebhook,
  verifyChannelKey,
} from "../src/application/use-cases/external-chat.ts";
import { createExternalChatRoutes } from "../src/infrastructure/in/http/external-chat-routes.ts";

const cleanups: string[] = [];
async function cleanup() {
  await Promise.all(cleanups.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-chat-"));
  cleanups.push(dir);
  const store = new SqliteStore(":memory:");
  const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 3));
  const agent = new FakeAgentRuntime();
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const created = new CreateChannelUseCase(store, vault).execute({
    slug: "mi-app",
    type: "external_chat",
    name: "Chat de mi app",
    config: { projectSlug: "ventas", model: "opencode-go/fast" },
  });
  const sentWebhooks: Array<{ url: string; body: string; signature: string }> = [];
  const send = new SendExternalChatMessageUseCase({
    store,
    vault,
    agent,
    workspace,
    executor: { execute: async () => ({ id: "r1", status: "succeeded", output: "workflow-reply" }) } as never,
    defaultDirectory: dir,
    fetchImpl: (async (url: string, init: RequestInit) => {
      sentWebhooks.push({
        url: String(url),
        body: String(init.body),
        signature: String((init.headers as Record<string, string>)["x-platform-signature"]),
      });
      return new Response("{}", { status: 200 });
    }) as typeof fetch,
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
      executor: { execute: async () => ({ id: "r1", status: "succeeded", output: "workflow-reply" }) } as never,
      egress: { send: async () => undefined },
      events: { publish() {} },
      defaultDirectory: dir,
      fetchImpl: (async (url: string, init: RequestInit) => {
        sentWebhooks.push({
          url: String(url),
          body: String(init.body),
          signature: String((init.headers as Record<string, string>)["x-platform-signature"]),
        });
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
      webhookValidator: async () => undefined,
    }),
  );
  return { dir, store, vault, agent, workspace, created, send, app, sentWebhooks };
}

describe("external chat channel", () => {
  it("creates a channel with a one-time key and encrypted config", async () => {
    const { created, store, vault } = await setup();
    expect(created.apiKey!.startsWith("sk_chat_")).toBe(true);
    expect(created.webhookSecret).toHaveLength(48);
    const channel = store.channels.findBySlug("mi-app")!;
    expect(channel.keyHash).not.toContain(created.apiKey!);
    expect(verifyChannelKey(created.apiKey!, channel.keyHash)).toBe(true);
    expect(verifyChannelKey("wrong", channel.keyHash)).toBe(false);
    expect(vault.decrypt(channel.configCiphertext!)).not.toContain(created.apiKey!);
    expect(vault.decrypt(channel.configCiphertext!)).toContain("webhookSecret");
    await cleanup();
  });

  it("keeps one agent session per external thread across turns", async () => {
    const { created, send, agent } = await setup();
    const first = await send.execute({ channelSlug: "mi-app", apiKey: created.apiKey!, threadId: "cliente-1", message: "hola" });
    const second = await send.execute({ channelSlug: "mi-app", apiKey: created.apiKey!, threadId: "cliente-1", message: "otra vez" });
    expect(first.sessionId).toBe(second.sessionId);
    expect(agent.sessionCount).toBe(1);
    expect(second.reply).toContain("[simulado");
    const other = await send.execute({ channelSlug: "mi-app", apiKey: created.apiKey!, threadId: "cliente-2", message: "hola" });
    expect(other.sessionId).not.toBe(first.sessionId);
    expect(agent.sessionCount).toBe(2);
    await cleanup();
  });

  it("rejects invalid channel keys", async () => {
    const { send, created } = await setup();
    await expect(
      send.execute({ channelSlug: "mi-app", apiKey: "nope", threadId: "t", message: "hola" }),
    ).rejects.toThrow(/invalid channel key/);
    expect(created.apiKey).toBeDefined();
    await cleanup();
  });

  it("signs webhook payloads with HMAC-SHA256", async () => {
    const { send, created, sentWebhooks } = await setup();
    await send.execute({
      channelSlug: "mi-app",
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
    const json = await app.request("/api/v1/channels/mi-app/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-channel-key": created.apiKey! },
      body: JSON.stringify({ threadId: "cliente-http", message: "hola" }),
    });
    expect(json.status).toBe(200);
    const payload = (await json.json()) as { reply: string; sessionId: string };
    expect(payload.reply).toContain("[simulado");

    const sse = await app.request("/api/v1/channels/mi-app/messages", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream", "x-channel-key": created.apiKey! },
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
    const { app } = await setup();
    const unauthorized = await app.request("/api/v1/channels/mi-app/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-channel-key": "bad" },
      body: JSON.stringify({ threadId: "t", message: "hola" }),
    });
    expect(unauthorized.status).toBe(401);
    const invalid = await app.request("/api/v1/channels/mi-app/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId: "" }),
    });
    expect(invalid.status).toBe(422);
    await cleanup();
  });
});
