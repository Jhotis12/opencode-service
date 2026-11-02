import { join } from "node:path";
import {
  InputSchemaSchema,
  ValidateConfigSchema,
  type NodeSpec,
  type SseEvent,
  type WorkflowGraph,
  type WorkflowRunStatus,
} from "@platform/shared";
import type { Store } from "../ports/store.ts";
import type { WorkspacePort } from "../ports/workspace.ts";
import type { CodeWorkerPort, WorkerRpcHandlers } from "../ports/worker.ts";
import type { AgentRuntimePort } from "../ports/runtime.ts";
import type { EventBus } from "../ports/events.ts";
import type { ErrorTracker, Metrics, Logger } from "../../domain/telemetry/index.ts";
import { WorkerTimeoutError } from "../ports/worker.ts";
import type { StepRunRecord, WorkflowRunRecord } from "../../domain/entities.ts";
import {
  IdempotencyMismatchError,
  RunInFlightError,
  computeGraphHash,
  computePayloadHash,
  nextEdge,
  startNode,
  validateWorkflowGraph,
} from "../../domain/workflow/graph.ts";
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
}

interface RunState {
  run: WorkflowRunRecord;
  sessionId?: string;
  priorOutputs?: Map<string, unknown>;
  resumeNodeId?: string;
}

export class ExecuteWorkflowRunUseCase {
  constructor(protected readonly deps: ExecutorDeps) {}

  async execute(input: ExecuteRunInput): Promise<WorkflowRunRecord> {
    const prepared = this.prepare(input);
    if (!prepared.created) return prepared.run;
    return this.runGraph(input.graph, input.payload, {
      run: prepared.run,
      priorOutputs: undefined,
      resumeNodeId: undefined,
    }, input.approvalOverrides ?? {});
  }

