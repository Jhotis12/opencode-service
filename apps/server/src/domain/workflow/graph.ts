import { createHash } from "node:crypto";
import type { Edge, NodeSpec, WorkflowGraph } from "@platform/shared";
import { DatabaseNodeConfigSchema, NotifyNodeConfigSchema, TranscribeNodeConfigSchema } from "@platform/shared";
import { isValidCronExpression } from "./cron.ts";

export class WorkflowValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`invalid workflow: ${issues.join("; ")}`);
    this.name = "WorkflowValidationError";
  }
}

export function validateWorkflowGraph(graph: WorkflowGraph): void {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) issues.push(`duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  if (triggers.length === 0) issues.push("workflow requires a trigger node");
  if (triggers.length > 1) {
    issues.push("workflow supports exactly one trigger node; use an integration channel to choose how it is invoked");
  }

  const edgeIds = new Set<string>();
  const outgoing = new Map<string, Edge[]>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) issues.push(`duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    if (!ids.has(edge.source)) issues.push(`edge ${edge.id} references unknown source: ${edge.source}`);
    if (!ids.has(edge.target)) issues.push(`edge ${edge.id} references unknown target: ${edge.target}`);
    if (edge.source === edge.target) issues.push(`edge ${edge.id} is a self-loop`);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }

  const integrationTriggers = new Set<string>();
  for (const node of graph.nodes) {
    const edges = outgoing.get(node.id) ?? [];
    if (node.type === "trigger" && node.config.kind === "integration") {
      if (typeof node.config.integrationId !== "string" || !node.config.integrationId) {
        issues.push(`integration trigger ${node.id} requires config.integrationId`);
      }
      const event = String(node.config.event ?? "message.received");
      const binding = `${node.config.integrationId}:${event}`;
      if (integrationTriggers.has(binding)) {
        issues.push(`duplicate trigger for integration ${node.config.integrationId} and event ${event}`);
      }
      integrationTriggers.add(binding);
    }
    if (node.type === "trigger") {
      const kind = String(node.config.kind ?? "manual");
      if (!["manual", "integration", "schedule", "webhook"].includes(kind)) {
        issues.push(`trigger ${node.id} uses ${kind}, which has no active executor yet`);
      } else if (kind === "schedule") {
        const mode = String(node.config.mode ?? "cron");
        if (mode === "once") {
          const runAt = typeof node.config.runAt === "string" ? node.config.runAt.trim() : "";
          if (!runAt || Number.isNaN(Date.parse(runAt))) {
            issues.push(`schedule trigger ${node.id} requires a valid config.runAt for once mode`);
          }
        } else {
          const cron = typeof node.config.cron === "string" ? node.config.cron.trim() : "";
          if (!cron || !isValidCronExpression(cron)) {
            issues.push(`schedule trigger ${node.id} requires a valid 5-field config.cron expression`);
          }
        }
      } else if (kind === "webhook") {
        const secretAlias = typeof node.config.secretAlias === "string" ? node.config.secretAlias.trim() : "";
        if (!secretAlias) {
          issues.push(`webhook trigger ${node.id} requires config.secretAlias`);
        }
      }
    }
    if (node.type === "code" && !node.codeFile) issues.push(`code node ${node.id} requires codeFile`);
    if (node.type === "agent" && !node.agentId) issues.push(`agent node ${node.id} requires agentId`);
    if (node.type === "http" && typeof node.config.url !== "string") {
      issues.push(`http node ${node.id} requires config.url`);
    }
    if (node.type === "database") {
      const parsed = DatabaseNodeConfigSchema.safeParse(node.config);
      if (!parsed.success) {
        issues.push(`database node ${node.id} requires a valid integrationId and statements`);
      }
    }
    if (node.type === "notify") {
      const parsed = NotifyNodeConfigSchema.safeParse(node.config);
      if (!parsed.success) {
        issues.push(`notify node ${node.id} requires a valid integrationId and text`);
      }
    }
    if (node.type === "transcribe") {
      const parsed = TranscribeNodeConfigSchema.safeParse(node.config);
      if (!parsed.success) {
        issues.push(`transcribe node ${node.id} has invalid config`);
      }
    }
    if (node.type === "subworkflow" && typeof node.config.versionId !== "string") {
      issues.push(`subworkflow node ${node.id} requires config.versionId`);
    }
    if (node.type === "foreach") {
      if (typeof node.config.versionId !== "string") issues.push(`foreach node ${node.id} requires config.versionId`);
      if (typeof node.config.itemsPath !== "string") issues.push(`foreach node ${node.id} requires config.itemsPath`);
    }
    if (node.onError?.strategy === "route") {
      const target = node.onError.target;
      if (!target) {
        issues.push(`node ${node.id} requires an onError target for the route strategy`);
      } else if (target === node.id) {
        issues.push(`node ${node.id} cannot route its error to itself`);
      } else if (!ids.has(target)) {
        issues.push(`node ${node.id} routes its error to an unknown node: ${target}`);
      } else if (graph.nodes.find((candidate) => candidate.id === target)?.type === "trigger") {
        issues.push(`node ${node.id} cannot route its error to the trigger node`);
      }
    }
    if (node.type === "delay") {
      const waitUntil = typeof node.config.waitUntil === "string" ? Date.parse(node.config.waitUntil) : Number.NaN;
      if (!(Number(node.config.ms) > 0) && Number.isNaN(waitUntil)) {
        issues.push(`delay node ${node.id} requires a positive config.ms or a valid config.waitUntil`);
      }
    }
    if (node.type === "validate") {
      const rules = node.config.rules;
      if (!Array.isArray(rules) || rules.length === 0) {
        issues.push(`validate node ${node.id} requires config.rules`);
      }
    }
    if (
      node.type === "transform" &&
      typeof node.config.template !== "string" &&
      (typeof node.config.mapping !== "object" || node.config.mapping === null)
    ) {
      issues.push(`transform node ${node.id} requires config.template or config.mapping`);
    }
    if (node.type === "decision") {
      const hasCondition =
        typeof node.config.condition === "object" && node.config.condition !== null;
      if (!node.codeFile && !hasCondition) {
        issues.push(`decision node ${node.id} requires codeFile or config.condition`);
      }
      const conditions = new Set(edges.map((edge) => edge.condition));
      if (edges.length !== 2 || !conditions.has("true") || !conditions.has("false")) {
        issues.push(`decision node ${node.id} requires exactly two outgoing edges with conditions "true" and "false"`);
      }
    } else if (edges.length > 1) {
      issues.push(`node ${node.id} has multiple outgoing edges; only decision nodes may branch`);
    }
  }

  if (issues.length === 0) {
    const order = topologicalOrder(graph);
    if (order.length !== graph.nodes.length) {
      issues.push("workflow contains a cycle");
    } else {
      const start = triggers[0]!.id;
      const reachable = reachableFrom(graph, start);
      for (const node of graph.nodes) {
        if (!reachable.has(node.id)) issues.push(`node ${node.id} is not reachable from trigger ${start}`);
      }
    }
  }

  if (issues.length > 0) throw new WorkflowValidationError(issues);
}

