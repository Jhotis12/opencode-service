import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { migrate } from "../src/infrastructure/out/persistence/migrate.ts";
import { openDatabase } from "../src/infrastructure/out/persistence/db.ts";

const now = new Date().toISOString();

describe("persistence migrations", () => {
  it("creates the full schema on an in-memory database", () => {
    const handle = openDatabase(":memory:");
    migrate(handle.sqlite);
    const tables = handle.sqlite
      .query("SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);
    for (const table of [
      "users",
      "vault_secrets",
      "system_settings",
      "system_error_events",
      "projects",
      "integrations",
      "chat_threads",
      "chat_messages",
      "workflow_runs",
      "workflow_step_runs",
      "kb_chunks",
      "kb_chunks_fts",
    ]) {
      expect(tables).toContain(table);
    }
    expect(tables).not.toContain("channels");
    expect(tables).not.toContain("external_databases");
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
      createdAt: now,
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
      startedAt: now,
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
      startedAt: now,
      finishedAt: now,
    });
    expect(store.runs.listSteps("r1")[0]?.output).toEqual({ out: true });
    store.runs.createApproval({ id: "a1", runId: "r1", nodeId: "review", status: "pending", createdAt: now });
    expect(store.runs.pendingApproval("r1")?.nodeId).toBe("review");
    store.runs.decideApproval("r1", "review", "approved", "admin");
    expect(store.runs.pendingApproval("r1")).toBeUndefined();
    store.close();
  });

  it("scopes integrations, vault secrets and notebooks to a project", () => {
    const store = new SqliteStore(":memory:");
    store.integrations.create({
      id: "i1",
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Ventas",
      slug: "ventas-bot",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    store.integrations.create({
      id: "i2",
      scope: "global",
      kind: "telegram",
      name: "Global",
      slug: "global-bot",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    expect(store.integrations.list({ scope: "project", projectSlug: "ventas" })).toHaveLength(1);
    expect(store.integrations.list({ scope: "global" })).toHaveLength(1);
    expect(store.integrations.findBySlug({ scope: "project", projectSlug: "soporte", slug: "ventas-bot" })).toBeUndefined();

    store.vault.upsert({
      id: "v1",
      scope: "project",
      projectSlug: "ventas",
      alias: "token",
      kind: "integration:telegram",
      ciphertext: "cipher",
      createdAt: now,
    });
    expect(store.vault.findByAlias({ scope: "project", projectSlug: "ventas", alias: "token" })?.id).toBe("v1");
    expect(store.vault.findByAlias({ scope: "project", projectSlug: "soporte", alias: "token" })).toBeUndefined();

    store.notebooks.create({ id: "n1", projectSlug: "ventas", slug: "manual", name: "Manual", description: "", createdAt: now });
    expect(store.notebooks.list("ventas")).toHaveLength(1);
    expect(store.notebooks.list("soporte")).toHaveLength(0);
    store.close();
  });

  it("creates and reuses chat threads by scope", () => {
    const store = new SqliteStore(":memory:");
    const project = store.chatThreads.findOrCreate({ scope: "project", projectSlug: "ventas", externalThreadId: "web" });
    const same = store.chatThreads.findOrCreate({ scope: "project", projectSlug: "ventas", externalThreadId: "web" });
    const global = store.chatThreads.findOrCreate({ scope: "global", externalThreadId: "web" });
    expect(same.id).toBe(project.id);
    expect(global.id).not.toBe(project.id);
    store.chat.append({ id: "m1", threadId: project.id, role: "user", content: "hola", createdAt: now });
    expect(store.chat.listByThread(project.id, 10)).toHaveLength(1);
    expect(store.chat.listByThread(global.id, 10)).toHaveLength(0);
    store.close();
  });
});
