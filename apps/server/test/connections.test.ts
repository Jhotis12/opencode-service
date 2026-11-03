import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import {
  DynamicDatabaseClientAdapter,
  sanitizeDatabaseError,
} from "../src/infrastructure/out/external-db/dynamic-adapter.ts";
import {
  ConnectProviderUseCase,
  QueryDatabaseIntegrationUseCase,
  TestDatabaseIntegrationUseCase,
} from "../src/application/use-cases/connections.ts";
import type { AgentRuntimePort, AgentModelInfo } from "../src/application/ports/runtime.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

class FakeRuntime implements AgentRuntimePort {
  registered: Array<{ providerID: string; apiKey: string }> = [];
  async ensureReady() { return { url: "http://fake" }; }
  async health() { return { ok: true, detail: "fake" }; }
  async listModels(): Promise<AgentModelInfo[]> {
    return [
      { providerID: "opencode-go", modelID: "fast", name: "Fast" },
      { providerID: "other", modelID: "x", name: "Other" },
    ];
  }
  async registerProviderKey(providerID: string, apiKey: string) { this.registered.push({ providerID, apiKey }); }
  async createSession() { return { id: "s1" }; }
  async prompt() { return "ok"; }
  async interrupt() {}
  async switchModel() {}
  async switchAgent() {}
  async reloadLocation() {}
  async subscribe() { return () => undefined; }
}

function integration(overrides: Partial<IntegrationRecord> = {}): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id: "db1",
    scope: "project",
    projectSlug: "ventas",
    kind: "sqlite",
    name: "CRM local",
    slug: "crm-local",
    config: { kind: "sqlite", filename: "" },
    secretRefs: {},
    capabilities: ["query"],
    status: "disconnected",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("provider connection", () => {
  it("registers the opencode-go key and stores it encrypted", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 1));
    const runtime = new FakeRuntime();
    const result = await new ConnectProviderUseCase(store, vault, runtime).execute("sk-opencode-go-123456");
    expect(runtime.registered[0]).toEqual({ providerID: "opencode-go", apiKey: "sk-opencode-go-123456" });
    expect(result.models.map((m) => m.modelID)).toEqual(["fast"]);
    const stored = store.vault.findByAlias({ scope: "global", alias: "provider:opencode-go" })!;
    expect(stored.ciphertext).not.toContain("sk-opencode-go");
    expect(vault.decrypt(stored.ciphertext)).toBe("sk-opencode-go-123456");
    store.close();
  });

  it("rejects obviously short keys", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 1));
    await expect(new ConnectProviderUseCase(store, vault, new FakeRuntime()).execute("short")).rejects.toThrow();
    store.close();
  });
});

describe("project database integrations", () => {
  it("tests and queries a sqlite database owned by a project", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-db-"));
    dirs.push(dir);
    const file = join(dir, "client.sqlite");
    const seed = new Database(file, { create: true });
    seed.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO leads (name) VALUES ('Ana');");
    seed.close();

    const store = new SqliteStore(":memory:");
    store.integrations.create(integration({ config: { kind: "sqlite", filename: file } }));
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 2));
    const adapter = new DynamicDatabaseClientAdapter();

    const test = await new TestDatabaseIntegrationUseCase(store, vault, adapter).execute("db1", {
      scope: "project",
      projectSlug: "ventas",
    });
    expect(test.ok).toBe(true);

    const rows = await new QueryDatabaseIntegrationUseCase(store, vault, adapter).execute(
      "db1",
      { scope: "project", projectSlug: "ventas" },
      "SELECT name FROM leads",
    );
    expect(rows).toEqual([{ name: "Ana" }]);

    await expect(
      new QueryDatabaseIntegrationUseCase(store, vault, adapter).execute(
        "db1",
        { scope: "project", projectSlug: "soporte" },
        "SELECT 1",
      ),
    ).rejects.toThrow(/scope/);

    const committed = await adapter.transaction({ driver: "sqlite", filename: file }, [
      { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Luis"] },
      { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Marta"] },
      { sql: "SELECT name FROM leads ORDER BY id" },
    ]);
    expect(committed[0]?.affectedRows).toBe(1);
    expect(committed[2]?.rows).toEqual([{ name: "Ana" }, { name: "Luis" }, { name: "Marta" }]);

    await expect(
      adapter.transaction({ driver: "sqlite", filename: file }, [
        { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Pedro"] },
        { sql: "INSERT INTO missing_table (name) VALUES (?)", params: ["Error"] },
      ]),
    ).rejects.toThrow();
    const afterRollback = await adapter.query({ driver: "sqlite", filename: file }, "SELECT name FROM leads ORDER BY id");
    expect(afterRollback).toEqual([{ name: "Ana" }, { name: "Luis" }, { name: "Marta" }]);

    store.integrations.update("db1", {
      config: { kind: "sqlite", filename: file, access: "read", maxRows: 1_000, allowDdl: false },
    });
    await expect(
      new QueryDatabaseIntegrationUseCase(store, vault, adapter).execute(
        "db1",
        { scope: "project", projectSlug: "ventas" },
        "INSERT INTO leads (name) VALUES ('ReadOnly')",
      ),
    ).rejects.toThrow(/read-only/);
    store.close();
  });

  it("requires a secret reference for network databases", async () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create(
      integration({
        kind: "postgres",
        config: { kind: "postgres", host: "localhost", port: 5432, database: "crm", user: "app" },
        secretRefs: {},
      }),
    );
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 2));
    const adapter = new DynamicDatabaseClientAdapter();
    await expect(
      new TestDatabaseIntegrationUseCase(store, vault, adapter).execute("db1", { scope: "project", projectSlug: "ventas" }),
    ).rejects.toThrow(/missing secret/);
    store.close();
  });

  it("sanitizes credentials out of driver errors", () => {
    const message = sanitizeDatabaseError(
      new Error("connect ECONNREFUSED postgres://admin:supersecret@10.0.0.5:5432/db password=supersecret"),
    );
    expect(message).not.toContain("supersecret");
    expect(message).toContain("[REDACTED]");
  });
});
