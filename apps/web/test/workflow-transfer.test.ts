import { describe, expect, it } from "vitest";
import type { WorkflowGraph } from "@platform/shared";
import {
  buildWorkflowDefinition,
  isSameGraph,
  parseWorkflowDefinition,
  serializeWorkflowDefinition,
  workflowFileName,
} from "../src/workflow-transfer.ts";

function makeGraph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
  return {
    version: 1,
    id: "p1",
    name: "Demo",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        label: "Inicio",
        position: { x: 0, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "code",
        type: "code",
        label: "Consultar",
        codeFile: "nodes/code.ts",
        position: { x: 220, y: 0 },
        config: {},
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [{ id: "e1", source: "start", target: "code" }],
    updatedAt: "2026-11-19T00:00:00.000Z",
    ...overrides,
  };
}

function serialize(graph: WorkflowGraph): string {
  return serializeWorkflowDefinition(buildWorkflowDefinition(graph, new Date("2026-11-19T10:00:00.000Z")));
}

describe("workflow export", () => {
  it("wraps the graph in a versioned envelope with an ISO timestamp", () => {
    const definition = buildWorkflowDefinition(makeGraph(), new Date("2026-11-19T10:00:00.000Z"));

    expect(definition.version).toBe(1);
    expect(definition.exportedAt).toBe("2026-11-19T10:00:00.000Z");
    expect(definition.graph.name).toBe("Demo");
    expect(JSON.parse(serializeWorkflowDefinition(definition))).toEqual(definition);
  });

  it("builds a download file name from the workflow name", () => {
    expect(workflowFileName(makeGraph({ name: "Triaje Operativo (v2)!" }))).toBe("triaje-operativo-v2.workflow.json");
    expect(workflowFileName(makeGraph({ name: "  " }))).toBe("flujo.workflow.json");
  });
});

describe("workflow import", () => {
  it("accepts a valid envelope and reports it is not stale", () => {
    const current = makeGraph();
    const result = parseWorkflowDefinition(serialize(current), current);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stale).toBe(false);
    expect(result.graph).toEqual(current);
  });

  it("keeps the workflow id of the project receiving the import", () => {
    const current = makeGraph({ id: "target" });
    const result = parseWorkflowDefinition(serialize(makeGraph({ id: "foreign" })), current);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.id).toBe("target");
  });

  it("flags a file older than the open draft as stale", () => {
    const current = makeGraph({ updatedAt: "2026-11-19T12:00:00.000Z" });
    const result = parseWorkflowDefinition(serialize(makeGraph({ updatedAt: "2026-11-01T00:00:00.000Z" })), current);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stale).toBe(true);
  });

  it("treats importing the same file twice as idempotent", () => {
    const current = makeGraph();
    const text = serialize(current);
    const first = parseWorkflowDefinition(text, current);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = parseWorkflowDefinition(text, first.graph);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(isSameGraph(second.graph, first.graph)).toBe(true);
  });

  it("rejects malformed JSON with a Spanish message", () => {
    const result = parseWorkflowDefinition("{not json", makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(["El archivo no contiene JSON válido."]);
  });

  it("rejects a future format version before schema validation", () => {
    const parsed = JSON.parse(serialize(makeGraph())) as Record<string, unknown>;
    parsed.version = 2;
    const result = parseWorkflowDefinition(JSON.stringify(parsed), makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("v2");
    expect(result.errors.join(" ")).toContain("más reciente");
  });

  it("rejects a missing format version", () => {
    const parsed = JSON.parse(serialize(makeGraph())) as Record<string, unknown>;
    delete parsed.version;
    const result = parseWorkflowDefinition(JSON.stringify(parsed), makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("versión de formato válida");
  });

  it("rejects a bare graph without the envelope fields", () => {
    const result = parseWorkflowDefinition(JSON.stringify(makeGraph()), makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("exportedAt");
    expect(result.errors.join(" ")).toContain("graph");
  });

  it("rejects an empty node list with the schema issue", () => {
    const text = serialize(makeGraph({ nodes: [], edges: [] }));
    const result = parseWorkflowDefinition(text, makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain("graph › nodes: la lista no puede estar vacía.");
  });

  it("rejects an edge that points at a missing node using cross-field validation", () => {
    const botched = makeGraph({ edges: [{ id: "e1", source: "start", target: "missing" }] });
    const result = parseWorkflowDefinition(serialize(botched), makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain("Conexión e1: La conexión e1 apunta a un nodo inexistente.");
    expect(result.errors.some((error) => error.includes("no es alcanzable"))).toBe(true);
  });

  it("rejects a graph without a trigger", () => {
    const text = serialize(
      makeGraph({
        nodes: [
          {
            id: "code",
            type: "code",
            label: "Consultar",
            codeFile: "nodes/code.ts",
            position: { x: 0, y: 0 },
            config: {},
            notebookIds: [],
            timeoutMs: 30_000,
            retryPolicy: { maxRetries: 0 },
          },
        ],
        edges: [],
      }),
    );
    const result = parseWorkflowDefinition(text, makeGraph());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain("El flujo necesita un nodo trigger.");
  });
});
