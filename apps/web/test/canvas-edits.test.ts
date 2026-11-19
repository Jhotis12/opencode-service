import { describe, expect, it } from "vitest";
import type { Edge, NodeSpec, NodeType, WorkflowGraph } from "@platform/shared";
import {
  changeEdgeCondition,
  connectNodes,
  getConnectionIssue,
  getGraphIssues,
  mapServerIssue,
  resolveConnection,
} from "../src/components/canvas/graph-edits.ts";

function node(id: string, type: NodeType, extra: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id,
    type,
    label: id,
    position: { x: 0, y: 0 },
    config: {},
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    ...(type === "code" ? { codeFile: `nodes/${id}.ts` } : {}),
    ...(type === "agent" ? { agentId: "ventas/calificador" } : {}),
    ...(type === "http" ? { config: { url: "https://example.com" } } : {}),
    ...(type === "delay" ? { config: { ms: 1000 } } : {}),
    ...(type === "validate" ? { config: { rules: [{ name: "tema", type: "string", required: true }] } } : {}),
    ...(type === "transform" ? { config: { template: "{}" } } : {}),
    ...(type === "decision" ? { config: { mode: "condition", condition: { field: "ok", operator: "truthy" } } } : {}),
    ...extra,
  };
}

function edge(id: string, source: string, target: string, condition?: string): Edge {
  return { id, source, target, ...(condition ? { condition } : {}) };
}

function graph(nodes: NodeSpec[], edges: Edge[]): WorkflowGraph {
  return {
    version: 1,
    id: "graph",
    name: "Graph",
    description: "",
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

describe("connection rules", () => {
  it("rejects self-loops, trigger targets, missing decision branches and cycles", () => {
    const g = graph(
      [node("start", "trigger"), node("a", "code"), node("b", "code"), node("decision", "decision")],
      [edge("e1", "start", "a"), edge("e2", "a", "b"), edge("e3", "decision", "a", "true"), edge("e4", "decision", "b", "false")],
    );
    expect(getConnectionIssue(g, "a", "a")).toMatch(/sí mismo/);
    expect(getConnectionIssue(g, "a", "start")).toMatch(/trigger/);
    expect(getConnectionIssue(g, "decision", "a")).toMatch(/rama/);
    expect(getConnectionIssue(g, "b", "a")).toMatch(/ciclo/);
  });

  it("allows merges and valid targets", () => {
    const g = graph([node("start", "trigger"), node("a", "code"), node("b", "code")], [edge("e1", "start", "a")]);
    expect(getConnectionIssue(g, "a", "b")).toBeUndefined();
    expect(getConnectionIssue(g, "start", "b")).toBeUndefined();
  });

  it("replaces the only outgoing edge of a non-decision node", () => {
    const g = graph(
      [node("start", "trigger"), node("a", "code"), node("b", "code"), node("c", "code")],
      [edge("e1", "start", "a"), edge("e2", "a", "b")],
    );
    const next = connectNodes(g, "a", "c");
    expect(next.edges.filter((item) => item.source === "a")).toHaveLength(1);
    expect(next.edges.find((item) => item.source === "a")?.target).toBe("c");
  });

  it("replaces only the selected decision branch and keeps the other", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code"), node("b", "code"), node("c", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true"), edge("e3", "d", "b", "false")],
    );
    const next = connectNodes(g, "d", "c", "true");
    expect(next.edges.find((item) => item.source === "d" && item.condition === "true")?.target).toBe("c");
    expect(next.edges.find((item) => item.source === "d" && item.condition === "false")?.target).toBe("b");
  });

  it("resolves handle-drag connections through the same validation and reports rejections", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code"), node("b", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true"), edge("e3", "d", "b", "false")],
    );
    expect(resolveConnection(g, { source: "start", target: "a" })).toEqual({
      source: "start",
      target: "a",
    });
    expect(resolveConnection(g, { source: "a", target: "a" })).toEqual({
      issue: "Un nodo no puede conectarse a sí mismo.",
    });
    expect(resolveConnection(g, { source: "d", target: "a", sourceHandle: "false" })).toEqual({
      source: "d",
      target: "a",
      condition: "false",
    });
  });
});

describe("graph issue detection", () => {
  it("returns no issues for a clean graph", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code"), node("b", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true"), edge("e3", "d", "b", "false")],
    );
    expect(getGraphIssues(g)).toEqual([]);
  });

  it("reports duplicate triggers, unreachable nodes and dangling edges", () => {
    const g = graph(
      [node("start", "trigger"), node("second", "trigger"), node("d", "decision"), node("a", "code"), node("lonely", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true"), edge("missing", "d", "ghost", "false")],
    );
    const issues = getGraphIssues(g);
    expect(issues.some((issue) => issue.nodeId === "second")).toBe(true);
    expect(issues.some((issue) => issue.edgeId === "missing")).toBe(true);
    expect(issues.some((issue) => issue.nodeId === "lonely" && /alcanzable/i.test(issue.message))).toBe(true);
  });

  it("reports incomplete decision branches", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true")],
    );
    const issues = getGraphIssues(g);
    expect(issues.some((issue) => issue.nodeId === "d" && /condición/i.test(issue.message))).toBe(true);
  });

  it("reports cycles and self-loops", () => {
    const g = graph(
      [node("start", "trigger"), node("a", "code"), node("b", "code")],
      [edge("e1", "start", "a"), edge("e2", "a", "b"), edge("e3", "b", "a")],
    );
    const issues = getGraphIssues(g);
    expect(issues.some((issue) => /ciclo/i.test(issue.message))).toBe(true);
  });
});

