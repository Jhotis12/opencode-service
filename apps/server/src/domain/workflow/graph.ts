import { createHash } from "node:crypto";
import type { Edge, NodeSpec, WorkflowGraph } from "@platform/shared";
import {
  getGraphInvariantIssues,
  getGraphTraversalIssues,
  graphReachableFrom,
  graphTopologicalOrder,
  validateNodeConfig,
  type GraphInvariantIssue,
} from "@platform/shared";

export class WorkflowValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`invalid workflow: ${issues.join("; ")}`);
    this.name = "WorkflowValidationError";
  }
}

export function normalizeNodeConfig(node: NodeSpec): void {
  if (node.type !== "trigger") return;
  const kind = String(node.config.kind ?? "manual");
  if (kind !== "integration") {
    delete node.config.integrationId;
    delete node.config.event;
    delete node.config.accepts;
  }
  if (kind !== "webhook") delete node.config.secretAlias;
  if (kind !== "schedule") {
    delete node.config.cron;
    delete node.config.mode;
    delete node.config.runAt;
    delete node.config.timezone;
    delete node.config.enabled;
    delete node.config.overlapPolicy;
    delete node.config.catchUp;
    delete node.config.catchUpWindowMinutes;
  }
}

function describeIssue(issue: GraphInvariantIssue): string {
  const id = issue.nodeId ?? issue.edgeId ?? "";
  const detail = issue.detail ?? "";
  switch (issue.code) {
    case "node.duplicate-id":
      return `duplicate node id: ${id}`;
    case "trigger.missing":
      return "workflow requires a trigger node";
    case "trigger.duplicate":
      return "workflow supports exactly one trigger node; use an integration channel to choose how it is invoked";
    case "trigger.kind-unsupported":
      return `trigger ${id} uses ${detail}, which has no active executor yet`;
    case "trigger.cron-invalid":
      return `schedule trigger ${id} requires a valid 5-field config.cron expression`;
    case "trigger.run-at-invalid":
      return `schedule trigger ${id} requires a valid config.runAt for once mode`;
    case "trigger.secret-alias-missing":
      return `webhook trigger ${id} requires config.secretAlias`;
    case "trigger.integration-id-missing":
      return `integration trigger ${id} requires config.integrationId`;
    case "trigger.event-unsupported":
      return `trigger ${id} uses unsupported event: ${detail}`;
    case "trigger.event-duplicate":
      return `duplicate trigger for integration ${detail}`;
    case "node.code-file-missing":
      return `code node ${id} requires codeFile`;
    case "node.agent-id-missing":
      return `agent node ${id} requires agentId`;
    case "node.subworkflow-version-missing":
      return `subworkflow node ${id} requires config.versionId`;
    case "node.foreach-version-missing":
      return `foreach node ${id} requires config.versionId`;
    case "node.foreach-items-path-missing":
      return `foreach node ${id} requires config.itemsPath`;
    case "node.on-error-target-missing":
      return `node ${id} requires an onError target for the route strategy`;
    case "node.on-error-target-self":
      return `node ${id} cannot route its error to itself`;
    case "node.on-error-target-unknown":
      return `node ${id} routes its error to an unknown node: ${detail}`;
    case "node.on-error-target-trigger":
      return `node ${id} cannot route its error to the trigger node`;
    case "node.delay-invalid":
      return `delay node ${id} requires a positive config.ms or a valid config.waitUntil`;
    case "node.validate-rules-missing":
      return `validate node ${id} requires config.rules`;
    case "node.transform-target-missing":
      return `transform node ${id} requires config.template or config.mapping`;
    case "node.transcribe-media-path-missing":
      return `transcribe node ${id} requires a non-empty config.mediaPath`;
    case "node.decision-condition-missing":
      return `decision node ${id} requires codeFile or config.condition`;
    case "node.decision-branches":
      return `decision node ${id} requires exactly two outgoing edges with conditions "true" and "false"`;
    case "node.decision-edge-condition":
      return `decision node ${id} has an edge ${issue.edgeId ?? ""} without a "true" or "false" condition`;
    case "node.branching":
      return `node ${id} has multiple outgoing edges; only decision nodes may branch`;
    case "edge.duplicate-id":
      return `duplicate edge id: ${id}`;
    case "edge.unknown-source":
      return `edge ${id} references unknown source: ${detail}`;
    case "edge.unknown-target":
      return `edge ${id} references unknown target: ${detail}`;
    case "edge.self-loop":
      return `edge ${id} is a self-loop`;
    case "edge.target-trigger":
      return `edge ${id} targets the trigger node, which cannot receive connections`;
    case "graph.cycle":
      return "workflow contains a cycle";
    case "node.unreachable":
      return `node ${id} is not reachable from trigger ${detail}`;
  }
}

export function validateWorkflowGraph(graph: WorkflowGraph, options: { strictEvents?: boolean } = {}): void {
  const issues: string[] = [];
  for (const node of graph.nodes) {
    normalizeNodeConfig(node);
    const parsed = validateNodeConfig(node.type, node.config);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.length > 0 ? `config.${issue.path.join(".")}` : "config";
        issues.push(`node ${node.id} has invalid ${path}: ${issue.message}`);
      }
    }
  }

  for (const invariant of getGraphInvariantIssues(graph, { strictEvents: options.strictEvents })) {
    issues.push(describeIssue(invariant));
  }

  if (issues.length === 0) {
    for (const traversal of getGraphTraversalIssues(graph)) {
      const message = describeIssue(traversal);
      if (!issues.includes(message)) issues.push(message);
    }
  }

  if (issues.length > 0) throw new WorkflowValidationError(issues);
}

export function topologicalOrder(graph: WorkflowGraph): string[] {
  return graphTopologicalOrder(graph);
}

export function reachableFrom(graph: WorkflowGraph, start: string): Set<string> {
  return graphReachableFrom(graph, start);
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
