import { z } from "zod";
import { WorkflowGraphSchema, type WorkflowGraph } from "@platform/shared";
import { getGraphIssues } from "./components/canvas/graph-edits.ts";

export const WORKFLOW_DEFINITION_VERSION = 1;

export const WorkflowDefinitionSchema = z.object({
  version: z.literal(WORKFLOW_DEFINITION_VERSION),
  exportedAt: z.string().datetime(),
  graph: WorkflowGraphSchema,
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export interface WorkflowImportSuccess {
  ok: true;
  definition: WorkflowDefinition;
  graph: WorkflowGraph;
  stale: boolean;
}

export interface WorkflowImportFailure {
  ok: false;
  errors: string[];
}

export type WorkflowImportResult = WorkflowImportSuccess | WorkflowImportFailure;

export function buildWorkflowDefinition(graph: WorkflowGraph, exportedAt = new Date()): WorkflowDefinition {
  return {
    version: WORKFLOW_DEFINITION_VERSION,
    exportedAt: exportedAt.toISOString(),
    graph,
  };
}

export function serializeWorkflowDefinition(definition: WorkflowDefinition): string {
  return JSON.stringify(definition, null, 2);
}

export function workflowFileName(graph: WorkflowGraph): string {
  const base = graph.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "flujo"}.workflow.json`;
}

export function downloadWorkflowDefinition(definition: WorkflowDefinition, fileName: string): void {
  const blob = new Blob([serializeWorkflowDefinition(definition)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Imported flows keep the workflow id of the project they land in, so the same
 * file can move between projects without rebinding the editor to a foreign id.
 */
export function normalizeImportedGraph(imported: WorkflowGraph, current: WorkflowGraph): WorkflowGraph {
  return { ...imported, id: current.id };
}

export function isSameGraph(left: WorkflowGraph, right: WorkflowGraph): boolean {
  return stableStringify(left) === stableStringify(right);
}

function isOlder(candidate: string, current: string): boolean {
  const candidateTime = Date.parse(candidate);
  const currentTime = Date.parse(current);
  return Number.isFinite(candidateTime) && Number.isFinite(currentTime) && candidateTime < currentTime;
}

const TYPE_LABEL: Record<string, string> = {
  string: "texto",
  number: "número",
  integer: "número entero",
  boolean: "booleano",
  array: "lista",
  object: "objeto",
};

function describeIssue(issue: z.ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.map(String).join(" › ") : "archivo";
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return `${path}: se esperaba ${TYPE_LABEL[issue.expected] ?? issue.expected}.`;
    case z.ZodIssueCode.invalid_literal:
      return `${path}: valor no admitido.`;
    case z.ZodIssueCode.invalid_enum_value:
      return `${path}: valor no permitido.`;
    case z.ZodIssueCode.too_small:
      return issue.type === "array"
        ? `${path}: la lista no puede estar vacía.`
        : `${path}: el valor es demasiado corto.`;
    case z.ZodIssueCode.too_big:
      return `${path}: el valor es demasiado largo.`;
    case z.ZodIssueCode.invalid_string:
      return issue.validation === "datetime"
        ? `${path}: se esperaba una fecha ISO 8601 válida.`
        : `${path}: formato inválido.`;
    case z.ZodIssueCode.custom:
      return `${path}: ${issue.message}`;
    default:
      return `${path}: ${issue.message}`;
  }
}

function graphIssueLabel(issue: ReturnType<typeof getGraphIssues>[number]): string {
  if (issue.nodeId) return `Nodo ${issue.nodeId}: ${issue.message}`;
  if (issue.edgeId) return `Conexión ${issue.edgeId}: ${issue.message}`;
  return issue.message;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * Parse and validate a downloaded workflow file without touching editor state.
 * Every failure mode returns a Spanish error list and no graph.
 */
export function parseWorkflowDefinition(text: string, current: WorkflowGraph): WorkflowImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["El archivo no contiene JSON válido."] };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ["El archivo no contiene una definición de flujo."] };
  }

  const version = (parsed as { version?: unknown }).version;
  if (typeof version === "number" && Number.isInteger(version) && version > WORKFLOW_DEFINITION_VERSION) {
    return {
      ok: false,
      errors: [
        `El archivo usa una versión más reciente del formato (v${version}). Actualiza la plataforma para poder importarlo.`,
      ],
    };
  }
  if (version !== WORKFLOW_DEFINITION_VERSION) {
    return {
      ok: false,
      errors: ["El archivo no declara una versión de formato válida (se esperaba la versión 1)."],
    };
  }

  const result = WorkflowDefinitionSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, errors: unique(result.error.issues.map(describeIssue)) };
  }

  const graph = normalizeImportedGraph(result.data.graph, current);
  const graphIssues = getGraphIssues(graph);
  if (graphIssues.length > 0) {
    return { ok: false, errors: unique(graphIssues.map(graphIssueLabel)) };
  }

  return {
    ok: true,
    definition: result.data,
    graph,
    stale: isOlder(graph.updatedAt, current.updatedAt),
  };
}
