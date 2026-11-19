import { CHANNEL_EVENTS } from "./configuration.ts";
import { TriggerKindSchema, type Edge, type WorkflowGraph } from "./workflow.ts";

/**
 * Single source of truth for workflow-graph invariants.
 *
 * Both the server (`validateWorkflowGraph`) and the web canvas (`getGraphIssues`)
 * delegate here so the two can no longer drift. Issues carry stable codes plus
 * structural ids instead of prose: the server renders English messages, the
 * canvas renders Spanish ones.
 *
 * Server-only behaviour that stays out of this module: trigger config
 * normalization (`normalizeNodeConfig`), config schema validation
 * (`validateNodeConfig`, already shared) and the `WorkflowValidationError`
 * wrapper. The server also keeps its "stop at the first layer" ordering and
 * calls the traversal checks only once the per-node checks are clean.
 *
 * Canvas-only behaviour that stays out of this module: the audio-without-
 * transcribe precheck, because the executor accepts audio attachments on a
 * workflow with no transcribe node.
 */

export type GraphInvariantCode =
  | "node.duplicate-id"
  | "trigger.missing"
  | "trigger.duplicate"
  | "trigger.kind-unsupported"
  | "trigger.cron-invalid"
  | "trigger.run-at-invalid"
  | "trigger.secret-alias-missing"
  | "trigger.integration-id-missing"
  | "trigger.event-unsupported"
  | "trigger.event-duplicate"
  | "node.code-file-missing"
  | "node.agent-id-missing"
  | "node.subworkflow-version-missing"
  | "node.foreach-version-missing"
  | "node.foreach-items-path-missing"
  | "node.on-error-target-missing"
  | "node.on-error-target-self"
  | "node.on-error-target-unknown"
  | "node.on-error-target-trigger"
  | "node.delay-invalid"
  | "node.validate-rules-missing"
  | "node.transform-target-missing"
  | "node.transcribe-media-path-missing"
  | "node.decision-condition-missing"
  | "node.decision-branches"
  | "node.decision-edge-condition"
  | "node.branching"
  | "edge.duplicate-id"
  | "edge.unknown-source"
  | "edge.unknown-target"
  | "edge.self-loop"
  | "edge.target-trigger"
  | "graph.cycle"
  | "node.unreachable";

export interface GraphInvariantIssue {
  code: GraphInvariantCode;
  nodeId?: string;
  edgeId?: string;
  detail?: string;
}

export interface GraphInvariantOptions {
  strictEvents?: boolean;
}

const TRIGGER_KINDS = new Set<string>(TriggerKindSchema.options);
const SUPPORTED_CHANNEL_EVENTS = new Set<string>(Object.values(CHANNEL_EVENTS).flat());

