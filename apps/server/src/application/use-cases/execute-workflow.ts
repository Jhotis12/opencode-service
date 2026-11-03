import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  InputSchemaSchema,
  DatabaseNodeConfigSchema,
  NotifyNodeConfigSchema,
  SubworkflowNodeConfigSchema,
  ForeachNodeConfigSchema,
  ValidateConfigSchema,
  type InputSchema,
  type NodeSpec,
  type SseEvent,
  type WorkflowGraph,
  type WorkflowRunStatus,
} from "@platform/shared";
import { captureCodeBundle } from "./projects.ts";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { CodeWorkerPort, WorkerRpcHandlers } from "../ports/worker.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import { AgentPromptTimeoutError } from "../ports/runtime.ts";
import type { SecretVault } from "../ports/security.ts";
import type { EventBus } from "../ports/events.ts";
import type { ErrorTracker, Metrics, Logger } from "../../domain/telemetry/index.ts";
import { WorkerTimeoutError } from "../ports/worker.ts";
import type { StepRunRecord, WorkflowRunRecord } from "../../domain/entities.ts";
import type { ExecuteDatabaseActionUseCase } from "./database-actions.ts";
import type { SendNotificationUseCase } from "./send-notification.ts";
import { registerSessionContext } from "./chat-session.ts";
import {
  IdempotencyMismatchError,
  RunInFlightError,
  computeGraphHash,
  computePayloadHash,
  nextEdge,
  startNode,
  validateWorkflowGraph,
} from "../../domain/workflow/graph.ts";
import { renderParams, renderTemplate, resolvePath } from "../../domain/workflow/template.ts";
import {
  NodeValidationError,
  WorkflowInputValidationError,
  validateInputPayload,
  validateNodeRules,
} from "../../domain/workflow/input.ts";

export interface ExecutorDeps {
  store: Store;
  workspace: WorkspacePort;
  worker: CodeWorkerPort;
  agent: AgentRuntimePort;
  events: EventBus;
  metrics: Metrics;
  errors: ErrorTracker;
  logger: Logger;
  workerHandlers?: WorkerRpcHandlers;
  vault?: SecretVault;
  databaseAction?: ExecuteDatabaseActionUseCase;
  notification?: SendNotificationUseCase;
  maxConcurrentRuns?: number;
  notifyApproval?: (run: WorkflowRunRecord, nodeId: string) => Promise<void>;
  knowledgeContext?: (projectSlug: string, notebookIds: string[], query: unknown, strictGrounding: boolean) => Promise<string>;
  defaultModel?: () => string | undefined;
  projectDefaultModel?: (projectSlug: string) => string | undefined;
}

export interface ExecuteRunInput {
  projectSlug: string;
  graph: WorkflowGraph;
  payload: unknown;
  entryPoint: WorkflowRunRecord["entryPoint"];
  idempotencyKey?: string;
  approvalOverrides?: Record<string, boolean>;
  launchedBy?: string;
  integrationId?: string;
  sourceDetail?: string;
  parentRunId?: string;
}

interface RunState {
  run: WorkflowRunRecord;
  sessionId?: string;
  priorOutputs?: Map<string, unknown>;
  resumeNodeId?: string;
  codeBundle?: Record<string, string>;
}

export class ExecuteWorkflowRunUseCase {
  constructor(protected readonly deps: ExecutorDeps) {}

  async execute(input: ExecuteRunInput): Promise<WorkflowRunRecord> {
    const prepared = await this.prepare(input);
    if (!prepared.created) return prepared.run;
    return this.runGraph(input.graph, input.payload, {
      run: prepared.run,
      priorOutputs: undefined,
      resumeNodeId: undefined,
      codeBundle: prepared.codeBundle,
    }, input.approvalOverrides ?? {});
  }

