import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { DynamicDatabaseClientAdapter } from "../src/infrastructure/out/external-db/dynamic-adapter.ts";
import { ExecuteDatabaseActionUseCase, classifySql } from "../src/application/use-cases/database-actions.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function integration(filename: string): IntegrationRecord {
  const now = new Date().toISOString();
  return {
    id: "db1",
    scope: "project",
    projectSlug: "ventas",
    kind: "sqlite",
    name: "CRM local",
    slug: "crm-local",
    config: { kind: "sqlite", filename },
    secretRefs: {},
    capabilities: ["query"],
    status: "disconnected",
    createdAt: now,
    updatedAt: now,
  };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-db-actions-"));
  dirs.push(dir);
  const filename = join(dir, "client.sqlite");
  const seed = new Database(filename, { create: true });
  seed.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO leads (name) VALUES ('Ana');");
  seed.close();
  const store = new SqliteStore(":memory:");
  store.integrations.create(integration(filename));
  const useCase = new ExecuteDatabaseActionUseCase(
    store,
    new Aes256GcmVaultAdapter(Buffer.alloc(32, 3)),
    new DynamicDatabaseClientAdapter(),
  );
  return { store, useCase, filename };
}

describe("database action use case", () => {
  it("classifies read, write and ddl statements", () => {
    expect(classifySql(" SELECT 1")).toBe("read");
    expect(classifySql("insert into t values (1)")).toBe("write");
    expect(classifySql("ALTER TABLE t ADD COLUMN x TEXT")).toBe("ddl");
    expect(classifySql("VACUUM")).toBeUndefined();
  });

  it("reads rows and rejects writes in read mode", async () => {
    const { store, useCase } = await setup();
    const result = await useCase.execute({
      projectSlug: "ventas",
      integrationId: "db1",
      mode: "read",
      statements: [{ sql: "SELECT name FROM leads ORDER BY id" }],
    });
    expect(result.rows).toEqual([{ name: "Ana" }]);
    expect(result.rowCount).toBe(1);
    expect(result.truncated).toBe(false);
    await expect(
      useCase.execute({
        projectSlug: "ventas",
        integrationId: "db1",
        mode: "read",
        statements: [{ sql: "INSERT INTO leads (name) VALUES ('Luis')" }],
      }),
    ).rejects.toThrow(/read mode/);
    store.close();
  });

  it("commits multi-statement writes and rolls back on failure", async () => {
    const { store, useCase } = await setup();
    const written = await useCase.execute({
      projectSlug: "ventas",
      integrationId: "db1",
      mode: "write",
      statements: [
        { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Luis"] },
        { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Marta"] },
      ],
    });
    expect(written.affectedRows).toBe(2);
    await expect(
      useCase.execute({
        projectSlug: "ventas",
        integrationId: "db1",
        mode: "write",
        statements: [
          { sql: "INSERT INTO leads (name) VALUES (?)", params: ["Pedro"] },
          { sql: "INSERT INTO missing_table (name) VALUES (?)", params: ["Error"] },
        ],
      }),
    ).rejects.toThrow();
    const count = await useCase.execute({
      projectSlug: "ventas",
      integrationId: "db1",
      mode: "read",
      statements: [{ sql: "SELECT COUNT(*) AS total FROM leads" }],
    });
    expect(count.rows).toEqual([{ total: 3 }]);
    store.close();
  });

  it("truncates results and enforces project scope", async () => {
    const { store, useCase } = await setup();
    const truncated = await useCase.execute({
      projectSlug: "ventas",
      integrationId: "db1",
      mode: "read",
      maxRows: 1,
      statements: [
        {
          sql: "SELECT 1 AS n UNION ALL SELECT 2 AS n",
        },
      ],
    });
    expect(truncated.rowCount).toBe(1);
    expect(truncated.truncated).toBe(true);
    await expect(
      useCase.execute({
        projectSlug: "soporte",
        integrationId: "db1",
        mode: "read",
        statements: [{ sql: "SELECT 1" }],
      }),
    ).rejects.toThrow(/scope/);
    store.close();
  });

  it("rejects DDL in write mode for P0", async () => {
    const { store, useCase } = await setup();
    await expect(
      useCase.execute({
        projectSlug: "ventas",
        integrationId: "db1",
        mode: "write",
        statements: [{ sql: "CREATE TABLE extra (id INTEGER)" }],
      }),
    ).rejects.toThrow(/DDL/);
    store.close();
  });
});
