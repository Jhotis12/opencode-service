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
      "workflow_versions",
      "workflow_step_runs",
      "workflow_approvals",
      "workflow_deliveries",
      "workflow_schedule_state",
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

  it("preserves existing rows when migrating an installed database", () => {
    const handle = openDatabase(":memory:");
    migrate(handle.sqlite);
    handle.sqlite
      .query("INSERT INTO projects (id, slug, name, description, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("p1", "ventas", "Ventas", "", now);
    handle.sqlite
      .query(
        "INSERT INTO integrations (id, scope, project_slug, kind, name, slug, config, secret_refs, capabilities, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "i1",
        "project",
        "ventas",
        "sqlite",
        "Local",
        "local",
        '{"kind":"sqlite","filename":"/tmp/local.db"}',
        "{}",
        "[]",
        "disconnected",
        now,
        now,
      );
    migrate(handle.sqlite);
    expect(handle.sqlite.query("SELECT name FROM projects WHERE slug = 'ventas'").get()).toEqual({ name: "Ventas" });
    const integrationConfig = handle.sqlite.query("SELECT config FROM integrations WHERE id = 'i1'").get() as {
      config: string;
    };
    expect(JSON.parse(integrationConfig.config)).toMatchObject({ access: "write", allowDdl: true, maxRows: 1000 });
    expect(
      handle.sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workflow_deliveries'").get(),
    ).toBeTruthy();
    expect(
      handle.sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workflow_schedule_state'").get(),
    ).toBeTruthy();
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

  it("tracks notification deliveries by action key", () => {
    const store = new SqliteStore(":memory:");
    store.deliveries.create({
      id: "d1",
      projectSlug: "ventas",
      runId: "r1",
      nodeId: "notify",
      integrationId: "tg1",
      actionKey: "r1:notify",
      recipient: "123",
      status: "pending",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    expect(store.deliveries.findByActionKey({ actionKey: "r1:notify", integrationId: "tg1" })?.status).toBe("pending");
    store.deliveries.update("d1", { status: "delivered", providerMessageId: "m1", attempts: 1 });
    expect(store.deliveries.findByActionKey({ actionKey: "r1:notify", integrationId: "tg1" })?.status).toBe("delivered");
    expect(store.deliveries.listByRun("r1")).toHaveLength(1);
    store.close();
  });

  it("claims due workflow timers once", () => {
    const store = new SqliteStore(":memory:");
    store.timers.create({
      id: "t1",
      runId: "r1",
      nodeId: "wait",
      dueAt: new Date(Date.now() + 60_000).toISOString(),
      status: "pending",
      payload: { keep: true },
      createdAt: now,
      updatedAt: now,
    });
    expect(store.timers.claimDue(new Date(), 10)).toHaveLength(0);
    const due = store.timers.claimDue(new Date(Date.now() + 120_000), 10);
    expect(due).toHaveLength(1);
    expect(due[0]?.payload).toEqual({ keep: true });
    expect(store.timers.claimDue(new Date(Date.now() + 120_000), 10)).toHaveLength(0);
    store.timers.markFired("t1");
    expect(store.timers.listByRun("r1")[0]?.status).toBe("fired");
    store.close();
  });

  it("tracks session context by OpenCode session", () => {
    const store = new SqliteStore(":memory:");
    store.sessionContexts.upsert({
      sessionId: "s1",
      scope: "project",
      projectSlug: "ventas",
      agentId: "ventas/calificador",
      context: "workflow",
      runId: "r1",
      createdAt: now,
      updatedAt: now,
    });
    expect(store.sessionContexts.find("s1")).toMatchObject({
      context: "workflow",
      agentId: "ventas/calificador",
      runId: "r1",
    });
    store.sessionContexts.upsert({
      sessionId: "s1",
      scope: "project",
      projectSlug: "ventas",
      agentId: "ventas/calificador",
      context: "chat",
      createdAt: now,
      updatedAt: now,
    });
    expect(store.sessionContexts.find("s1")?.context).toBe("chat");
    store.sessionContexts.remove("s1");
    expect(store.sessionContexts.find("s1")).toBeUndefined();
    store.close();
  });

  it("stores and updates schedule state per workflow trigger", () => {
    const store = new SqliteStore(":memory:");
    store.scheduleStates.upsert({
      id: "s1",
      projectSlug: "ventas",
      workflowId: "wf",
      nodeId: "start",
      timezone: "America/Mexico_City",
      enabled: true,
      overlapPolicy: "skip",
      catchUp: false,
      catchUpWindowMinutes: 60,
      updatedAt: now,
    });
    expect(store.scheduleStates.find({ projectSlug: "ventas", workflowId: "wf", nodeId: "start" })?.timezone).toBe(
      "America/Mexico_City",
    );
    store.scheduleStates.update(
      { projectSlug: "ventas", workflowId: "wf", nodeId: "start" },
      { enabled: false, lastWindowAt: now, nextWindowAt: now },
    );
    const state = store.scheduleStates.find({ projectSlug: "ventas", workflowId: "wf", nodeId: "start" });
    expect(state?.enabled).toBe(false);
    expect(state?.lastWindowAt).toBe(now);
    expect(store.scheduleStates.listAll()).toHaveLength(1);
    store.scheduleStates.removeByProject("ventas");
    expect(store.scheduleStates.listAll()).toHaveLength(0);
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

  it("records, deduplicates, lists, and resolves workflow version snapshots", () => {
    const store = new SqliteStore(":memory:");
    const graphV1 = {
      version: 1 as const,
      id: "ventas",
      name: "Ventas",
      description: "",
      nodes: [{ id: "start", type: "trigger" as const, position: { x: 0, y: 0 }, config: { kind: "manual" }, notebookIds: [], timeoutMs: 30_000, retryPolicy: { maxRetries: 0 } }],
      edges: [],
      updatedAt: now,
    };
    const v1 = store.versions.record({
      projectSlug: "ventas",
      graphHash: "hash-1",
      graph: graphV1,
      codeBundle: { "nodes/a.ts": "export default async () => 1;" },
      createdBy: "admin",
    });
    expect(v1.version).toBe(1);
    const same = store.versions.record({
      projectSlug: "ventas",
      graphHash: "hash-1",
      graph: graphV1,
      codeBundle: { "nodes/a.ts": "export default async () => 1;" },
    });
    expect(same.id).toBe(v1.id);
    expect(same.version).toBe(1);

    const v2 = store.versions.record({
      projectSlug: "ventas",
      graphHash: "hash-2",
      graph: { ...graphV1, name: "Ventas V2" },
      codeBundle: { "nodes/a.ts": "export default async () => 2;" },
      createdBy: "admin",
    });
    expect(v2.version).toBe(2);
    expect(store.versions.list("ventas")).toHaveLength(2);
    expect(store.versions.findByVersion("ventas", 1)?.graph.name).toBe("Ventas");
    expect(store.versions.findByGraphHash("ventas", "hash-2")?.version).toBe(2);
    expect(store.versions.latest("ventas")?.version).toBe(2);
    store.close();
  });
});