function outgoingByNode(graph: WorkflowGraph): Map<string, Edge[]> {
  const outgoing = new Map<string, Edge[]>();
  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  }
  return outgoing;
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function getGraphInvariantIssues(
  graph: WorkflowGraph,
  options: GraphInvariantOptions = {},
): GraphInvariantIssue[] {
  const issues: GraphInvariantIssue[] = [];
  const strictEvents = options.strictEvents !== false;

  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) issues.push({ code: "node.duplicate-id", nodeId: node.id });
    ids.add(node.id);
  }

  const triggers = graph.nodes.filter((node) => node.type === "trigger");
  if (triggers.length === 0) issues.push({ code: "trigger.missing" });
  for (const trigger of triggers.slice(1)) issues.push({ code: "trigger.duplicate", nodeId: trigger.id });

  const integrationBindings = new Set<string>();
  const outgoing = outgoingByNode(graph);

  for (const node of graph.nodes) {
    const edges = outgoing.get(node.id) ?? [];

    if (node.type === "trigger") {
      const kind = String(node.config.kind ?? "manual");
      if (!TRIGGER_KINDS.has(kind)) {
        issues.push({ code: "trigger.kind-unsupported", nodeId: node.id, detail: kind });
      } else if (kind === "schedule") {
        const mode = String(node.config.mode ?? "cron");
        if (mode === "once") {
          const runAt = typeof node.config.runAt === "string" ? node.config.runAt.trim() : "";
          if (!runAt || Number.isNaN(Date.parse(runAt))) {
            issues.push({ code: "trigger.run-at-invalid", nodeId: node.id });
          }
        } else {
          const cron = typeof node.config.cron === "string" ? node.config.cron.trim() : "";
          if (!cron || !isValidCronExpression(cron)) {
            issues.push({ code: "trigger.cron-invalid", nodeId: node.id });
          }
        }
      } else if (kind === "webhook" && !isNonEmptyString(node.config.secretAlias)) {
        issues.push({ code: "trigger.secret-alias-missing", nodeId: node.id });
      }

      if (kind === "integration") {
        if (!isNonEmptyString(node.config.integrationId)) {
          issues.push({ code: "trigger.integration-id-missing", nodeId: node.id });
        }
        const event = String(node.config.event ?? "message.received");
        if (strictEvents && !SUPPORTED_CHANNEL_EVENTS.has(event)) {
          issues.push({ code: "trigger.event-unsupported", nodeId: node.id, detail: event });
        }
        const binding = `${String(node.config.integrationId ?? "")}:${event}`;
        if (integrationBindings.has(binding)) {
          issues.push({ code: "trigger.event-duplicate", nodeId: node.id, detail: binding });
        }
        integrationBindings.add(binding);
      }
    }

    if (node.type === "code" && !node.codeFile) {
      issues.push({ code: "node.code-file-missing", nodeId: node.id });
    }
    if (node.type === "agent" && !node.agentId) {
      issues.push({ code: "node.agent-id-missing", nodeId: node.id });
    }
    if (node.type === "subworkflow" && !isNonEmptyString(node.config.versionId)) {
      issues.push({ code: "node.subworkflow-version-missing", nodeId: node.id });
    }
    if (node.type === "foreach") {
      if (!isNonEmptyString(node.config.versionId)) {
        issues.push({ code: "node.foreach-version-missing", nodeId: node.id });
      }
      if (!isNonEmptyString(node.config.itemsPath)) {
        issues.push({ code: "node.foreach-items-path-missing", nodeId: node.id });
      }
    }

    if (node.onError?.strategy === "route") {
      const target = node.onError.target;
      if (!target) {
        issues.push({ code: "node.on-error-target-missing", nodeId: node.id });
      } else if (target === node.id) {
        issues.push({ code: "node.on-error-target-self", nodeId: node.id });
      } else if (!ids.has(target)) {
        issues.push({ code: "node.on-error-target-unknown", nodeId: node.id, detail: target });
      } else if (graph.nodes.find((candidate) => candidate.id === target)?.type === "trigger") {
        issues.push({ code: "node.on-error-target-trigger", nodeId: node.id });
      }
    }

    if (node.type === "delay") {
      const waitUntil = typeof node.config.waitUntil === "string" ? Date.parse(node.config.waitUntil) : Number.NaN;
      if (!(Number(node.config.ms) > 0) && Number.isNaN(waitUntil)) {
        issues.push({ code: "node.delay-invalid", nodeId: node.id });
      }
    }
    if (node.type === "validate") {
      const rules = node.config.rules;
      if (!Array.isArray(rules) || rules.length === 0) {
        issues.push({ code: "node.validate-rules-missing", nodeId: node.id });
      }
    }
    if (
      node.type === "transform" &&
      typeof node.config.template !== "string" &&
      (typeof node.config.mapping !== "object" || node.config.mapping === null)
    ) {
      issues.push({ code: "node.transform-target-missing", nodeId: node.id });
    }
    if (typeof node.config.mediaPath === "string" && node.type === "transcribe" && !node.config.mediaPath.trim()) {
      issues.push({ code: "node.transcribe-media-path-missing", nodeId: node.id });
    }

    if (node.type === "decision") {
      const hasCondition =
        typeof node.config.condition === "object" && node.config.condition !== null;
      if (!node.codeFile && !hasCondition) {
        issues.push({ code: "node.decision-condition-missing", nodeId: node.id });
      }
      const conditions = new Set(edges.map((edge) => edge.condition));
      if (edges.length !== 2 || !conditions.has("true") || !conditions.has("false")) {
        issues.push({ code: "node.decision-branches", nodeId: node.id });
      }
      for (const edge of edges) {
        if (edge.condition !== "true" && edge.condition !== "false") {
          issues.push({ code: "node.decision-edge-condition", nodeId: node.id, edgeId: edge.id });
        }
      }
    } else if (edges.length > 1) {
      issues.push({ code: "node.branching", nodeId: node.id });
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) issues.push({ code: "edge.duplicate-id", edgeId: edge.id });
    edgeIds.add(edge.id);
    if (!ids.has(edge.source)) {
      issues.push({ code: "edge.unknown-source", edgeId: edge.id, detail: edge.source });
    }
    if (!ids.has(edge.target)) {
      issues.push({ code: "edge.unknown-target", edgeId: edge.id, detail: edge.target });
    }
    if (edge.source === edge.target) {
      issues.push({ code: "edge.self-loop", edgeId: edge.id });
    }
  }

  return issues;
}

