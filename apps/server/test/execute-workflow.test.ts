import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SseEvent, WorkflowGraph } from "@platform/shared";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { BunWorkerPoolAdapter } from "../src/infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { DynamicDatabaseClientAdapter } from "../src/infrastructure/out/external-db/dynamic-adapter.ts";
import { ExecuteDatabaseActionUseCase } from "../src/application/use-cases/database-actions.ts";
import { SendNotificationUseCase } from "../src/application/use-cases/send-notification.ts";
import type { EgressSendResult, IntegrationEgressPort } from "../src/application/ports/channels.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import { NoopErrorTracker } from "../src/infrastructure/out/telemetry/sentry.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { AgentModelInfo, AgentRuntimePort } from "../src/application/ports/runtime.ts";
import { AgentPromptTimeoutError } from "../src/application/ports/runtime.ts";
import type { EventBus } from "../src/application/ports/events.ts";
import {
  ExecuteWorkflowRunUseCase,
  executeHttpNode,
  type ExecutorDeps,
} from "../src/application/use-cases/execute-workflow.ts";
import {
  IdempotencyMismatchError,
  RunInFlightError,
  computeGraphHash,
  computePayloadHash,
} from "../src/domain/workflow/graph.ts";

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

class FakeAgent implements AgentRuntimePort {
  models: AgentModelInfo[] = [{ providerID: "opencode-go", modelID: "fast", name: "Fast" }];
  sessions: Array<{ id: string; directory: string; agent?: string; model?: string }> = [];
  prompts: string[] = [];
  switchedModels: string[] = [];
  switchedAgents: string[] = [];
  interrupted: string[] = [];
  async ensureReady() { return { url: "http://fake" }; }
  async health() { return { ok: true, detail: "fake" }; }
  async listModels() { return this.models; }
  async registerProviderKey() {}
  async createSession(input: { directory: string; agent?: string; model?: string }) {
    const session = { id: `s${this.sessions.length + 1}`, ...input };
    this.sessions.push(session);
    return { id: session.id };
  }
  async prompt(_sessionId: string, text: string) {
    this.prompts.push(text);
    return "respuesta-agente";
  }
  async interrupt(sessionId: string) { this.interrupted.push(sessionId); }
  async switchModel(_sessionId: string, model: string) { this.switchedModels.push(model); }
  async switchAgent(_sessionId: string, agent: string) { this.switchedAgents.push(agent); }
  async reloadLocation() {}
  async subscribe() { return () => undefined; }
}

class FakeEvents implements EventBus {
  events: SseEvent[] = [];
  publish(event: SseEvent) { this.events.push(event); }
}

class RecordingEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string; recipient?: string }> = [];
  async send(integrationId: string, text: string, recipient?: string): Promise<EgressSendResult> {
    this.sent.push({ integrationId, text, recipient });
    return { providerMessageId: `msg-${this.sent.length}` };
  }
}

async function setup(graph: WorkflowGraph, nodes: Record<string, string>, extraDeps: Partial<ExecutorDeps> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "platform-exec-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(dir);
  await workspace.createProject({ slug: "p1", name: "P1" });
  await workspace.writeWorkflow("p1", graph);
  for (const [file, code] of Object.entries(nodes)) await workspace.writeNode("p1", file, code);
  const store = new SqliteStore(":memory:");
  const agent = new FakeAgent();
  const events = new FakeEvents();
  const metrics = new InMemoryMetrics();
  const deps: ExecutorDeps = {
    store,
    workspace,
    worker: new BunWorkerPoolAdapter(),
    agent,
    events,
    metrics,
    errors: new NoopErrorTracker(),
    logger: silentLogger,
    ...extraDeps,
  };
  return { dir, workspace, store, agent, events, metrics, executor: new ExecuteWorkflowRunUseCase(deps), deps };
}