  async start(input: ExecuteRunInput): Promise<WorkflowRunRecord> {
    const prepared = this.prepare(input);
    if (!prepared.created) return prepared.run;
    void this.runGraph(input.graph, input.payload, {
      run: prepared.run,
      priorOutputs: undefined,
      resumeNodeId: undefined,
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

  private prepare(input: ExecuteRunInput): { run: WorkflowRunRecord; created: boolean } {
    validateWorkflowGraph(input.graph);
    const trigger = input.graph.nodes.find((node) => node.type === "trigger");
    const schema = InputSchemaSchema.safeParse(trigger?.config.inputSchema);
    if (schema.success) validateInputPayload(schema.data, input.payload);
    else if (trigger?.config.inputSchema !== undefined) {
      throw new WorkflowInputValidationError(["El esquema de entrada del trigger no es válido."]);
    }
    const payloadHash = computePayloadHash(input.payload);
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
      graphHash: computeGraphHash(input.graph),
      integrationId: input.integrationId,
      sourceDetail: input.sourceDetail,
      startedAt: new Date().toISOString(),
    };
    const claimed = this.deps.store.runs.claim(run);
    if (!claimed.created) {
      if (claimed.run.payloadHash !== payloadHash) throw new IdempotencyMismatchError();
      if (claimed.run.status === "running" || claimed.run.status === "paused") throw new RunInFlightError(claimed.run.id);
      return { run: claimed.run, created: false };
    }
    this.deps.events.publish({
      type: "run.updated",
      projectSlug: run.projectSlug,
      runId: run.id,
      workflowId: run.workflowId,
      status: run.status,
    });
    return { run, created: true };
  }

  async replay(
    runId: string,
    fromNodeId?: string,
    entryPoint: WorkflowRunRecord["entryPoint"] = "replay",
    launchedBy?: string,
  ): Promise<WorkflowRunRecord> {
    const run = this.deps.store.runs.findById(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    const graph = await this.deps.workspace.readWorkflow(run.projectSlug);
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
      { run: { ...run, status: "running", error: undefined, finishedAt: undefined }, priorOutputs, resumeNodeId },
      {},
      entryPoint,
    );
  }

  async resumeWithApproval(runId: string, nodeId: string, approved: boolean, decidedBy: string): Promise<WorkflowRunRecord> {
    const run = this.deps.store.runs.findById(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    this.deps.store.runs.decideApproval(runId, nodeId, approved ? "approved" : "rejected", decidedBy);
    const graph = await this.deps.workspace.readWorkflow(run.projectSlug);
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
      { run: { ...run, status: "running", error: undefined, finishedAt: undefined }, priorOutputs, resumeNodeId: nodeId },
      { [nodeId]: true },
    );
  }

  protected async runGraph(
    graph: WorkflowGraph,
    payload: unknown,
    state: RunState,
    approvalOverrides: Record<string, boolean>,
    entryPoint: WorkflowRunRecord["entryPoint"] = state.run.entryPoint,
  ): Promise<WorkflowRunRecord> {
    const { store, workspace, worker, agent, events, metrics, errors, logger } = this.deps;
    const projectDirectory = await workspace.projectDirectory(state.run.projectSlug);
    let current = startNode(graph);
    let currentInput = payload;
    let lastOutput: unknown = payload;
    let resumed = state.resumeNodeId === undefined;
    const visited = new Set<string>();

    try {
      while (current) {
        if (visited.has(current.id)) throw new Error(`cycle detected at ${current.id}`);
        visited.add(current.id);

        if (!resumed) {
          if (current.id === state.resumeNodeId) {
            resumed = true;
          } else {
            if (state.priorOutputs?.has(current.id)) currentInput = state.priorOutputs.get(current.id);
            lastOutput = currentInput;
            const edge = nextEdge(graph, current.id);
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

        const runWorkerNode = async () => {
          const codePath = join(projectDirectory, current.codeFile!);
          const maxRetries = current.retryPolicy.maxRetries;
          let attempt = 0;
          for (;;) {
            try {
              return await worker.execute({
                nodeId: current.id,
                projectSlug: state.run.projectSlug,
                codePath,
                input: currentInput,
                timeoutMs: current.timeoutMs,
                handlers: this.deps.workerHandlers,
              });
            } catch (error) {
              if (attempt >= maxRetries) throw error;
              attempt += 1;
              logger.warn({ event: "node_retry", nodeId: current.id, attempt, error: String(error) });
            }
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
          output = await executeHttpNode(current, currentInput);
        } else if (current.type === "delay") {
          const ms = Math.min(Math.max(Number(current.config.ms) || 0, 0), 60_000);
          await new Promise((resolve) => setTimeout(resolve, ms));
          output = currentInput;
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
          } else {
            if (selectedModel) await agent.switchModel(state.sessionId, selectedModel);
            if (current.agentId) await agent.switchAgent(state.sessionId, current.agentId);
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
          output = await agent.prompt(state.sessionId, prompt);
        } else if (current.type === "approval") {
          const override = approvalOverrides[current.id];
          if (override === undefined) {
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
        lastOutput = output;
        currentInput = output;

        const decision =
          current.type === "decision"
            ? typeof output === "boolean"
              ? output
              : typeof (output as { result?: unknown })?.result === "boolean"
                ? (output as { result: boolean }).result
                : Boolean(output)
            : undefined;
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
      const timeout = error instanceof WorkerTimeoutError;
      const status: WorkflowRunStatus = timeout ? "timed_out" : "failed";
      const message = error instanceof Error ? error.message : String(error);
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

export function resolvePath(input: unknown, path: string): unknown {
  const clean = path.replace(/^input\.?/, "").trim();
  if (!clean) return input;
  return clean.split(".").reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) return current[Number(key)];
    if (typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, input);
}

function templateValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

export function renderTemplate(template: string, input: unknown): unknown {
  const rendered = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, path) =>
    templateValue(resolvePath(input, String(path))),
  );
  try {
    return JSON.parse(rendered);
  } catch {
    return rendered;
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

export async function executeHttpNode(node: NodeSpec, input: unknown): Promise<unknown> {
  const method = String(node.config.method ?? "GET").toUpperCase();
  const url = String(node.config.url ?? "");
  const headers =
    typeof node.config.headers === "string"
      ? (JSON.parse(node.config.headers) as Record<string, string>)
      : ((node.config.headers as Record<string, string>) ?? {});
  const rawBody = node.config.body;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : typeof rawBody === "string"
        ? rawBody
        : JSON.stringify(rawBody ?? input);
  const response = await fetch(url, {
    method,
    headers,
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

export function buildNodePrompt(graph: WorkflowGraph, nodeId: string, input: unknown): string {
  const node = graph.nodes.find((item) => item.id === nodeId);
  const instruction = typeof node?.config.instruction === "string" ? node.config.instruction : "";
  return [
    `Flujo: ${graph.name}. Nodo: ${node?.label ?? nodeId}.`,
    instruction,
    "Entrada del nodo (JSON):",
    JSON.stringify(input ?? null, null, 2),
    "Responde de forma concisa y accionable.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type { SseEvent };