export function topologicalOrder(graph: WorkflowGraph): string[] {
  const edges = effectiveEdges(graph);
  const indegree = new Map<string, number>();
  for (const node of graph.nodes) indegree.set(node.id, 0);
  for (const edge of edges) indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  const queue = graph.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const edge of edges.filter((item) => item.source === id)) {
      const remaining = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, remaining);
      if (remaining === 0) queue.push(edge.target);
    }
  }
  return order;
}

export function reachableFrom(graph: WorkflowGraph, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  const edges = effectiveEdges(graph);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges.filter((item) => item.source === id)) stack.push(edge.target);
  }
  return seen;
}

function effectiveEdges(graph: WorkflowGraph): Edge[] {
  const errorEdges: Edge[] = graph.nodes
    .filter((node) => node.onError?.strategy === "route" && node.onError.target)
    .map((node) => ({
      id: `error:${node.id}:${node.onError!.target}`,
      source: node.id,
      target: node.onError!.target!,
      condition: "error",
    }));
  return [...graph.edges, ...errorEdges];
}

export function startNode(graph: WorkflowGraph): NodeSpec {
  const trigger = graph.nodes.find((node) => node.type === "trigger");
  if (!trigger) throw new WorkflowValidationError(["workflow requires a trigger node"]);
  return trigger;
}

export function nextEdge(graph: WorkflowGraph, nodeId: string, decision?: boolean): Edge | undefined {
  const edges = graph.edges.filter((edge) => edge.source === nodeId);
  if (edges.length === 0) return undefined;
  if (decision === undefined) return edges[0];
  return edges.find((edge) => edge.condition === String(decision)) ?? edges[0];
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function computePayloadHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function computeGraphHash(graph: WorkflowGraph): string {
  const { updatedAt: _updatedAt, ...stable } = graph;
  return createHash("sha256").update(stableStringify(stable)).digest("hex");
}

export class IdempotencyMismatchError extends Error {
  constructor() {
    super("idempotency key reused with a different payload");
    this.name = "IdempotencyMismatchError";
  }
}

export class RunInFlightError extends Error {
  constructor(public readonly runId: string) {
    super("an execution with this idempotency key is already in flight");
    this.name = "RunInFlightError";
  }
}
