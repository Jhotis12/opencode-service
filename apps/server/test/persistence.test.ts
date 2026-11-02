import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { migrate } from "../src/infrastructure/out/persistence/migrate.ts";
import { openDatabase } from "../src/infrastructure/out/persistence/db.ts";

describe("persistence migrations", () => {
  it("creates the full schema on an in-memory database", () => {
    const handle = openDatabase(":memory:");
    migrate(handle.sqlite);
    const tables = handle.sqlite
      .query("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of ["users", "vault_secrets", "external_databases", "system_settings", "system_error_events", "workflow_runs", "workflow_step_runs", "kb_chunks", "kb_chunks_fts"]) {
      expect(tables).toContain(table);
    }
    handle.close();
  });

  it("is idempotent when run twice", () => {
    const handle = openDatabase(":memory:");
    migrate(handle.sqlite);
    expect(() => migrate(handle.sqlite)).not.toThrow();
    handle.close();
  });
});

describe("sqlite store", () => {
  it("stores users and enforces unique usernames", () => {
    const store = new SqliteStore(":memory:");
    const user = {
      id: "u1",
      username: "admin",
      passwordHash: "hash",
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };
    store.users.create(user);
    expect(store.users.count()).toBe(1);
    expect(store.users.findByUsername("admin")?.id).toBe("u1");
    expect(() => store.users.create({ ...user, id: "u2" })).toThrow();
    store.close();
  });

  it("claims idempotency keys atomically and returns the existing run", () => {
    const store = new SqliteStore(":memory:");
    const base = {
      projectSlug: "p1",
      workflowId: "wf",
      status: "running" as const,
      idempotencyKey: "key-1",
      payloadHash: "hash-a",
      input: { a: 1 },
      entryPoint: "webhook" as const,
      startedAt: new Date().toISOString(),
    };
    const first = store.runs.claim({ ...base, id: "r1" });
    const second = store.runs.claim({ ...base, id: "r2" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.run.id).toBe("r1");
    store.close();
  });

  it("persists steps and approvals for a run", () => {
    const store = new SqliteStore(":memory:");
    store.runs.insertStep({
      id: "s1",
      runId: "r1",
      nodeId: "start",
      status: "succeeded",
      input: { in: true },
      output: { out: true },
      durationMs: 5,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    });
    expect(store.runs.listSteps("r1")[0]?.output).toEqual({ out: true });
    store.runs.createApproval({ id: "a1", runId: "r1", nodeId: "review", status: "pending", createdAt: new Date().toISOString() });
    expect(store.runs.pendingApproval("r1")?.nodeId).toBe("review");
    store.runs.decideApproval("r1", "review", "approved", "admin");
    expect(store.runs.pendingApproval("r1")).toBeUndefined();
    store.close();
  });
});
