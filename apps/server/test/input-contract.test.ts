import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowGraph } from "@platform/shared";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { BunWorkerPoolAdapter } from "../src/infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import { NoopErrorTracker } from "../src/infrastructure/out/telemetry/sentry.ts";
import { ExecuteWorkflowRunUseCase } from "../src/application/use-cases/execute-workflow.ts";
import { WorkflowInputValidationError } from "../src/domain/workflow/input.ts";
import type { AgentModelInfo, AgentRuntimePort } from "../src/application/ports/runtime.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";

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

class FakeAgent implements AgentRuntimePort {
  async ensureReady() { return { url: "fake" }; }
  async health() { return { ok: true, detail: "fake" }; }
  async listModels(): Promise<AgentModelInfo[]> { return []; }
  async registerProviderKey() {}
  async createSession() { return { id: "s1" }; }
  async prompt() { return "ok"; }
  async sendPrompt() { return {}; }
  async getSession() { return undefined; }
  async listActiveSessions() { return new Set<string>(); }
  async listInbox() { return []; }
  async getMessages() { return []; }
  async getMessage() { return undefined; }
  async interrupt() {}
  async switchModel() {}
  async switchAgent() {}
  async reloadLocation() {}
  async subscribe() { return () => undefined; }
}

async function setup(graph: WorkflowGraph) {
  const dir = await mkdtemp(join(tmpdir(), "platform-input-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(dir);
  await workspace.createProject({ slug: "p1", name: "P1" });
  await workspace.writeWorkflow("p1", graph);
  await workspace.writeNode("p1", "nodes/next.ts", `export default async () => "next";`);
  const store = new SqliteStore(":memory:");
  const executor = new ExecuteWorkflowRunUseCase({
    store,
    workspace,
    worker: new BunWorkerPoolAdapter(),
    agent: new FakeAgent(),
    events: { publish() {} },
    metrics: new InMemoryMetrics(),
    errors: new NoopErrorTracker(),
    logger,
  });
  return { executor, store };
}

function graph(withSchema: boolean): WorkflowGraph {
  return {
    version: 1,
    id: "p1",
    name: "P1",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        label: "Inicio",
        position: { x: 0, y: 0 },
        config: withSchema
          ? {
              kind: "manual",
              inputSchema: {
                fields: [{ name: "tema", type: "string", required: true, message: "Falta el campo tema." }],
              },
            }
          : { kind: "manual" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "next",
        type: "code",
        label: "Siguiente",
        codeFile: "nodes/next.ts",
        position: { x: 200, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [{ id: "e1", source: "start", target: "next" }],
    updatedAt: new Date().toISOString(),
  };
}

describe("manual run input contract", () => {
  it("rejects a missing required field before creating a run", async () => {
    const { executor, store } = await setup(graph(true));
    await expect(
      executor.execute({ projectSlug: "p1", graph: graph(true), payload: {}, entryPoint: "web_ui" }),
    ).rejects.toBeInstanceOf(WorkflowInputValidationError);
    expect(store.runs.listByProject("p1", 10)).toHaveLength(0);
    store.close();
  });

  it("accepts a valid payload and completes", async () => {
    const { executor, store } = await setup(graph(true));
    const run = await executor.execute({
      projectSlug: "p1",
      graph: graph(true),
      payload: { tema: "otoño" },
      entryPoint: "web_ui",
      launchedBy: "admin",
    });
    expect(run.status).toBe("succeeded");
    expect(run.launchedBy).toBe("admin");
    expect(run.graphHash).toBeTruthy();
    store.close();
  });

  it("fails a validate node and blocks downstream nodes", async () => {
    const value = graph(false);
    value.nodes.splice(1, 0, {
      id: "guard",
      type: "validate",
      label: "Validar",
      position: { x: 100, y: 0 },
      config: { rules: [{ name: "tema", type: "string", required: true, message: "Falta el campo tema." }] },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    value.edges = [
      { id: "e1", source: "start", target: "guard" },
      { id: "e2", source: "guard", target: "next" },
    ];
    const { executor, store } = await setup(value);
    const run = await executor.execute({ projectSlug: "p1", graph: value, payload: {}, entryPoint: "web_ui" });
    expect(run.status).toBe("failed");
    expect(run.error).toContain("Falta el campo tema");
    expect(store.runs.listSteps(run.id).map((step) => step.nodeId)).toEqual(["start", "guard"]);
    store.close();
  });
});