function baseGraph(): WorkflowGraph {
  return {
    version: 1,
    id: "wf",
    name: "Demo",
    description: "",
    defaultModel: "opencode-go/fast",
    nodes: [
      { id: "start", type: "trigger", position: { x: 0, y: 0 }, config: { kind: "manual" }, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
      { id: "double", type: "code", codeFile: "nodes/double.ts", position: { x: 1, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
    ],
    edges: [{ id: "e1", source: "start", target: "double" }],
    updatedAt: new Date().toISOString(),
  };
}

describe("workflow execution", () => {
  it("executes database nodes and passes their result downstream", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-db-node-"));
    dirs.push(dir);
    const filename = join(dir, "client.sqlite");
    const seed = new Database(filename, { create: true });
    seed.exec("CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT);");
    seed.close();
    const now = new Date().toISOString();
    const graph: WorkflowGraph = {
      version: 1,
      id: "db-flow",
      name: "DB flow",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "write",
          type: "database",
          position: { x: 100, y: 0 },
          config: {
            integrationId: "db1",
            mode: "write",
            statements: [{ sql: "INSERT INTO leads (name) VALUES (?)", params: ["{{input.name}}"] }],
          },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "read",
          type: "database",
          position: { x: 200, y: 0 },
          config: {
            integrationId: "db1",
            mode: "read",
            statements: [{ sql: "SELECT name FROM leads ORDER BY id" }],
          },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "write" },
        { id: "e2", source: "write", target: "read" },
      ],
      updatedAt: now,
    };
    const { store, deps } = await setup(graph, {});
    store.integrations.create({
      id: "db1",
      scope: "project",
      projectSlug: "p1",
      kind: "sqlite",
      name: "Local",
      slug: "local",
      config: { kind: "sqlite", filename },
      secretRefs: {},
      capabilities: ["query"],
      status: "disconnected",
      createdAt: now,
      updatedAt: now,
    });
    const databaseAction = new ExecuteDatabaseActionUseCase(
      store,
      new Aes256GcmVaultAdapter(Buffer.alloc(32, 4)),
      new DynamicDatabaseClientAdapter(),
    );
    const executor = new ExecuteWorkflowRunUseCase({ ...deps, databaseAction });
    const run = await executor.execute({
      projectSlug: "p1",
      graph,
      payload: { name: "Ana" },
      entryPoint: "web_ui",
    });
    expect(run.status).toBe("succeeded");
    expect(run.output).toMatchObject({ rows: [{ name: "Ana" }], rowCount: 1 });
    expect(store.runs.listSteps(run.id).map((step) => step.nodeId)).toEqual(["start", "write", "read"]);
    store.close();
  });

  it("executes notify nodes for telegram and external chat", async () => {
    const now = new Date().toISOString();
    const graph: WorkflowGraph = {
      version: 1,
      id: "notify-flow",
      name: "Notify flow",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "telegram",
          type: "notify",
          position: { x: 100, y: 0 },
          config: { integrationId: "tg1", recipient: "123", text: "Hola {{input.nombre}}" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "chat",
          type: "notify",
          position: { x: 200, y: 0 },
          config: { integrationId: "chat1", text: "Fin: {{input.providerMessageId}}" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [
        { id: "e1", source: "start", target: "telegram" },
        { id: "e2", source: "telegram", target: "chat" },
      ],
      updatedAt: now,
    };
    const { store, deps } = await setup(graph, {});
    const base = {
      scope: "project" as const,
      projectSlug: "p1",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message" as const, "outbound_message" as const],
      status: "connected" as const,
      createdAt: now,
      updatedAt: now,
    };
    store.integrations.create({ ...base, id: "tg1", kind: "telegram", name: "TG", slug: "tg" });
    store.integrations.create({ ...base, id: "chat1", kind: "external_chat", name: "Chat", slug: "chat" });
    const egress = new RecordingEgress();
    const executor = new ExecuteWorkflowRunUseCase({
      ...deps,
      notification: new SendNotificationUseCase(store, egress),
    });
    const run = await executor.execute({
      projectSlug: "p1",
      graph,
      payload: { nombre: "Ana" },
      entryPoint: "web_ui",
    });
    expect(run.status).toBe("succeeded");
    expect(egress.sent[0]).toEqual({ integrationId: "tg1", text: "Hola Ana", recipient: "123" });
    expect(egress.sent[1]).toEqual({ integrationId: "chat1", text: "Fin: msg-1", recipient: undefined });
    expect(store.deliveries.listByRun(run.id)).toHaveLength(2);
    store.close();
  });

  it("marks an agent timeout as timed_out", async () => {
    class TimeoutAgent extends FakeAgent {
      async prompt(_sessionId: string, _text: string): Promise<string> {
        throw new AgentPromptTimeoutError(10);
      }
    }
    const graph: WorkflowGraph = {
      version: 1,
      id: "timeout-flow",
      name: "Timeout flow",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "agent",
          type: "agent",
          agentId: "ventas/calificador",
          position: { x: 100, y: 0 },
          config: {},
          notebookIds: [],
          timeoutMs: 10,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "agent" }],
      updatedAt: new Date().toISOString(),
    };
    const { executor, store } = await setup(graph, {}, { agent: new TimeoutAgent() });
    const run = await executor.execute({
      projectSlug: "p1",
      graph,
      payload: {},
      entryPoint: "web_ui",
    });
    expect(run.status).toBe("timed_out");
    expect(store.runs.listSteps(run.id).at(-1)?.status).toBe("timed_out");
    store.close();
  });

  it("retries HTTP nodes with backoff and records exhaustion", async () => {
    const graph: WorkflowGraph = {
      version: 1,
      id: "http-retry",
      name: "HTTP retry",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "http",
          type: "http",
          position: { x: 100, y: 0 },
          config: { method: "GET", url: "https://example.test/data" },
          notebookIds: [],
          timeoutMs: 1_000,
          retryPolicy: { maxRetries: 1, backoffMs: 0 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "http" }],
      updatedAt: new Date().toISOString(),
    };
    const { executor, store } = await setup(graph, {});
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("fail", { status: 500 });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    try {
      const run = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
      expect(run.status).toBe("succeeded");
      expect(calls).toBe(2);
      expect(run.output).toEqual({ ok: true });

      calls = 0;
      globalThis.fetch = (async () => {
        calls += 1;
        return new Response("down", { status: 500 });
      }) as unknown as typeof fetch;
      const failed = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
      expect(failed.status).toBe("failed");
      expect(calls).toBe(2);
      expect(store.runs.listSteps(failed.id).at(-1)?.status).toBe("failed");
    } finally {
      globalThis.fetch = originalFetch;
      store.close();
    }
  });

  it("follows continue and route error strategies", async () => {
    const now = new Date().toISOString();
    const baseNodes = [
      {
        id: "start",
        type: "trigger" as const,
        position: { x: 0, y: 0 },
        config: { kind: "manual" as const },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "http",
        type: "http" as const,
        position: { x: 100, y: 0 },
        config: { method: "GET", url: "https://example.test/fail" },
        notebookIds: [],
        timeoutMs: 1_000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
        onError: { strategy: "continue" as const },
      },
      {
        id: "after",
        type: "transform" as const,
        position: { x: 200, y: 0 },
        config: { template: '{"failed":"{{input.error.nodeId}}"}' },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ];
    const continueGraph: WorkflowGraph = {
      version: 1,
      id: "continue-flow",
      name: "Continue flow",
      description: "",
      nodes: baseNodes,
      edges: [
        { id: "e1", source: "start", target: "http" },
        { id: "e2", source: "http", target: "after" },
      ],
      updatedAt: now,
    };
    const { executor, store } = await setup(continueGraph, {});
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    try {
      const run = await executor.execute({ projectSlug: "p1", graph: continueGraph, payload: {}, entryPoint: "web_ui" });
      expect(run.status).toBe("succeeded");
      expect(run.output).toEqual({ failed: "http" });
      expect(store.runs.listSteps(run.id).map((step) => [step.nodeId, step.status])).toEqual([
        ["start", "succeeded"],
        ["http", "failed"],
        ["after", "succeeded"],
      ]);

      const routeGraph: WorkflowGraph = {
        ...continueGraph,
        id: "route-flow",
        nodes: [
          baseNodes[0]!,
          {
            ...baseNodes[1]!,
            onError: { strategy: "route" as const, target: "fallback" },
          },
          {
            id: "fallback",
            type: "transform" as const,
            position: { x: 200, y: 0 },
            config: { template: '{"route":"{{input.error.message}}"}' },
            notebookIds: [],
            timeoutMs: 30_000,
            retryPolicy: { maxRetries: 0 },
          },
        ],
        edges: [{ id: "e1", source: "start", target: "http" }],
      };
      const routed = await executor.execute({ projectSlug: "p1", graph: routeGraph, payload: {}, entryPoint: "web_ui" });
      expect(routed.status).toBe("succeeded");
      expect((routed.output as { route: string }).route).toContain("HTTP 500");
      expect(store.runs.listSteps(routed.id).map((step) => step.nodeId)).toEqual(["start", "http", "fallback"]);
    } finally {
      globalThis.fetch = originalFetch;
      store.close();
    }
  });

  it("resolves HTTP integration base URLs and vault secrets", async () => {
    const store = new SqliteStore(":memory:");
    const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 9));
    const now = new Date().toISOString();
    store.integrations.create({
      id: "http1",
      scope: "project",
      projectSlug: "p1",
      kind: "http",
      name: "API",
      slug: "api",
      config: { kind: "http", baseUrl: "https://api.example.com/v1" },
      secretRefs: {},
      capabilities: [],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    store.vault.upsert({
      id: "s1",
      scope: "project",
      projectSlug: "p1",
      alias: "token",
      kind: "generic",
      ciphertext: vault.encrypt("s3cret"),
      createdAt: now,
    });
    const originalFetch = globalThis.fetch;
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    try {
      const result = await executeHttpNode(
        {
          id: "http",
          type: "http",
          position: { x: 0, y: 0 },
          config: {
            integrationId: "http1",
            method: "POST",
            url: "/leads",
            headers: { authorization: "secret:token" },
            body: { token: "{{secret.token}}" },
          },
          notebookIds: [],
          timeoutMs: 1_000,
          retryPolicy: { maxRetries: 0 },
        },
        {},
        { projectSlug: "p1", store, vault },
      );
      expect(result).toEqual({ ok: true });
      expect(requests[0]?.url).toBe("https://api.example.com/v1/leads");
      expect((requests[0]?.init?.headers as Record<string, string>).authorization).toBe("s3cret");
      expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ token: "s3cret" });
    } finally {
      globalThis.fetch = originalFetch;
      store.close();
    }
  });

  it("runs code and agent nodes, checkpointing every step", async () => {
    const graph = baseGraph();
    graph.nodes.push({ id: "reply", type: "agent", agentId: "ventas/cotizador", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } });
    graph.edges.push({ id: "e2", source: "double", target: "reply" });
    const { executor, store, agent, events, metrics } = await setup(graph, {
      "nodes/double.ts": `export default async (input: { n: number }) => ({ doubled: input.n * 2 });`,
    });

    const run = await executor.execute({ projectSlug: "p1", graph, payload: { n: 4 }, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toBe("respuesta-agente");
    const steps = store.runs.listSteps(run.id);
    expect(steps.map((step) => step.nodeId)).toEqual(["start", "double", "reply"]);
    expect(steps[1]?.output).toEqual({ doubled: 8 });
    expect(steps[2]?.model).toBe("opencode-go/fast");
    expect(steps[2]?.agentId).toBe("ventas/cotizador");
    expect(agent.prompts[0]).toContain("doubled");
    expect(events.events.some((event) => event.type === "run.updated" && event.status === "succeeded")).toBe(true);
    expect(
      events.events.some(
        (event) => event.type === "run.updated" && event.nodeId === "double" && event.stepStatus === "running",
      ),
    ).toBe(true);
    expect(
      events.events.some(
        (event) => event.type === "run.updated" && event.nodeId === "double" && event.stepStatus === "succeeded",
      ),
    ).toBe(true);
    expect(metrics.snapshot().requests).toBe(0);
    expect(metrics.counter("workflow_runs")).toBe(1);
  });

  it("honours idempotency keys and rejects payload mismatches", async () => {
    const graph = baseGraph();
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async (input: { n: number }) => ({ doubled: input.n * 2 });`,
    });
    const input = { projectSlug: "p1", graph, payload: { n: 2 }, entryPoint: "webhook" as const, idempotencyKey: "abc" };
    const first = await executor.execute(input);
    const second = await executor.execute(input);
    expect(second.id).toBe(first.id);
    expect(store.runs.listSteps(first.id).filter((step) => step.nodeId === "double")).toHaveLength(1);

    await expect(executor.execute({ ...input, payload: { n: 3 } })).rejects.toBeInstanceOf(IdempotencyMismatchError);
  });

  it("rejects a trigger whose idempotency key is already in flight", async () => {
    const graph = baseGraph();
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async () => true;`,
    });
    const payload = { n: 1 };
    store.runs.claim({
      id: "existing",
      projectSlug: "p1",
      workflowId: graph.id,
      status: "running",
      idempotencyKey: "inflight",
      payloadHash: computePayloadHash(payload),
      input: payload,
      entryPoint: "webhook",
      startedAt: new Date().toISOString(),
    });
    await expect(
      executor.execute({ projectSlug: "p1", graph, payload, entryPoint: "webhook", idempotencyKey: "inflight" }),
    ).rejects.toBeInstanceOf(RunInFlightError);
  });

  it("records failures and replays from the failed step without re-running earlier nodes", async () => {
    const graph = baseGraph();
    graph.nodes.push({ id: "check", type: "code", codeFile: "nodes/check.ts", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } });
    graph.edges.push({ id: "e2", source: "double", target: "check" });
    const { executor, store, dir, workspace } = await setup(graph, {
      "nodes/double.ts": `export default async () => true;`,
      "nodes/check.ts": `export default async () => true;`,
    });
    const marker = join(dir, "marker.txt");
    const flag = join(dir, "flag.txt");
    await workspace.writeNode(
      "p1",
      "nodes/double.ts",
      `import { appendFileSync } from "node:fs"; export default async () => { appendFileSync(${JSON.stringify(marker)}, "x"); return true; };`,
    );
    await workspace.writeNode(
      "p1",
      "nodes/check.ts",
      `import { readFileSync } from "node:fs"; export default async () => { const flag = readFileSync(${JSON.stringify(flag)}, "utf8"); if (flag.trim() !== "ok") throw new Error("not ready"); return true; };`,
    );

    const failed = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(failed.status).toBe("failed");
    expect(failed.error).toBeDefined();
    expect(store.runs.listSteps(failed.id).find((step) => step.nodeId === "check")?.status).toBe("failed");

    await writeFile(flag, "ok");
    const replayed = await executor.replay(failed.id, "check");
    expect(replayed.status).toBe("succeeded");
    expect(await readFile(marker, "utf8")).toBe("x");
  });

  it("pauses at approval nodes and resumes after an approved decision", async () => {
    const graph = baseGraph();
    graph.nodes.push({ id: "review", type: "approval", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } });
    graph.nodes.push({ id: "after", type: "code", codeFile: "nodes/after.ts", position: { x: 3, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } });
    graph.edges.push({ id: "e2", source: "double", target: "review" }, { id: "e3", source: "review", target: "after" });
    const { executor, store, events } = await setup(graph, {
      "nodes/double.ts": `export default async () => true;`,
      "nodes/after.ts": `export default async () => "done";`,
    });

    const paused = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(paused.status).toBe("paused");
    expect(store.runs.pendingApproval(paused.id)?.nodeId).toBe("review");
    expect(events.events.some((event) => event.type === "run.updated" && event.status === "paused")).toBe(true);

    const resumed = await executor.resumeWithApproval(paused.id, "review", true, "admin");
    expect(resumed.status).toBe("succeeded");
    expect(resumed.output).toBe("done");
    expect(store.runs.findApproval(paused.id, "review")?.status).toBe("approved");
  });

  it("honors autoApprove without creating a pending approval", async () => {
    const graph = baseGraph();
    graph.nodes.push(
      {
        id: "review",
        type: "approval",
        position: { x: 2, y: 0 },
        config: { autoApprove: true },
        notebookIds: [],
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "after",
        type: "code",
        codeFile: "nodes/after.ts",
        position: { x: 3, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 0 },
      },
    );
    graph.edges.push({ id: "e2", source: "double", target: "review" }, { id: "e3", source: "review", target: "after" });
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async (input: { n: number }) => ({ doubled: input.n * 2 });`,
      "nodes/after.ts": `export default async () => "done";`,
    });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: { n: 2 }, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toBe("done");
    expect(store.runs.pendingApproval(run.id)).toBeUndefined();
    expect(store.runs.findApproval(run.id, "review")).toMatchObject({ status: "approved", decidedBy: "autoApprove" });
    expect(store.runs.listSteps(run.id).find((step) => step.nodeId === "review")?.status).toBe("succeeded");
  });

  it("persists durable delays and resumes from a timer", async () => {
    const graph = baseGraph();
    graph.nodes.push(
      {
        id: "wait",
        type: "delay",
        position: { x: 2, y: 0 },
        config: { waitUntil: new Date(Date.now() + 3_600_000).toISOString() },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "after",
        type: "code",
        codeFile: "nodes/after.ts",
        position: { x: 3, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    );
    graph.edges.push({ id: "e2", source: "double", target: "wait" }, { id: "e3", source: "wait", target: "after" });
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async (input: { n: number }) => ({ doubled: input.n * 2 });`,
      "nodes/after.ts": `export default async () => "done";`,
    });
    const paused = await executor.execute({ projectSlug: "p1", graph, payload: { n: 2 }, entryPoint: "web_ui" });
    expect(paused.status).toBe("paused");
    const timers = store.timers.listByRun(paused.id);
    expect(timers).toHaveLength(1);
    expect(timers[0]?.nodeId).toBe("wait");
    const resumed = await executor.resumeFromTimer(paused.id, "wait");
    expect(resumed.status).toBe("succeeded");
    expect(resumed.output).toBe("done");
    store.close();
  });

  it("executes a subworkflow by immutable version and rejects cycles", async () => {
    const childGraph: WorkflowGraph = {
      version: 1,
      id: "child",
      name: "Child",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "echo",
          type: "transform",
          position: { x: 100, y: 0 },
          config: { template: '{"value":"{{input.value}}"}' },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "echo" }],
      updatedAt: new Date().toISOString(),
    };
    const mainGraph = baseGraph();
    mainGraph.nodes.push({
      id: "sub",
      type: "subworkflow",
      position: { x: 2, y: 0 },
      config: { versionId: "version-placeholder" },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    mainGraph.edges.push({ id: "e2", source: "double", target: "sub" });
    const { executor, store } = await setup(mainGraph, {
      "nodes/double.ts": `export default async (input: { n: number }) => ({ value: input.n });`,
    });
    const version = store.versions.record({
      projectSlug: "p1",
      graphHash: "child-hash",
      graph: childGraph,
      codeBundle: {},
    });
    mainGraph.nodes[mainGraph.nodes.length - 1] = {
      ...mainGraph.nodes[mainGraph.nodes.length - 1]!,
      config: { versionId: version.id },
    };
    const run = await executor.execute({ projectSlug: "p1", graph: mainGraph, payload: { n: 7 }, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toEqual({ value: "7" });
    expect(store.runs.listRecent(10).some((item) => item.parentRunId === run.id)).toBe(true);

    const cyclic = { ...mainGraph, id: "child" };
    const cyclicRun = await executor.execute({ projectSlug: "p1", graph: cyclic, payload: {}, entryPoint: "web_ui" });
    expect(cyclicRun.status).toBe("failed");
    expect(cyclicRun.error).toMatch(/subworkflow cycle/);
    store.close();
  });

  it("runs a foreach batch with bounded concurrency", async () => {
    const childGraph: WorkflowGraph = {
      version: 1,
      id: "foreach-child",
      name: "Child",
      description: "",
      nodes: [
        {
          id: "start",
          type: "trigger",
          position: { x: 0, y: 0 },
          config: { kind: "manual" },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
        {
          id: "echo",
          type: "transform",
          position: { x: 100, y: 0 },
          config: { template: '{"item":"{{input.item}}"}' },
          notebookIds: [],
          timeoutMs: 30_000,
          retryPolicy: { maxRetries: 0 },
        },
      ],
      edges: [{ id: "e1", source: "start", target: "echo" }],
      updatedAt: new Date().toISOString(),
    };
    const mainGraph = baseGraph();
    mainGraph.nodes.push({
      id: "batch",
      type: "foreach",
      position: { x: 2, y: 0 },
      config: { versionId: "placeholder", itemsPath: "items", maxConcurrency: 2, onItemError: "stop" },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    mainGraph.edges.push({ id: "e2", source: "double", target: "batch" });
    const { executor, store } = await setup(mainGraph, {
      "nodes/double.ts": `export default async (input: { items: unknown[] }) => ({ items: input.items });`,
    });
    const version = store.versions.record({
      projectSlug: "p1",
      graphHash: "foreach-child",
      graph: childGraph,
      codeBundle: {},
    });
    mainGraph.nodes[mainGraph.nodes.length - 1] = {
      ...mainGraph.nodes[mainGraph.nodes.length - 1]!,
      config: { versionId: version.id, itemsPath: "items", maxConcurrency: 2, onItemError: "stop" },
    };
    const run = await executor.execute({
      projectSlug: "p1",
      graph: mainGraph,
      payload: { items: ["a", "b", "c"] },
      entryPoint: "web_ui",
    });
    expect(run.status).toBe("succeeded");
    const result = run.output as { items: Array<{ status: string; output: unknown }> };
    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.output)).toEqual([
      { item: "a" },
      { item: "b" },
      { item: "c" },
    ]);
    store.close();
  });

  it("routes decision nodes down the matching branch", async () => {
    const graph = baseGraph();
    graph.nodes.push(
      { id: "check", type: "decision", codeFile: "nodes/check.ts", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
      { id: "yes", type: "code", codeFile: "nodes/yes.ts", position: { x: 3, y: -1 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
      { id: "no", type: "code", codeFile: "nodes/no.ts", position: { x: 3, y: 1 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
    );
    graph.edges = [
      { id: "e1", source: "start", target: "double" },
      { id: "e2", source: "double", target: "check" },
      { id: "yes", source: "check", target: "yes", condition: "true" },
      { id: "no", source: "check", target: "no", condition: "false" },
    ];
    const { executor } = await setup(graph, {
      "nodes/double.ts": `export default async () => true;`,
      "nodes/check.ts": `export default async () => true;`,
      "nodes/yes.ts": `export default async () => "branch-yes";`,
      "nodes/no.ts": `export default async () => "branch-no";`,
    });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toBe("branch-yes");
  });

  it("uses the global default model when the graph does not define one", async () => {
    const graph = baseGraph();
    graph.defaultModel = undefined;
    graph.nodes[1] = {
      ...graph.nodes[1]!,
      type: "agent",
      codeFile: undefined,
      agentId: "ventas/calificador",
    };
    const { executor, agent } = await setup(graph, {}, { defaultModel: () => "opencode-go/reasoning" });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(agent.sessions[0]?.model).toBe("opencode-go/reasoning");
  });

  it("injects grounded notebook context into agent node prompts", async () => {
    const graph = baseGraph();
    graph.nodes[1] = {
      ...graph.nodes[1]!,
      type: "agent",
      codeFile: undefined,
      agentId: "soporte/facturacion",
      notebookIds: ["manual-facturacion"],
      config: { strictGrounding: true },
    };
    const calls: Array<{ ids: string[]; strict: boolean }> = [];
    const { executor, agent } = await setup(
      graph,
      {},
      {
        knowledgeContext: async (_projectSlug, ids, _query, strict) => {
          calls.push({ ids, strict });
          return "[Fuente: Manual, Facturas]\nLas facturas se emiten el día 1.";
        },
      },
    );
    const run = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(calls).toEqual([{ ids: ["manual-facturacion"], strict: true }]);
    expect(agent.prompts[0]).toContain("[Fuente: Manual, Facturas]");
    expect(agent.prompts[0]).toContain("Nodo:");
  });

  it("executes HTTP nodes and stores their response", async () => {
    const server = Bun.serve({ port: 0, fetch: () => Response.json({ ok: true, id: 7 }) });
    try {
      const graph = baseGraph();
      graph.nodes[1] = {
        ...graph.nodes[1]!,
        type: "http",
        codeFile: undefined,
        config: { method: "GET", url: `http://127.0.0.1:${server.port}/data` },
      };
      const { executor, store } = await setup(graph, {});
      const run = await executor.execute({ projectSlug: "p1", graph, payload: { q: 1 }, entryPoint: "web_ui" });
      expect(run.status).toBe("succeeded");
      expect(run.output).toEqual({ ok: true, id: 7 });
      expect(store.runs.listSteps(run.id)[1]?.output).toEqual({ ok: true, id: 7 });
    } finally {
      server.stop();
    }
  });

  it("executes delay nodes without losing the payload", async () => {
    const graph = baseGraph();
    graph.nodes[1] = { ...graph.nodes[1]!, type: "delay", codeFile: undefined, config: { ms: 60 } };
    const { executor, store } = await setup(graph, {});
    const run = await executor.execute({ projectSlug: "p1", graph, payload: { keep: true }, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toEqual({ keep: true });
    expect(store.runs.listSteps(run.id)[1]?.durationMs).toBeGreaterThanOrEqual(50);
  });

  it("transforms data with a template", async () => {
    const graph = baseGraph();
    graph.nodes[1] = {
      ...graph.nodes[1]!,
      type: "transform",
      codeFile: undefined,
      config: { template: '{"name":"{{input.name}}","active":true}' },
    };
    const { executor } = await setup(graph, {});
    const run = await executor.execute({ projectSlug: "p1", graph, payload: { name: "Ana" }, entryPoint: "web_ui" });
    expect(run.output).toEqual({ name: "Ana", active: true });
  });

  it("evaluates visual decision conditions", async () => {
    const graph = baseGraph();
    const template = graph.nodes[1]!;
    graph.nodes = [graph.nodes[0]!];
    graph.nodes.push(
      {
        ...template,
        id: "check",
        type: "decision",
        codeFile: undefined,
        config: { mode: "condition", condition: { field: "status", operator: "equals", value: "ok" } },
      },
      { ...template, id: "yes", codeFile: "nodes/yes.ts", position: { x: 3, y: -1 } },
      { ...template, id: "no", codeFile: "nodes/no.ts", position: { x: 3, y: 1 } },
    );
    graph.edges = [
      { id: "e1", source: "start", target: "check" },
      { id: "yes", source: "check", target: "yes", condition: "true" },
      { id: "no", source: "check", target: "no", condition: "false" },
    ];
    const { executor } = await setup(graph, {
      "nodes/yes.ts": `export default async () => "branch-yes";`,
      "nodes/no.ts": `export default async () => "branch-no";`,
    });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: { status: "ok" }, entryPoint: "web_ui" });
    expect(run.output).toBe("branch-yes");
  });

  it("stores worker logs in the step checkpoint", async () => {
    const graph = baseGraph();
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async function run(input: any, ctx: any) { ctx.log("procesando", { n: input.n }); return input; }`,
    });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: { n: 2 }, entryPoint: "web_ui" });
    expect(store.runs.listSteps(run.id)[1]?.logs?.[0]?.message).toBe("procesando");
  });

  it("marks timeouts as timed_out", async () => {
    const graph = baseGraph();
    graph.nodes[1] = { ...graph.nodes[1]!, timeoutMs: 120 };
    const { executor, store } = await setup(graph, {
      "nodes/double.ts": `export default async () => { await new Promise(() => {}); };`,
    });
    const run = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(run.status).toBe("timed_out");
    expect(store.runs.listSteps(run.id).find((step) => step.nodeId === "double")?.status).toBe("timed_out");
  });

  it("replays and resumes approvals using the original workflow snapshot even after disk mutations", async () => {
    const graph = baseGraph();
    graph.nodes.push(
      { id: "review", type: "approval", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
      { id: "after", type: "code", codeFile: "nodes/after.ts", position: { x: 3, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
    );
    graph.edges.push({ id: "e2", source: "double", target: "review" }, { id: "e3", source: "review", target: "after" });
    const { executor, workspace } = await setup(graph, {
      "nodes/double.ts": `export default async () => ({ v: 1 });`,
      "nodes/after.ts": `export default async (input: { v: number }) => ({ fromSnapshot: input.v });`,
    });

    const paused = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(paused.status).toBe("paused");
    expect(paused.versionId).toBeDefined();

    // Mutate both the code file and workflow.json on disk while the run is paused
    await workspace.writeNode("p1", "nodes/after.ts", `export default async () => ({ fromSnapshot: 999 });`);
    const mutatedGraph = baseGraph();
    await workspace.writeWorkflow("p1", mutatedGraph);

    const resumed = await executor.resumeWithApproval(paused.id, "review", true, "admin");
    expect(resumed.status).toBe("succeeded");
    expect(resumed.output).toEqual({ fromSnapshot: 1 });
  });

  it("recovers interrupted running executions from their last succeeded checkpoint on startup", async () => {
    const graph = baseGraph();
    graph.nodes.push({
      id: "final",
      type: "code",
      codeFile: "nodes/final.ts",
      position: { x: 2, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 5000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e2", source: "double", target: "final" });
    const { executor, store, dir } = await setup(graph, {
      "nodes/double.ts": `export default async () => ({ step1: true });`,
      "nodes/final.ts": `export default async (input: { step1: boolean }) => ({ recovered: input.step1 });`,
    });
    const marker = join(dir, "double-ran.txt");
    const snapshot = store.versions.record({
      projectSlug: "p1",
      graphHash: computeGraphHash(graph),
      graph,
      codeBundle: {
        "nodes/double.ts": `import { appendFileSync } from "node:fs"; export default async () => { appendFileSync(${JSON.stringify(marker)}, "1"); return { step1: true }; };`,
        "nodes/final.ts": `export default async (input: { step1: boolean }) => ({ recovered: input.step1 });`,
      },
      createdBy: "system",
    });
    const now = new Date().toISOString();
    store.runs.claim({
      id: "interrupted-1",
      projectSlug: "p1",
      workflowId: graph.id,
      status: "running",
      payloadHash: computePayloadHash({}),
      input: {},
      entryPoint: "web_ui",
      graphHash: snapshot.graphHash,
      versionId: snapshot.id,
      startedAt: now,
    });
    store.runs.insertStep({
      id: "s-start",
      runId: "interrupted-1",
      nodeId: "start",
      status: "succeeded",
      input: {},
      output: {},
      durationMs: 1,
      startedAt: now,
      finishedAt: now,
    });
    store.runs.insertStep({
      id: "s-double",
      runId: "interrupted-1",
      nodeId: "double",
      status: "succeeded",
      input: {},
      output: { step1: true },
      durationMs: 5,
      startedAt: now,
      finishedAt: now,
    });

    const recovered = await executor.recoverInterruptedRuns();
    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.status).toBe("succeeded");
    expect(recovered[0]?.output).toEqual({ recovered: true });
    // `double` was already succeeded before crash, so marker file must not exist
    await expect(readFile(marker, "utf8")).rejects.toThrow();
  });

  it("parses and validates structured outputSchema from agent nodes and routes downstream decision nodes", async () => {
    const graph = baseGraph();
    graph.nodes = [
      graph.nodes[0]!,
      {
        id: "classify",
        type: "agent",
        agentId: "operaciones/clasificador",
        position: { x: 1, y: 0 },
        config: {
          outputSchema: {
            fields: [
              { name: "urgencia", type: "string", required: true },
              { name: "critico", type: "boolean", required: true },
            ],
          },
        },
        notebookIds: [],
        timeoutMs: 30000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "route",
        type: "decision",
        position: { x: 2, y: 0 },
        config: { mode: "condition", condition: { field: "critico", operator: "equals", value: true } },
        notebookIds: [],
        timeoutMs: 5000,
        retryPolicy: { maxRetries: 0 },
      },
      { id: "high", type: "code", codeFile: "nodes/high.ts", position: { x: 3, y: -1 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
      { id: "low", type: "code", codeFile: "nodes/low.ts", position: { x: 3, y: 1 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
    ];
    graph.edges = [
      { id: "e1", source: "start", target: "classify" },
      { id: "e2", source: "classify", target: "route" },
      { id: "e3", source: "route", target: "high", condition: "true" },
      { id: "e4", source: "route", target: "low", condition: "false" },
    ];
    const { executor, agent, store } = await setup(graph, {
      "nodes/high.ts": `export default async (input: { urgencia: string }) => ({ escalated: input.urgencia });`,
      "nodes/low.ts": `export default async () => ({ escalated: "none" });`,
    });
    agent.prompt = async (_sid, text) => {
      agent.prompts.push(text);
      return "```json\n{\"urgencia\":\"alta\",\"critico\":true}\n```";
    };

    const run = await executor.execute({ projectSlug: "p1", graph, payload: { ticket: "caida" }, entryPoint: "web_ui" });
    expect(run.status).toBe("succeeded");
    expect(run.output).toEqual({ escalated: "alta" });
    expect(store.runs.listSteps(run.id).find((s) => s.nodeId === "classify")?.output).toEqual({
      urgencia: "alta",
      critico: true,
    });
  });

  it("repairs malformed agent JSON once and fails if the retry still violates outputSchema", async () => {
    const graph = baseGraph();
    graph.nodes = [
      graph.nodes[0]!,
      {
        id: "classify",
        type: "agent",
        agentId: "operaciones/clasificador",
        position: { x: 1, y: 0 },
        config: {
          outputSchema: {
            fields: [{ name: "categoria", type: "string", required: true }],
          },
        },
        notebookIds: [],
        timeoutMs: 30000,
        retryPolicy: { maxRetries: 0 },
      },
      { id: "after", type: "code", codeFile: "nodes/after.ts", position: { x: 2, y: 0 }, config: {}, notebookIds: [], timeoutMs: 5000, retryPolicy: { maxRetries: 0 } },
    ];
    graph.edges = [
      { id: "e1", source: "start", target: "classify" },
      { id: "e2", source: "classify", target: "after" },
    ];
    const { executor, agent, store } = await setup(graph, {
      "nodes/after.ts": `export default async (input: { categoria: string }) => ({ ok: input.categoria });`,
    });

    let call = 0;
    agent.prompt = async (_sid, text) => {
      agent.prompts.push(text);
      call += 1;
      if (call === 1) return "texto libre sin json";
      return JSON.stringify({ categoria: "soporte" });
    };

    const repaired = await executor.execute({ projectSlug: "p1", graph, payload: {}, entryPoint: "web_ui" });
    expect(repaired.status).toBe("succeeded");
    expect(repaired.output).toEqual({ ok: "soporte" });
    expect(call).toBe(2);

    agent.prompt = async (_sid, text) => {
      agent.prompts.push(text);
      return JSON.stringify({ otro: 123 });
    };
    const failed = await executor.execute({ projectSlug: "p1", graph, payload: { retry: 2 }, entryPoint: "web_ui" });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Falta el campo categoria");
    expect(store.runs.listSteps(failed.id).some((s) => s.nodeId === "after")).toBe(false);
  });
});