  async start(input: ExecuteRunInput): Promise<WorkflowRunRecord> {
    const maxConcurrentRuns = this.deps.maxConcurrentRuns ?? 2;
    const shouldQueue = this.deps.store.runs.countInFlight(input.projectSlug) >= maxConcurrentRuns;
    const prepared = await this.prepare(input);
    if (!prepared.created) return prepared.run;
    if (shouldQueue) {
      const queuedAt = new Date().toISOString();
      this.deps.store.runs.update(prepared.run.id, { status: "queued" });
      this.deps.store.queue.enqueue({
        runId: prepared.run.id,
        projectSlug: input.projectSlug,
        createdAt: queuedAt,
      });
      this.deps.events.publish({
        type: "run.updated",
        projectSlug: prepared.run.projectSlug,
        runId: prepared.run.id,
        workflowId: prepared.run.workflowId,
        status: "queued",
      });
      this.deps.metrics.increment("workflow_runs_queued");
      this.deps.logger.info({
        event: "workflow_queued",
        entryPoint: input.entryPoint,
        projectSlug: input.projectSlug,
        runId: prepared.run.id,
        workflowId: prepared.run.workflowId,
      });
      return this.deps.store.runs.findById(prepared.run.id)!;
    }
    void this.runGraph(input.graph, input.payload, {
      run: prepared.run,
      priorOutputs: undefined,
      resumeNodeId: undefined,
      codeBundle: prepared.codeBundle,
    }, input.approvalOverrides ?? {}).catch((error) => {
      this.deps.logger.error({
        event: "workflow_background_failed",
        entryPoint: input.entryPoint,
        runId: prepared.run.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    return prepared.run;
  }

  async dispatchQueued(): Promise<WorkflowRunRecord[]> {
    const maxConcurrentRuns = this.deps.maxConcurrentRuns ?? 2;
    const started: WorkflowRunRecord[] = [];
    const projects = await this.deps.workspace.listProjects();
    for (const projectSlug of projects) {
      while (this.deps.store.runs.countInFlight(projectSlug) < maxConcurrentRuns) {
        const queued = this.deps.store.queue.claimNext(projectSlug);
        if (!queued) break;
        const run = this.deps.store.runs.findById(queued.runId);
        if (!run || run.status !== "queued") continue;
        const snapshot = await this.resolveRunSnapshot(run);
        this.deps.store.runs.update(run.id, { status: "running" });
        this.deps.events.publish({
          type: "run.updated",
          projectSlug: run.projectSlug,
          runId: run.id,
          workflowId: run.workflowId,
          status: "running",
        });
        this.deps.metrics.increment("workflow_runs_dispatched");
        this.deps.logger.info({
          event: "workflow_dispatched",
          projectSlug: run.projectSlug,
          runId: run.id,
          workflowId: run.workflowId,
        });
        const result = await this.runGraph(
          snapshot.graph,
          run.input,
          {
            run: { ...run, status: "running" },
            priorOutputs: undefined,
            resumeNodeId: undefined,
            codeBundle: snapshot.codeBundle,
          },
          {},
        );
        started.push(result);
      }
    }
    return started;
  }

  private async prepare(
    input: ExecuteRunInput,
  ): Promise<{ run: WorkflowRunRecord; created: boolean; codeBundle: Record<string, string> }> {
    validateWorkflowGraph(input.graph);
    const trigger = input.graph.nodes.find((node) => node.type === "trigger");
    const schema = InputSchemaSchema.safeParse(trigger?.config.inputSchema);
    if (schema.success) validateInputPayload(schema.data, input.payload);
    else if (trigger?.config.inputSchema !== undefined) {
      throw new WorkflowInputValidationError(["El esquema de entrada del trigger no es válido."]);
    }
    const payloadHash = computePayloadHash(input.payload);
    const graphHash = computeGraphHash(input.graph);
    const codeBundle = await captureCodeBundle(this.deps.workspace, input.projectSlug, input.graph);
    const snapshot = this.deps.store.versions.record({
      projectSlug: input.projectSlug,
      graphHash,
      graph: input.graph,
      codeBundle,
      createdBy: input.launchedBy,
    });
    const run: WorkflowRunRecord = {
      id: crypto.randomUUID(),
      projectSlug: input.projectSlug,
      workflowId: input.graph.id,
      status: "running",
      idempotencyKey: input.idempotencyKey,
      payloadHash,
      input: input.payload,
      entryPoint: input.entryPoint,
      launchedBy: input.launchedBy,
      graphHash,
      versionId: snapshot.id,
      integrationId: input.integrationId,
      sourceDetail: input.sourceDetail,
      parentRunId: input.parentRunId,
      startedAt: new Date().toISOString(),
    };
    const claimed = this.deps.store.runs.claim(run);
    if (!claimed.created) {
      if (claimed.run.payloadHash !== payloadHash) throw new IdempotencyMismatchError();
      if (claimed.run.status === "running" || claimed.run.status === "paused") throw new RunInFlightError(claimed.run.id);
      return { run: claimed.run, created: false, codeBundle };
    }
    this.deps.events.publish({
      type: "run.updated",
      projectSlug: run.projectSlug,
      runId: run.id,
      workflowId: run.workflowId,
      status: run.status,
    });
    return { run, created: true, codeBundle };
  }

  private async resolveRunSnapshot(
    run: WorkflowRunRecord,
  ): Promise<{ graph: WorkflowGraph; codeBundle: Record<string, string> }> {
    const byId = run.versionId ? this.deps.store.versions.findById(run.versionId) : undefined;
    if (byId) return { graph: byId.graph, codeBundle: byId.codeBundle };
    const byHash = run.graphHash
      ? this.deps.store.versions.findByGraphHash(run.projectSlug, run.graphHash)
      : undefined;
    if (byHash) return { graph: byHash.graph, codeBundle: byHash.codeBundle };
    const graph = await this.deps.workspace.readWorkflow(run.projectSlug);
    const codeBundle = await captureCodeBundle(this.deps.workspace, run.projectSlug, graph);
    return { graph, codeBundle };
  }

  async recoverInterruptedRuns(): Promise<WorkflowRunRecord[]> {
    const running = this.deps.store.runs.listByStatus("running");
    const recovered: WorkflowRunRecord[] = [];
    for (const run of running) {
      let snapshot: { graph: WorkflowGraph; codeBundle: Record<string, string> };
      try {
        snapshot = await this.resolveRunSnapshot(run);
      } catch (error) {
        const message = `interrupted on restart: ${error instanceof Error ? error.message : String(error)}`;
        this.deps.store.runs.update(run.id, {
          status: "failed",
          error: message,
          finishedAt: new Date().toISOString(),
        });
        recovered.push(this.deps.store.runs.findById(run.id)!);
        continue;
      }
      const steps = this.deps.store.runs.listSteps(run.id);
      const priorOutputs = new Map<string, unknown>();
      for (const step of steps) {
        if (step.status === "succeeded") priorOutputs.set(step.nodeId, step.output);
      }
      let cursor: NodeSpec | undefined = startNode(snapshot.graph);
      let resumeNodeId = cursor.id;
      const visited = new Set<string>();
      while (cursor && !visited.has(cursor.id)) {
        visited.add(cursor.id);
        if (!priorOutputs.has(cursor.id)) {
          resumeNodeId = cursor.id;
          break;
        }
        const out = priorOutputs.get(cursor.id);
        const decision =
          cursor.type === "decision"
            ? typeof out === "boolean"
              ? out
              : typeof (out as { result?: unknown })?.result === "boolean"
                ? (out as { result: boolean }).result
                : Boolean(out)
            : undefined;
        const edge = nextEdge(snapshot.graph, cursor.id, decision);
        if (!edge) {
          resumeNodeId = cursor.id;
          break;
        }
        cursor = snapshot.graph.nodes.find((node) => node.id === edge.target);
        if (cursor) resumeNodeId = cursor.id;
      }
      const result = await this.runGraph(
        snapshot.graph,
        run.input,
        {
          run: { ...run, status: "running", error: undefined, finishedAt: undefined },
          priorOutputs,
          resumeNodeId,
          codeBundle: snapshot.codeBundle,
        },
        {},
        run.entryPoint,
      );
      recovered.push(result);
    }
    return recovered;
  }

  async replay(
    runId: string,
    fromNodeId?: string,
    entryPoint: WorkflowRunRecord["entryPoint"] = "replay",
    launchedBy?: string,
  ): Promise<WorkflowRunRecord> {
    const run = this.deps.store.runs.findById(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    const snapshot = await this.resolveRunSnapshot(run);
    const graph = snapshot.graph;
    const steps = this.deps.store.runs.listSteps(runId);
    const priorOutputs = new Map<string, unknown>();
    for (const step of steps) {
      if (step.status === "succeeded") priorOutputs.set(step.nodeId, step.output);
    }
    const failed = steps.find((step) => step.status === "failed" || step.status === "timed_out");
    const resumeNodeId = fromNodeId ?? failed?.nodeId ?? graph.nodes[graph.nodes.length - 1]?.id;
    this.deps.store.runs.update(runId, {
      status: "running",
      error: undefined,
      finishedAt: undefined,
      entryPoint,
      launchedBy,
      sourceDetail: `replay:${runId}`,
    });
    this.deps.events.publish({
      type: "run.updated",
      projectSlug: run.projectSlug,
      runId,
      workflowId: run.workflowId,
      status: "running",
    });
    return this.runGraph(
      graph,
      run.input,
      {
        run: { ...run, status: "running", error: undefined, finishedAt: undefined },
        priorOutputs,
        resumeNodeId,
        codeBundle: snapshot.codeBundle,
      },
      {},
      entryPoint,
    );
  }

  async resumeWithApproval(runId: string, nodeId: string, approved: boolean, decidedBy: string): Promise<WorkflowRunRecord> {
    const run = this.deps.store.runs.findById(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    this.deps.store.runs.decideApproval(runId, nodeId, approved ? "approved" : "rejected", decidedBy);
    const snapshot = await this.resolveRunSnapshot(run);
    const graph = snapshot.graph;
    const steps = this.deps.store.runs.listSteps(runId);
    const priorOutputs = new Map<string, unknown>();
    for (const step of steps) {
      if (step.status === "succeeded") priorOutputs.set(step.nodeId, step.output);
    }
    if (!approved) {
      this.deps.store.runs.update(runId, {
        status: "failed",
        error: `approval rejected at ${nodeId}`,
        finishedAt: new Date().toISOString(),
      });
      this.deps.events.publish({
        type: "run.updated",
        projectSlug: run.projectSlug,
        runId,
        workflowId: run.workflowId,
        status: "failed",
        error: `approval rejected at ${nodeId}`,
      });
      return this.deps.store.runs.findById(runId)!;
    }
    this.deps.store.runs.update(runId, { status: "running", error: undefined, finishedAt: undefined });
    return this.runGraph(
      graph,
      run.input,
      {
        run: { ...run, status: "running", error: undefined, finishedAt: undefined },
        priorOutputs,
        resumeNodeId: nodeId,
        codeBundle: snapshot.codeBundle,
      },
      { [nodeId]: true },
    );
  }

  async resumeFromTimer(runId: string, nodeId: string): Promise<WorkflowRunRecord> {
    const run = this.deps.store.runs.findById(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    const snapshot = await this.resolveRunSnapshot(run);
    const graph = snapshot.graph;
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) throw new Error(`timer node not found: ${nodeId}`);
    const steps = this.deps.store.runs.listSteps(runId);
    const priorOutputs = new Map<string, unknown>();
    for (const step of steps) {
      if (step.status === "succeeded") priorOutputs.set(step.nodeId, step.output);
    }
    const edge = nextEdge(graph, nodeId);
    if (!edge) {
      const output = priorOutputs.get(nodeId);
      this.deps.store.runs.update(runId, {
        status: "succeeded",
        output,
        error: undefined,
        finishedAt: new Date().toISOString(),
      });
      return this.deps.store.runs.findById(runId)!;
    }
    const next = graph.nodes.find((item) => item.id === edge.target);
    if (!next) throw new Error(`edge points to missing node: ${edge.target}`);
    this.deps.store.runs.update(runId, { status: "running", error: undefined, finishedAt: undefined });
    this.deps.events.publish({
      type: "run.updated",
      projectSlug: run.projectSlug,
      runId: run.id,
      workflowId: run.workflowId,
      status: "running",
      nodeId,
      stepStatus: "succeeded",
    });
    return this.runGraph(
      graph,
      run.input,
      {
        run: { ...run, status: "running", error: undefined, finishedAt: undefined },
        priorOutputs,
        resumeNodeId: next.id,
        codeBundle: snapshot.codeBundle,
      },
      {},
    );
  }

  private workflowChain(run: WorkflowRunRecord): Set<string> {
    const chain = new Set<string>([run.workflowId]);
    let parentId = run.parentRunId;
    while (parentId) {
      const parent = this.deps.store.runs.findById(parentId);
      if (!parent) break;
      chain.add(parent.workflowId);
      parentId = parent.parentRunId;
    }
    return chain;
  }

  protected async runGraph(
    graph: WorkflowGraph,
    payload: unknown,
    state: RunState,
    approvalOverrides: Record<string, boolean>,
    entryPoint: WorkflowRunRecord["entryPoint"] = state.run.entryPoint,
  ): Promise<WorkflowRunRecord> {
    const { store, workspace, worker, agent, events, metrics, errors, logger, vault } = this.deps;
    const projectDirectory = await workspace.projectDirectory(state.run.projectSlug);
    let current = startNode(graph);
    let currentInput = payload;
    let lastOutput: unknown = payload;
    let resumed = state.resumeNodeId === undefined;
    const visited = new Set<string>();

    try {
      runLoop: while (current) {
        if (visited.has(current.id)) throw new Error(`cycle detected at ${current.id}`);
        visited.add(current.id);

        if (!resumed) {
          if (current.id === state.resumeNodeId) {
            resumed = true;
          } else {
            const priorOut = state.priorOutputs?.get(current.id);
            if (current.type !== "decision" && state.priorOutputs?.has(current.id)) {
              currentInput = priorOut;
            }
            lastOutput = priorOut ?? currentInput;
            const priorDecision =
              current.type === "decision"
                ? typeof priorOut === "boolean"
                  ? priorOut
                  : typeof (priorOut as { result?: unknown })?.result === "boolean"
                    ? (priorOut as { result: boolean }).result
                    : Boolean(priorOut)
                : undefined;
            const edge = nextEdge(graph, current.id, priorDecision);
            if (!edge) break;
            current = graph.nodes.find((node) => node.id === edge.target)!;
            continue;
          }
        }

        const startedAt = new Date().toISOString();
        const started = Date.now();
        events.publish({
          type: "run.updated",
          projectSlug: state.run.projectSlug,
          runId: state.run.id,
          workflowId: state.run.workflowId,
          status: "running",
          nodeId: current.id,
          stepStatus: "running",
        });
        let output: unknown;
        let model: string | undefined;
        let agentId: string | undefined;
        let logs: Array<{ message: string; fields: Record<string, unknown> }> | undefined;
        const retryable =
          current.type === "code" ||
          current.type === "agent" ||
          current.type === "http" ||
          current.type === "database" ||
          current.type === "notify" ||
          (current.type === "decision" && Boolean(current.codeFile) && current.config.mode !== "condition");
        let attempt = 0;
        for (;;) {
          output = undefined;
          model = undefined;
          agentId = undefined;
          logs = undefined;
          try {

        const runWorkerNode = async () => {
          const diskCodePath = join(projectDirectory, current.codeFile!);
          const snapshotCode = state.codeBundle?.[current.codeFile!];
          let tempSnapshotPath: string | undefined;
          let codePath = diskCodePath;
          if (snapshotCode !== undefined) {
            const diskCode = await readFile(diskCodePath, "utf8").catch(() => undefined);
            if (diskCode !== snapshotCode) {
              tempSnapshotPath = `${diskCodePath}.snapshot-${state.run.id}-${crypto.randomUUID()}.ts`;
              await writeFile(tempSnapshotPath, snapshotCode, "utf8");
              codePath = tempSnapshotPath;
            }
          }
          try {
            return await worker.execute({
              nodeId: current.id,
              projectSlug: state.run.projectSlug,
              codePath,
              input: currentInput,
              timeoutMs: current.timeoutMs,
              handlers: this.deps.workerHandlers,
            });
          } finally {
            if (tempSnapshotPath) await rm(tempSnapshotPath, { force: true }).catch(() => undefined);
          }
        };

        if (current.type === "trigger") {
          output = currentInput;
        } else if (current.type === "code") {
          const result = await runWorkerNode();
          output = result.output;
          logs = result.logs;
        } else if (current.type === "decision") {
          if (current.codeFile && current.config.mode !== "condition") {
            const result = await runWorkerNode();
            output = result.output;
            logs = result.logs;
          } else {
            output = evaluateCondition(current.config.condition, currentInput);
          }
        } else if (current.type === "http") {
          output = await executeHttpNode(current, currentInput, {
            projectSlug: state.run.projectSlug,
            store,
            vault,
          });
        } else if (current.type === "database") {
          if (!this.deps.databaseAction) throw new Error("database action is not configured");
          const config = DatabaseNodeConfigSchema.parse(current.config);
          output = await this.deps.databaseAction.execute({
            projectSlug: state.run.projectSlug,
            integrationId: config.integrationId,
            mode: config.mode,
            statements: config.statements.map((statement) => ({
              sql: statement.sql,
              params: renderParams(statement.params, currentInput),
            })),
            transaction: config.transaction,
            maxRows: config.maxRows,
          });
        } else if (current.type === "notify") {
          if (!this.deps.notification) throw new Error("notification action is not configured");
          const config = NotifyNodeConfigSchema.parse(current.config);
          output = await this.deps.notification.execute({
            projectSlug: state.run.projectSlug,
            integrationId: config.integrationId,
            recipient: config.recipient,
            text: config.text,
            input: currentInput,
            actionKey: config.actionKey ?? `${state.run.id}:${current.id}`,
            runId: state.run.id,
            nodeId: current.id,
          });
        } else if (current.type === "subworkflow") {
          const config = SubworkflowNodeConfigSchema.parse(current.config);
          const version = store.versions.findById(config.versionId);
          if (!version || version.projectSlug !== state.run.projectSlug) {
            throw new Error(`subworkflow version not found: ${config.versionId}`);
          }
          if (version.graph.id === state.run.workflowId) {
            throw new Error("subworkflow cycle detected");
          }
          if (this.workflowChain(state.run).has(version.graph.id)) {
            throw new Error("subworkflow cycle detected in parent chain");
          }
          const child = await this.execute({
            projectSlug: state.run.projectSlug,
            graph: version.graph,
            payload: config.payloadPath ? resolvePath(currentInput, config.payloadPath) : currentInput,
            entryPoint: state.run.entryPoint,
            parentRunId: state.run.id,
            launchedBy: "subworkflow",
            sourceDetail: `subworkflow:${config.versionId}`,
          });
          if (child.status !== "succeeded") throw new Error(`subworkflow ${child.id} ${child.status}: ${child.error ?? ""}`);
          output = child.output;
        } else if (current.type === "foreach") {
          const config = ForeachNodeConfigSchema.parse(current.config);
          const version = store.versions.findById(config.versionId);
          if (!version || version.projectSlug !== state.run.projectSlug) {
            throw new Error(`foreach version not found: ${config.versionId}`);
          }
          if (version.graph.id === state.run.workflowId) throw new Error("foreach cycle detected");
          if (this.workflowChain(state.run).has(version.graph.id)) {
            throw new Error("foreach cycle detected in parent chain");
          }
          const items = resolvePath(currentInput, config.itemsPath);
          if (!Array.isArray(items)) throw new Error(`foreach itemsPath is not an array: ${config.itemsPath}`);
          const limit = Math.max(1, Math.min(20, config.maxConcurrency));
          const results: Array<{ index: number; status: string; output?: unknown; error?: string; runId: string }> = [];
          for (let start = 0; start < items.length; start += limit) {
            const batch = items.slice(start, start + limit);
            const batchResults = await Promise.all(
              batch.map(async (item, offset) => {
                const index = start + offset;
                const child = await this.execute({
                  projectSlug: state.run.projectSlug,
                  graph: version.graph,
                  payload: { item, index, parent: currentInput },
                  entryPoint: state.run.entryPoint,
                  parentRunId: state.run.id,
                  launchedBy: "foreach",
                  sourceDetail: `foreach:${config.versionId}`,
                });
                return {
                  index,
                  status: child.status,
                  output: child.output,
                  error: child.error,
                  runId: child.id,
                };
              }),
            );
            results.push(...batchResults);
            if (config.onItemError === "stop" && batchResults.some((result) => result.status !== "succeeded")) break;
          }
          output = { items: results };
          if (config.onItemError === "stop" && results.some((result) => result.status !== "succeeded")) {
            throw new Error(`foreach failed at item ${results.find((result) => result.status !== "succeeded")?.index}`);
          }
        } else if (current.type === "delay") {
          const waitUntil =
            typeof current.config.waitUntil === "string" ? Date.parse(current.config.waitUntil) : undefined;
          const ms = Math.min(Math.max(Number(current.config.ms) || 0, 0), 60_000);
          const dueAt = new Date(
            Number.isFinite(waitUntil) && waitUntil! > Date.now() ? waitUntil! : Date.now() + ms,
          );
          if (dueAt.getTime() > Date.now() + 60_000 || current.config.waitUntil !== undefined) {
            if (dueAt.getTime() <= Date.now()) {
              output = currentInput;
            } else {
              const now = new Date().toISOString();
              store.runs.insertStep({
                id: crypto.randomUUID(),
                runId: state.run.id,
                nodeId: current.id,
                status: "succeeded",
                input: currentInput,
                output: currentInput,
                durationMs: 0,
                startedAt,
                finishedAt: now,
              });
              store.timers.create({
                id: crypto.randomUUID(),
                runId: state.run.id,
                nodeId: current.id,
                dueAt: dueAt.toISOString(),
                status: "pending",
                payload: currentInput,
                createdAt: now,
                updatedAt: now,
              });
              store.runs.update(state.run.id, { status: "paused" });
              events.publish({
                type: "run.updated",
                projectSlug: state.run.projectSlug,
                runId: state.run.id,
                workflowId: state.run.workflowId,
                status: "paused",
                nodeId: current.id,
                stepStatus: "succeeded",
              });
              return store.runs.findById(state.run.id)!;
            }
          } else {
            await new Promise((resolve) => setTimeout(resolve, ms));
            output = currentInput;
          }
        } else if (current.type === "transform") {
          output = executeTransform(current, currentInput);
        } else if (current.type === "validate") {
          const config = ValidateConfigSchema.parse(current.config);
          validateNodeRules(config, currentInput);
          output = currentInput;
        } else if (current.type === "agent") {
          agentId = current.agentId;
          const selectedModel =
            current.modelOverride ??
            graph.defaultModel ??
            this.deps.projectDefaultModel?.(state.run.projectSlug) ??
            this.deps.defaultModel?.();
          model = selectedModel;
          if (!state.sessionId) {
            const session = await agent.createSession({
              directory: projectDirectory,
              title: `${graph.name} · ${state.run.id.slice(0, 8)}`,
              agent: current.agentId,
              model: selectedModel,
            });
            state.sessionId = session.id;
            registerSessionContext(store, {
              sessionId: session.id,
              scope: "project",
              projectSlug: state.run.projectSlug,
              agentId: current.agentId,
              context: "workflow",
              runId: state.run.id,
            });
          } else {
            if (selectedModel) await agent.switchModel(state.sessionId, selectedModel);
            if (current.agentId) await agent.switchAgent(state.sessionId, current.agentId);
            registerSessionContext(store, {
              sessionId: state.sessionId,
              scope: "project",
              projectSlug: state.run.projectSlug,
              agentId: current.agentId,
              context: "workflow",
              runId: state.run.id,
            });
          }
          let prompt = buildNodePrompt(graph, current.id, currentInput);
          if (current.notebookIds.length > 0 && this.deps.knowledgeContext) {
            const context = await this.deps.knowledgeContext(
              state.run.projectSlug,
              current.notebookIds,
              currentInput,
              current.config.strictGrounding === true,
            );
            if (context) prompt = `${context}\n\n${prompt}`;
          }
          const rawReply = await agent.prompt(state.sessionId, prompt, { timeoutMs: current.timeoutMs });
          const outputSchema = InputSchemaSchema.safeParse(current.config.outputSchema);
          if (outputSchema.success && outputSchema.data.fields.length > 0) {
            try {
              output = parseAndValidateAgentOutput(rawReply, outputSchema.data);
            } catch (firstError) {
              const reason =
                firstError instanceof WorkflowInputValidationError
                  ? firstError.issues.join("; ")
                  : firstError instanceof Error
                    ? firstError.message
                    : String(firstError);
              const repairPrompt = [
                `La respuesta anterior no cumplió el esquema de salida JSON (${reason}).`,
                `Esquema de salida JSON obligatorio: ${JSON.stringify(outputSchema.data.fields)}`,
                "Devuelve ÚNICAMENTE un objeto JSON válido que cumpla todos los campos requeridos, sin texto adicional.",
              ].join("\n\n");
              const repairedReply = await agent.prompt(state.sessionId, repairPrompt);
              try {
                output = parseAndValidateAgentOutput(repairedReply, outputSchema.data);
              } catch (secondError) {
                const finalReason =
                  secondError instanceof WorkflowInputValidationError
                    ? secondError.issues.join("; ")
                    : secondError instanceof Error
                      ? secondError.message
                      : String(secondError);
                throw new NodeValidationError(`Salida estructurada inválida en ${current.id}: ${finalReason}`);
              }
            }
          } else {
            output = rawReply;
          }
        } else if (current.type === "approval") {
          const override = approvalOverrides[current.id];
          if (override === undefined && current.config.autoApprove === true) {
            const existing = store.runs.findApproval(state.run.id, current.id);
            if (!existing) {
              const now = new Date().toISOString();
              store.runs.createApproval({
                id: crypto.randomUUID(),
                runId: state.run.id,
                nodeId: current.id,
                status: "approved",
                createdAt: now,
                decidedAt: now,
                decidedBy: "autoApprove",
              });
            }
            logs = [{ message: "approval_auto_approved", fields: { nodeId: current.id } }];
            output = currentInput;
          } else if (override === undefined) {
            const existing = store.runs.findApproval(state.run.id, current.id);
            if (existing?.status !== "approved") {
              if (!existing) {
                store.runs.createApproval({
                  id: crypto.randomUUID(),
                  runId: state.run.id,
                  nodeId: current.id,
                  status: "pending",
                  createdAt: new Date().toISOString(),
                });
                store.runs.insertStep({
                  id: crypto.randomUUID(),
                  runId: state.run.id,
                  nodeId: current.id,
                  status: "running",
                  input: currentInput,
                  durationMs: 0,
                  startedAt,
                });
                store.runs.update(state.run.id, { status: "paused" });
                events.publish({
                  type: "run.updated",
                  projectSlug: state.run.projectSlug,
                  runId: state.run.id,
                  workflowId: state.run.workflowId,
                  status: "paused",
                  nodeId: current.id,
                  stepStatus: "running",
                });
                await this.deps.notifyApproval?.(state.run, current.id);
                return store.runs.findById(state.run.id)!;
              }
            }
            output = currentInput;
          } else if (!override) {
            throw new Error(`approval rejected at ${current.id}`);
          } else {
            output = currentInput;
          }
        } else {
          throw new Error(`unsupported node type: ${current.type}`);
        }
          break;
          } catch (error) {
            if (retryable && attempt < current.retryPolicy.maxRetries) {
              if (error instanceof AgentPromptTimeoutError) state.sessionId = undefined;
              attempt += 1;
              const delay = Math.min(
                (current.retryPolicy.backoffMs ?? 500) *
                  Math.pow(current.retryPolicy.backoffMultiplier ?? 2, attempt - 1),
                30_000,
              );
              logger.warn({
                event: "node_retry",
                nodeId: current.id,
                attempt,
                delayMs: delay,
                error: error instanceof Error ? error.message : String(error),
              });
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }
            const message = error instanceof Error ? error.message : String(error);
            if (current.onError?.strategy === "continue" || current.onError?.strategy === "route") {
              const errorPayload = {
                error: {
                  nodeId: current.id,
                  message,
                  attempts: attempt + 1,
                },
              };
              const failureStep: StepRunRecord = {
                id: crypto.randomUUID(),
                runId: state.run.id,
                nodeId: current.id,
                status: "failed",
                input: currentInput,
                output: errorPayload,
                model,
                agentId,
                logs,
                durationMs: Date.now() - started,
                startedAt,
                finishedAt: new Date().toISOString(),
                error: message,
              };
              store.runs.insertStep(failureStep);
              events.publish({
                type: "run.updated",
                projectSlug: state.run.projectSlug,
                runId: state.run.id,
                workflowId: state.run.workflowId,
                status: "running",
                nodeId: current.id,
                stepStatus: "failed",
                output: errorPayload,
                error: message,
              });
              lastOutput = errorPayload;
              currentInput = errorPayload;
              if (current.onError.strategy === "continue") {
                const edge = nextEdge(graph, current.id);
                if (!edge) break runLoop;
                const next = graph.nodes.find((node) => node.id === edge.target);
                if (!next) throw new Error(`edge points to missing node: ${edge.target}`);
                current = next;
              } else {
                const target = graph.nodes.find((node) => node.id === current.onError!.target);
                if (!target) throw new Error(`error route points to missing node: ${current.onError!.target}`);
                current = target;
              }
              continue runLoop;
            }
            throw error;
          }
        }

        const durationMs = Date.now() - started;
        const step: StepRunRecord = {
          id: crypto.randomUUID(),
          runId: state.run.id,
          nodeId: current.id,
          status: "succeeded",
          input: currentInput,
          output,
          model,
          agentId,
          logs,
          durationMs,
          startedAt,
          finishedAt: new Date().toISOString(),
        };
        store.runs.insertStep(step);
        events.publish({
          type: "run.updated",
          projectSlug: state.run.projectSlug,
          runId: state.run.id,
          workflowId: state.run.workflowId,
          status: "running",
          nodeId: current.id,
          stepStatus: "succeeded",
          output,
        });
        const decision =
          current.type === "decision"
            ? typeof output === "boolean"
              ? output
              : typeof (output as { result?: unknown })?.result === "boolean"
                ? (output as { result: boolean }).result
                : Boolean(output)
            : undefined;
        lastOutput = output;
        if (current.type !== "decision") {
          currentInput = output;
        }
        const edge = nextEdge(graph, current.id, decision);
        if (!edge) break;
        const next = graph.nodes.find((node) => node.id === edge.target);
        if (!next) throw new Error(`edge points to missing node: ${edge.target}`);
        current = next;
      }

      store.runs.update(state.run.id, {
        status: "succeeded",
        output: lastOutput,
        finishedAt: new Date().toISOString(),
      });
      metrics.increment("workflow_runs");
      events.publish({
        type: "run.updated",
        projectSlug: state.run.projectSlug,
        runId: state.run.id,
        workflowId: state.run.workflowId,
        status: "succeeded",
      });
      logger.info({
        event: "workflow_succeeded",
        entryPoint,
        runId: state.run.id,
        projectSlug: state.run.projectSlug,
        workflowId: state.run.workflowId,
        integrationId: state.run.integrationId,
        launchedBy: state.run.launchedBy,
      });
    } catch (error) {
      const timeout = error instanceof WorkerTimeoutError || error instanceof AgentPromptTimeoutError;
      const status: WorkflowRunStatus = timeout ? "timed_out" : "failed";
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof AgentPromptTimeoutError) state.sessionId = undefined;
      store.runs.insertStep({
        id: crypto.randomUUID(),
        runId: state.run.id,
        nodeId: current.id,
        status: timeout ? "timed_out" : "failed",
        input: currentInput,
        agentId: current.agentId,
        durationMs: 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        error: message,
      });
      store.runs.update(state.run.id, { status, error: message, finishedAt: new Date().toISOString() });
      metrics.increment("workflow_failures");
      errors.captureException(error, {
        entryPoint,
        runId: state.run.id,
        projectSlug: state.run.projectSlug,
        integrationId: state.run.integrationId,
        nodeId: current.id,
      });
      logger.error({
        event: "workflow_failed",
        entryPoint,
        runId: state.run.id,
        projectSlug: state.run.projectSlug,
        integrationId: state.run.integrationId,
        nodeId: current.id,
        error: message,
      });
      events.publish({
        type: "run.updated",
        projectSlug: state.run.projectSlug,
        runId: state.run.id,
        workflowId: state.run.workflowId,
        status,
        nodeId: current.id,
        stepStatus: timeout ? "timed_out" : "failed",
        error: message,
      });
    }
    return store.runs.findById(state.run.id)!;
  }
}

export function evaluateCondition(condition: unknown, input: unknown): boolean {
  if (!condition || typeof condition !== "object") return Boolean(input);
  const { field, operator, value } = condition as { field?: string; operator?: string; value?: unknown };
  const actual = resolvePath(input, field ?? "");
  switch (operator) {
    case "equals":
      return actual === value || String(actual) === String(value);
    case "not_equals":
      return actual !== value && String(actual) !== String(value);
    case "contains":
      return String(actual).includes(String(value));
    case "greater_than":
      return Number(actual) > Number(value);
    case "less_than":
      return Number(actual) < Number(value);
    case "exists":
      return actual !== undefined && actual !== null;
    case "truthy":
      return Boolean(actual);
    default:
      return Boolean(actual);
  }
}

export function executeTransform(node: NodeSpec, input: unknown): unknown {
  if (typeof node.config.template === "string") return renderTemplate(node.config.template, input);
  if (node.config.mapping && typeof node.config.mapping === "object") {
    return Object.fromEntries(
      Object.entries(node.config.mapping as Record<string, string>).map(([key, path]) => [
        key,
        resolvePath(input, String(path)),
      ]),
    );
  }
  return input;
}

export async function executeHttpNode(
  node: NodeSpec,
  input: unknown,
  context?: { projectSlug: string; store: Store; vault?: SecretVault },
): Promise<unknown> {
  const method = String(node.config.method ?? "GET").toUpperCase();
  let url = String(node.config.url ?? "");
  const headers =
    typeof node.config.headers === "string"
      ? (JSON.parse(node.config.headers) as Record<string, string>)
      : ((node.config.headers as Record<string, string>) ?? {});

  const resolveAlias = (alias: string): string => {
    if (!context || !context.vault) throw new Error("HTTP secrets require a project vault context");
    const secret = context.store.vault.findByAlias({
      scope: "project",
      projectSlug: context.projectSlug,
      alias,
    });
    if (!secret) throw new Error(`missing secret alias: ${alias}`);
    return context.vault.decrypt(secret.ciphertext);
  };
  const resolveSecrets = (value: unknown): unknown => {
    if (typeof value === "string") {
      const direct = /^secret:(.+)$/.exec(value);
      if (direct) return resolveAlias(direct[1]!.trim());
      return value.replace(/\{\{\s*secret\.([^}]+?)\s*\}\}/g, (_match, alias) => resolveAlias(String(alias).trim()));
    }
    if (Array.isArray(value)) return value.map((item) => resolveSecrets(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSecrets(item)]));
    }
    return value;
  };

  const integrationId = typeof node.config.integrationId === "string" ? node.config.integrationId : "";
  if (integrationId) {
    if (!context) throw new Error("HTTP integration requires a project context");
    const integration = context.store.integrations.findById(integrationId);
    if (!integration || integration.scope !== "project" || integration.projectSlug !== context.projectSlug || integration.kind !== "http") {
      throw new Error("HTTP integration does not belong to this project");
    }
    const baseUrl = String(integration.config.baseUrl ?? "").replace(/\/+$/, "");
    if (baseUrl && !/^https?:\/\//i.test(url)) {
      url = `${baseUrl}/${url.replace(/^\/+/, "")}`;
    }
  }

  const resolvedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(resolveSecrets(value))]),
  ) as Record<string, string>;
  const rawBody = node.config.body;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : typeof rawBody === "string"
        ? String(resolveSecrets(rawBody))
        : rawBody === undefined
          ? JSON.stringify(input)
          : JSON.stringify(resolveSecrets(rawBody));
  const response = await fetch(url, {
    method,
    headers: resolvedHeaders,
    body,
    signal: AbortSignal.timeout(node.timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 300)}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || /^\s*[[{]/.test(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export function parseAndValidateAgentOutput(raw: string, schema: InputSchema): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  let candidate = fenced ? fenced[1]!.trim() : trimmed;
  if (!fenced && !candidate.startsWith("{")) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) candidate = candidate.slice(start, end + 1);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new WorkflowInputValidationError(["La salida del agente no es JSON válido."]);
  }
  validateInputPayload(schema, parsed);
  return parsed as Record<string, unknown>;
}

export function buildNodePrompt(graph: WorkflowGraph, nodeId: string, input: unknown): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  const instruction = typeof node?.config.instruction === "string" ? node.config.instruction : "";
  const outputSchema = InputSchemaSchema.safeParse(node?.config.outputSchema);
  const schemaInstruction =
    outputSchema.success && outputSchema.data.fields.length > 0
      ? [
          `Esquema de salida JSON obligatorio: ${JSON.stringify(outputSchema.data.fields)}`,
          "Devuelve ÚNICAMENTE un objeto JSON válido que cumpla exactamente el esquema de salida, sin texto adicional.",
        ].join("\n")
      : "Responde de forma concisa y accionable.";
  return [
    `Flujo: ${graph.name}. Nodo: ${node?.label ?? nodeId}.`,
    instruction,
    "Entrada del nodo (JSON):",
    JSON.stringify(input ?? null, null, 2),
    schemaInstruction,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type { SseEvent };
