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
  QueryExternalDatabaseUseCase,
  SaveExternalDatabaseUseCase,
  TestExternalDatabaseUseCase,
} from "../src/application/use-cases/connections.ts";
import type { AgentRuntimePort, AgentModelInfo } from "../src/application/ports/runtime.ts";

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
  async switchModel() {}
  async switchAgent() {}
  async reloadLocation() {}
  async subscribe() { return () => undefined; }
}

describe("provider connection", () => {
  it("registers the opencode-go key and stores it encrypted", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 1));
    const runtime = new FakeRuntime();
    const result = await new ConnectProviderUseCase(store, vault, runtime).execute("sk-opencode-go-123456");
    expect(runtime.registered[0]).toEqual({ providerID: "opencode-go", apiKey: "sk-opencode-go-123456" });
    expect(result.models.map((m) => m.modelID)).toEqual(["fast"]);
    const stored = store.vault.findByAlias("provider:opencode-go")!;
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

describe("external database pool", () => {
  it("saves, tests and queries a sqlite database by alias", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-db-"));
    dirs.push(dir);
    const file = join(dir, "client.sqlite");
    const seed = new Database(file, { create: true });
    seed.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO leads (name) VALUES ('Ana');");
    seed.close();

    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 2));
    const adapter = new DynamicDatabaseClientAdapter();
    new SaveExternalDatabaseUseCase(store, vault).execute("crm_local", { driver: "sqlite", filename: file });

    const test = await new TestExternalDatabaseUseCase(store, vault, adapter).execute("crm_local");
    expect(test.ok).toBe(true);

    const rows = await new QueryExternalDatabaseUseCase(store, vault, adapter).execute(
      "crm_local",
      "SELECT name FROM leads",
    );
    expect(rows).toEqual([{ name: "Ana" }]);
    expect(store.externalDatabases.findByAlias("crm_local")!.ciphertext).not.toContain(file);
    store.close();
  });

  it("rejects unknown aliases and non-sql statements", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 2));
    const adapter = new DynamicDatabaseClientAdapter();
    await expect(new TestExternalDatabaseUseCase(store, vault, adapter).execute("nope")).rejects.toThrow();
    await expect(
      new QueryExternalDatabaseUseCase(store, vault, adapter).execute("nope", "DROP TABLE x"),
    ).rejects.toThrow();
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