export function graphEffectiveEdges(graph: WorkflowGraph): Edge[] {
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

export function graphTopologicalOrder(graph: WorkflowGraph): string[] {
  const edges = graphEffectiveEdges(graph);
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

export function graphReachableFrom(graph: WorkflowGraph, start: string): Set<string> {
  const seen = new Set<string>();
  const stack = [start];
  const edges = graphEffectiveEdges(graph);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges.filter((item) => item.source === id)) stack.push(edge.target);
  }
  return seen;
}

export function graphNodesInCycles(graph: WorkflowGraph): string[] {
  const outgoing = new Map<string, string[]>();
  for (const edge of graphEffectiveEdges(graph)) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const inCycle = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      inCycle.add(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of outgoing.get(id) ?? []) visit(target);
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of graph.nodes) visit(node.id);
  return [...inCycle];
}

// Traversal runs over graphEffectiveEdges, so an onError route target counts as
// reachable and its back-edges count as cycles, exactly as the executor sees the
// graph. Cycles short-circuit reachability: nodes after a cycle would be
// reported twice.
export function getGraphTraversalIssues(graph: WorkflowGraph): GraphInvariantIssue[] {
  const issues: GraphInvariantIssue[] = [];
  for (const edge of graph.edges) {
    if (graph.nodes.find((node) => node.id === edge.target)?.type === "trigger") {
      issues.push({ code: "edge.target-trigger", edgeId: edge.id });
    }
  }

  const cyclic = graphNodesInCycles(graph);
  if (cyclic.length > 0) {
    for (const nodeId of cyclic) issues.push({ code: "graph.cycle", nodeId });
    return issues;
  }

  const trigger = graph.nodes.find((node) => node.type === "trigger");
  if (!trigger) return issues;

  const reachable = graphReachableFrom(graph, trigger.id);
  for (const node of graph.nodes) {
    if (!reachable.has(node.id)) {
      issues.push({ code: "node.unreachable", nodeId: node.id, detail: trigger.id });
    }
  }
  return issues;
}

// Field order: minute, hour, day of month, month, day of week.
export const CRON_FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function parseFieldToken(token: string, min: number, max: number): Set<number> | undefined {
  const [rangePart, stepPart, extra] = token.split("/");
  if (!rangePart || extra !== undefined) return undefined;
  const step = stepPart === undefined ? 1 : Number(stepPart);
  if (!Number.isInteger(step) || step <= 0) return undefined;

  let start = min;
  let end = max;
  if (rangePart !== "*") {
    if (rangePart.includes("-")) {
      const [lo, hi, more] = rangePart.split("-");
      if (!lo || !hi || more !== undefined) return undefined;
      start = Number(lo);
      end = Number(hi);
    } else {
      start = Number(rangePart);
      end = stepPart === undefined ? start : max;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return undefined;
    }
  }

  const values = new Set<number>();
  for (let current = start; current <= end; current += step) {
    values.add(max === 7 && current === 7 ? 0 : current);
  }
  return values;
}

export function parseCronField(field: string, min: number, max: number): Set<number> | undefined {
  const parts = field.split(",");
  if (parts.length === 0) return undefined;
  const result = new Set<number>();
  for (const part of parts) {
    if (!part) return undefined;
    const values = parseFieldToken(part, min, max);
    if (!values || values.size === 0) return undefined;
    for (const v of values) result.add(v);
  }
  return result;
}

export function isValidCronExpression(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, index) => {
    const [min, max] = CRON_FIELD_RANGES[index]!;
    return parseCronField(field, min, max) !== undefined;
  });
}