describe("edge condition changes", () => {
  it("rejects a condition already used by the other branch", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code"), node("b", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true"), edge("e3", "d", "b", "false")],
    );
    const result = changeEdgeCondition(g, "e2", "false");
    expect(result.issue).toMatch(/otra rama/);
    expect(result.graph).toBe(g);
  });

  it("updates a free condition", () => {
    const g = graph(
      [node("start", "trigger"), node("d", "decision"), node("a", "code")],
      [edge("e1", "start", "d"), edge("e2", "d", "a", "true")],
    );
    const result = changeEdgeCondition(g, "e2", "false");
    expect(result.issue).toBeUndefined();
    expect(result.graph.edges.find((edge) => edge.id === "e2")?.condition).toBe("false");
  });
});

describe("server issue mapping", () => {
  const g = graph([node("start", "trigger"), node("a", "code")], [edge("e1", "start", "a")]);

  it("maps node and edge ids", () => {
    expect(mapServerIssue(g, "node a has multiple outgoing edges").nodeId).toBe("a");
    expect(mapServerIssue(g, "edge e1 points to a missing node").edgeId).toBe("e1");
  });

  it("keeps unmapped messages", () => {
    const mapped = mapServerIssue(g, "workflow requires a trigger node");
    expect(mapped).toEqual({ message: "workflow requires a trigger node" });
  });
});

describe("shared graph invariants", () => {
  it("reports missing subworkflow and foreach versions", () => {
    const g = graph(
      [
        node("start", "trigger"),
        node("sub", "subworkflow"),
        node("each", "foreach", { config: { itemsPath: "input.items" } }),
      ],
      [edge("e1", "start", "sub"), edge("e2", "sub", "each")],
    );
    const issues = getGraphIssues(g);
    expect(issues.some((item) => item.nodeId === "sub" && /versión del flujo/.test(item.message))).toBe(true);
    expect(issues.some((item) => item.nodeId === "each" && /versión del flujo/.test(item.message))).toBe(true);
  });

  it("accepts subworkflow and foreach nodes with a version", () => {
    const g = graph(
      [
        node("start", "trigger"),
        node("sub", "subworkflow", { config: { versionId: "v1" } }),
        node("each", "foreach", { config: { versionId: "v1", itemsPath: "input.items" } }),
      ],
      [edge("e1", "start", "sub"), edge("e2", "sub", "each")],
    );
    expect(getGraphIssues(g)).toEqual([]);
  });

  it("reports invalid onError targets", () => {
    const g = graph(
      [
        node("start", "trigger"),
        node("fetch", "code", { onError: { strategy: "route", target: "ghost" } }),
        node("fallback", "code"),
      ],
      [edge("e1", "start", "fetch"), edge("e2", "fetch", "fallback")],
    );
    expect(getGraphIssues(g).some((item) => item.nodeId === "fetch" && /nodo que ya no existe/.test(item.message))).toBe(
      true,
    );

    const routed = graph(
      [
        node("start", "trigger"),
        node("fetch", "code", { onError: { strategy: "route", target: "fallback" } }),
        node("fallback", "code"),
      ],
      [edge("e1", "start", "fetch"), edge("e2", "fetch", "fallback")],
    );
    expect(getGraphIssues(routed)).toEqual([]);
  });

  it("rejects an invalid cron expression", () => {
    const g = graph(
      [node("start", "trigger", { config: { kind: "schedule", cron: "bad cron" } }), node("a", "code")],
      [edge("e1", "start", "a")],
    );
    expect(getGraphIssues(g).some((item) => item.nodeId === "start" && /cron válida/.test(item.message))).toBe(true);
  });

  it("reports a blank transcribe media path and accepts the default", () => {
    const blank = graph(
      [node("start", "trigger"), node("asr", "transcribe", { config: { mediaPath: "   " } })],
      [edge("e1", "start", "asr")],
    );
    expect(getGraphIssues(blank).some((item) => item.nodeId === "asr" && /ruta de audios/.test(item.message))).toBe(true);

    const withDefault = graph([node("start", "trigger"), node("asr", "transcribe")], [edge("e1", "start", "asr")]);
    expect(getGraphIssues(withDefault)).toEqual([]);
  });
});
