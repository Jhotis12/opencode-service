import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { IntegrationEgressRouter } from "../src/infrastructure/in/channels/egress-router.ts";
import { IntegrationManager } from "../src/infrastructure/in/channels/channel-manager.ts";
import type { TelegramTransport } from "../src/infrastructure/in/channels/telegram-adapter.ts";
import { ManageIntegrationsUseCase } from "../src/application/use-cases/manage-integrations.ts";
import type { IntegrationManagerPort } from "../src/application/ports/integrations.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

class FakeTelegram implements TelegramTransport {
  readonly type = "telegram" as const;
  verifyError?: Error;
  startError?: Error;
  botId = "bot-1";
  username = "test_bot";
  running = false;
  sent: Array<{ to: string; text: string }> = [];
  webhookCleared = false;
  async verify() {
    if (this.verifyError) throw this.verifyError;
    return { botId: this.botId, username: this.username };
  }
  async clearWebhook() {
    this.webhookCleared = true;
  }
  async start() {
    if (this.startError) throw this.startError;
    this.running = true;
  }
  async send(to: string, text: string) {
    this.sent.push({ to, text });
    return { providerMessageId: `fake-${this.sent.length}` };
  }
  async stop() {
    this.running = false;
  }
  status() {
    return this.running ? "connected" : "disconnected";
  }
}

function createIntegration(
  store: SqliteStore,
  vault: Aes256GcmVaultAdapter,
  id: string,
  token: string,
): IntegrationRecord {
  const now = new Date().toISOString();
  const alias = `integration:${id}:token`;
  store.vault.upsert({
    id: crypto.randomUUID(),
    scope: "project",
    projectSlug: "ventas",
    alias,
    kind: "integration:telegram",
    ciphertext: vault.encrypt(token),
    createdAt: now,
  });
  const integration: IntegrationRecord = {
    id,
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: `Bot ${id}`,
    slug: `bot-${id}`,
    config: { routing: { mode: "hybrid", allowlist: [], public: false } },
    secretRefs: { token: alias },
    capabilities: ["inbound_message", "outbound_message"],
    status: "disconnected",
    createdAt: now,
    updatedAt: now,
  };
  store.integrations.create(integration);
  return integration;
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-telegram-"));
  dirs.push(dir);
  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  store.projects.create({ id: "p1", slug: "ventas", name: "Ventas", description: "", createdAt: now, updatedAt: now });
  const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 4));
  return { dir, store, vault };
}

function managerFor(store: SqliteStore, vault: Aes256GcmVaultAdapter, fake: FakeTelegram): IntegrationManager {
  return new IntegrationManager({
    store,
    vault,
    egress: new IntegrationEgressRouter(),
    events: { publish() {} },
    logger: silentLogger,
    projectRouter: {} as never,
    globalRouter: {} as never,
    dataDir: "/tmp",
    createTelegramTransport: () => fake,
  });
}

describe("telegram integration lifecycle", () => {
  it("does not mark an integration connected when verification fails", async () => {
    const { store, vault } = await setup();
    const integration = createIntegration(store, vault, "i1", "bad-token");
    const fake = new FakeTelegram();
    fake.verifyError = new Error("Unauthorized");
    const manager = managerFor(store, vault, fake);
    await manager.start(integration);
    const current = store.integrations.findById("i1")!;
    expect(current.status).toBe("error");
    expect(current.lastError).toContain("Unauthorized");
    store.close();
  });

  it("stores the bot identity after a real verification", async () => {
    const { store, vault } = await setup();
    const integration = createIntegration(store, vault, "i1", "token-1");
    const fake = new FakeTelegram();
    const manager = managerFor(store, vault, fake);
    await manager.start(integration);
    const current = store.integrations.findById("i1")!;
    expect(current.status).toBe("connected");
    expect(current.config.botId).toBe("bot-1");
    expect(current.config.botUsername).toBe("test_bot");
    store.close();
  });

  it("rejects a second integration that reuses the same bot token", async () => {
    const { store, vault } = await setup();
    const first = createIntegration(store, vault, "i1", "same-token");
    const second = createIntegration(store, vault, "i2", "same-token");
    const fake = new FakeTelegram();
    const manager = managerFor(store, vault, fake);
    await manager.start(first);
    await manager.start(second);
    expect(store.integrations.findById("i1")!.status).toBe("connected");
    const failed = store.integrations.findById("i2")!;
    expect(failed.status).toBe("error");
    expect(failed.lastError).toContain("bot-i1");
    store.close();
  });

  it("detects a webhook conflict and exposes an explicit clear action", async () => {
    const { store, vault } = await setup();
    const integration = createIntegration(store, vault, "i1", "token-1");
    const fake = new FakeTelegram();
    fake.startError = new Error("Conflict: can't use getUpdates method while webhook is active");
    const manager = managerFor(store, vault, fake);
    await manager.start(integration);
    expect(store.integrations.findById("i1")!.status).toBe("error");
    await manager.clearTelegramWebhook(store.integrations.findById("i1")!);
    expect(fake.webhookCleared).toBe(true);
    expect(store.integrations.findById("i1")!.status).toBe("disconnected");
    store.close();
  });

  it("sends a real test message when a recipient is provided", async () => {
    const { store, vault } = await setup();
    const integration = createIntegration(store, vault, "i1", "token-1");
    const fake = new FakeTelegram();
    const manager = managerFor(store, vault, fake);
    const result = await manager.test(integration, { recipient: "123456" });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("test_bot");
    expect(fake.sent[0]?.to).toBe("123456");
    store.close();
  });
});

describe("telegram token rotation", () => {
  it("preserves the integration id and secret alias while rejecting duplicates", async () => {
    const { store, vault } = await setup();
    const manager: IntegrationManagerPort = {
      async start() {},
      async stop() {},
      async stopAll() {},
      async test() {
        return { ok: true };
      },
      async clearTelegramWebhook() {},
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
    const useCase = new ManageIntegrationsUseCase({
      store,
      vault,
      events: { publish() {} },
      manager,
      databaseAdapter: {} as never,
      transcription: {
        async transcribe() {
          return { text: "" };
        },
        async listModels() {
          return [];
        },
        async test() {
          return { ok: true };
        },
      },
    });
    const created = await useCase.create({
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Bot",
      slug: "bot",
      config: { routing: { mode: "hybrid", allowlist: [], public: false } },
      secrets: { token: "token-a" },
    });
    const alias = created.integration.secretRefs.token;
    const updated = await useCase.update(
      created.integration.id,
      { scope: "project", projectSlug: "ventas" },
      { secrets: { token: "token-b" } },
    );
    expect(updated.id).toBe(created.integration.id);
    expect(updated.secretRefs.token).toBe(alias);
    const secret = store.vault.findByAlias({ scope: "project", projectSlug: "ventas", alias: alias! });
    expect(vault.decrypt(secret!.ciphertext)).toBe("token-b");
    await expect(
      useCase.create({
        scope: "project",
        projectSlug: "ventas",
        kind: "telegram",
        name: "Otro",
        slug: "otro",
        config: {},
        secrets: { token: "token-b" },
      }),
    ).rejects.toThrow(/already used/);
    store.close();
  });
});
