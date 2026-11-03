import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowGraph } from "@platform/shared";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { WorkflowScheduler } from "../src/domain/workflow/cron.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { ExecuteWorkflowRunUseCase } from "../src/application/use-cases/execute-workflow.ts";
import type { WorkflowRunRecord } from "../src/domain/entities.ts";

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

function scheduleGraph(): WorkflowGraph {
  return {
    version: 1,
    id: "wf-schedule",
    name: "Schedule",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        position: { x: 0, y: 0 },
        config: {
          kind: "schedule",
          cron: "0 9 * * *",
          timezone: "America/Mexico_City",
          enabled: false,
          overlapPolicy: "allow",
          catchUp: true,
          catchUpWindowMinutes: 120,
        },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

function tickingGraph(overrides: Record<string, unknown> = {}): WorkflowGraph {
  const graph = scheduleGraph();
  graph.nodes[0] = {
    ...graph.nodes[0]!,
    config: {
      ...graph.nodes[0]!.config,
      cron: "* * * * *",
      enabled: true,
      overlapPolicy: "skip",
      catchUp: false,
      ...overrides,
    },
  };
  return graph;
}

function fakeExecutor() {
  const runs: WorkflowRunRecord[] = [];
  const executor = {
    start: async (input: {
      projectSlug: string;
      graph: WorkflowGraph;
      payload: unknown;
    }): Promise<WorkflowRunRecord> => {
      const run: WorkflowRunRecord = {
        id: `r${runs.length + 1}`,
        projectSlug: input.projectSlug,
        workflowId: input.graph.id,
        status: "succeeded",
        payloadHash: "hash",
        input: input.payload,
        entryPoint: "schedule",
        startedAt: new Date().toISOString(),
      };
      runs.push(run);
      return run;
    },
    dispatchQueued: async () => [],
    resumeFromTimer: async () => undefined,
  } as unknown as ExecuteWorkflowRunUseCase;
  return { executor, runs };
}

async function setupScheduler(graph: WorkflowGraph) {
  const dir = await mkdtemp(join(tmpdir(), "platform-scheduler-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(dir);
  await workspace.createProject({ slug: "p1", name: "P1" });
  await workspace.writeWorkflow("p1", graph);
  const store = new SqliteStore(":memory:");
  const fake = fakeExecutor();
  const scheduler = new WorkflowScheduler({ store, workspace, executor: fake.executor, logger: silentLogger });
  return { store, workspace, scheduler, ...fake };
}

describe("workflow scheduler state", () => {
  it("backfills schedule state and preserves the last window", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-scheduler-"));
    dirs.push(dir);
    const workspace = new SafeFsWorkspaceAdapter(dir);
    await workspace.createProject({ slug: "p1", name: "P1" });
    await workspace.writeWorkflow("p1", scheduleGraph());
    const store = new SqliteStore(":memory:");
    const scheduler = new WorkflowScheduler({
      store,
      workspace,
      executor: {} as never,
      logger: silentLogger,
    });
    const now = new Date("2026-01-15T14:00:00.000Z");
    await scheduler.syncFromWorkspaces(now);
    const state = store.scheduleStates.find({ projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" });
    expect(state).toMatchObject({
      timezone: "America/Mexico_City",
      enabled: false,
      overlapPolicy: "allow",
      catchUp: true,
      catchUpWindowMinutes: 120,
    });
    expect(state?.nextWindowAt).toBeTruthy();

    store.scheduleStates.update(
      { projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" },
      { lastWindowAt: now.toISOString() },
    );
    await scheduler.syncFromWorkspaces(new Date("2026-01-16T14:00:00.000Z"));
    expect(
      store.scheduleStates.find({ projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" })?.lastWindowAt,
    ).toBe(now.toISOString());
    store.close();
  });

  it("fires once per window, skips overlap and respects disabled schedules", async () => {
    const { scheduler, store, runs } = await setupScheduler(tickingGraph());
    const now = new Date("2026-11-02T10:00:00.000Z");
    await scheduler.syncFromWorkspaces(now);
    expect(await scheduler.tick(now)).toHaveLength(1);
    expect(await scheduler.tick(now)).toHaveLength(0);

    store.runs.claim({
      id: "inflight",
      projectSlug: "p1",
      workflowId: "wf-schedule",
      status: "running",
      payloadHash: "hash",
      input: {},
      entryPoint: "schedule",
      startedAt: now.toISOString(),
    });
    const nextMinute = new Date(now.getTime() + 60_000);
    expect(await scheduler.tick(nextMinute)).toHaveLength(0);
    expect(runs).toHaveLength(1);
    expect(
      store.scheduleStates.find({ projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" })?.lastWindowAt,
    ).toBe(nextMinute.toISOString());

    store.scheduleStates.update(
      { projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" },
      { enabled: false },
    );
    expect(await scheduler.tick(new Date(now.getTime() + 120_000))).toHaveLength(0);
    store.close();
  });

  it("fires a one-off schedule exactly once", async () => {
    const now = new Date("2026-11-02T10:00:00.000Z");
    const { scheduler, store, runs } = await setupScheduler(
      tickingGraph({ mode: "once", runAt: new Date(now.getTime() - 60_000).toISOString() }),
    );
    await scheduler.syncFromWorkspaces(now);
    expect(await scheduler.tick(now)).toHaveLength(1);
    expect(await scheduler.tick(new Date(now.getTime() + 60_000))).toHaveLength(0);
    expect(runs).toHaveLength(1);
    store.close();
  });

  it("catches up missed windows within the configured limit", async () => {
    const { scheduler, store, runs } = await setupScheduler(
      tickingGraph({ catchUp: true, catchUpWindowMinutes: 10, overlapPolicy: "allow" }),
    );
    const now = new Date("2026-11-02T10:00:00.000Z");
    await scheduler.syncFromWorkspaces(now);
    store.scheduleStates.update(
      { projectSlug: "p1", workflowId: "wf-schedule", nodeId: "start" },
      { lastWindowAt: new Date(now.getTime() - 5 * 60_000).toISOString(), catchUp: true },
    );
    expect(await scheduler.tick(now)).toHaveLength(5);
    expect(runs).toHaveLength(5);
    store.close();
  });
});
