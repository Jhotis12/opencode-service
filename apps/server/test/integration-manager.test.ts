import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { IntegrationEgressRouter } from "../src/infrastructure/in/channels/egress-router.ts";
import { IntegrationManager } from "../src/infrastructure/in/channels/channel-manager.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const logger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return logger;
  },
};

function integration(overrides: Partial<IntegrationRecord>): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id: "i1",
    scope: "project",
    projectSlug: "ventas",
    kind: "external_chat",
    name: "Chat externo",
    slug: "chat",
    config: {},
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "disconnected",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("integration manager", () => {
  it("starts external chat independently and isolates a needs_config integration", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-manager-"));
    dirs.push(dir);
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 11));
    const egress = new IntegrationEgressRouter();
    const manager = new IntegrationManager({
      store,
      vault,
      egress,
      events: { publish() {} },
      logger,
      projectRouter: { execute: async () => ({ decision: "dropped" }) } as never,
      globalRouter: { execute: async () => ({ decision: "dropped" }) } as never,
      dataDir: dir,
    });
    const chat = integration({ id: "chat", slug: "chat", status: "connected" });
    const telegram = integration({ id: "telegram", slug: "telegram", kind: "telegram", status: "connected" });
    store.integrations.create(chat);
    store.integrations.create(telegram);

    await manager.startAll();
    expect(store.integrations.findById("chat")?.status).toBe("connected");
    expect(store.integrations.findById("telegram")?.status).toBe("needs_config");
    await manager.stop("chat");
    expect(store.integrations.findById("chat")?.status).toBe("disconnected");
    await expect(egress.send("chat", "hola")).rejects.toThrow(/no transport/);
    store.close();
  });
});
