import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SseEvent, WorkflowGraph } from "@platform/shared";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { BunWorkerPoolAdapter } from "../src/infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import { NoopErrorTracker } from "../src/infrastructure/out/telemetry/sentry.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { AgentModelInfo, AgentRuntimePort } from "../src/application/ports/runtime.ts";
import type { EventBus } from "../src/application/ports/events.ts";
import {
  ExecuteWorkflowRunUseCase,
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
  async switchModel(_sessionId: string, model: string) { this.switchedModels.push(model); }
  async switchAgent(_sessionId: string, agent: string) { this.switchedAgents.push(agent); }
  async reloadLocation() {}
  async subscribe() { return () => undefined; }
}

class FakeEvents implements EventBus {
  events: SseEvent[] = [];
  publish(event: SseEvent) { this.events.push(event); }
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
});
