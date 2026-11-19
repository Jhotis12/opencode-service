import { describe, expect, it } from "bun:test";
import {
  getGraphInvariantIssues,
  getGraphTraversalIssues,
  isValidCronExpression,
  type Edge,
  type NodeSpec,
  type NodeType,
  type WorkflowGraph,
} from "../src/index.ts";

function node(id: string, type: NodeType, config: Record<string, unknown> = {}, extra: Partial<NodeSpec> = {}): NodeSpec {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    config,
    notebookIds: [],
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    ...(type === "code" ? { codeFile: `nodes/${id}.ts` } : {}),
    ...extra,
  };
}

function edge(id: string, source: string, target: string, condition?: string): Edge {
  return { id, source, target, ...(condition ? { condition } : {}) };
}

function graph(nodes: NodeSpec[], edges: Edge[]): WorkflowGraph {
  return { version: 1, id: "wf", name: "WF", description: "", nodes, edges, updatedAt: new Date().toISOString() };
}

function codes(g: WorkflowGraph, options: { strictEvents?: boolean } = {}) {
  return [...getGraphInvariantIssues(g, options), ...getGraphTraversalIssues(g)];
}

describe("shared graph invariants", () => {
  it("accepts a clean graph", () => {
    const g = graph([node("start", "trigger", { kind: "manual" }), node("fetch", "code")], [edge("e1", "start", "fetch")]);
    expect(codes(g)).toEqual([]);
  });

  it("requires a version on subworkflow and foreach nodes", () => {
    const g = graph(
      [node("start", "trigger"), node("sub", "subworkflow"), node("each", "foreach", { itemsPath: "input.items" })],
      [edge("e1", "start", "sub"), edge("e2", "sub", "each")],
    );
    const issues = codes(g);
    expect(issues).toContainEqual({ code: "node.subworkflow-version-missing", nodeId: "sub" });
    expect(issues).toContainEqual({ code: "node.foreach-version-missing", nodeId: "each" });

    const withVersion = graph(
      [node("start", "trigger"), node("sub", "subworkflow", { versionId: "v1" }), node("each", "foreach", { versionId: "v1" })],
      [edge("e1", "start", "sub"), edge("e2", "sub", "each")],
    );
    expect(codes(withVersion)).toContainEqual({ code: "node.foreach-items-path-missing", nodeId: "each" });
  });

  it("rejects onError route targets that are missing, unknown, self-referencing or the trigger", () => {
    const routes = (target?: string) =>
      graph(
        [
          node("start", "trigger"),
          node("fetch", "code", {}, { onError: { strategy: "route", target } }),
          node("fallback", "code"),
        ],
        [edge("e1", "start", "fetch"), edge("e2", "fetch", "fallback")],
      );

    expect(codes(routes("ghost"))).toContainEqual({ code: "node.on-error-target-unknown", nodeId: "fetch", detail: "ghost" });
    expect(codes(routes("fetch"))).toContainEqual({ code: "node.on-error-target-self", nodeId: "fetch" });
    expect(codes(routes("start"))).toContainEqual({ code: "node.on-error-target-trigger", nodeId: "fetch" });
    expect(codes(routes())).toContainEqual({ code: "node.on-error-target-missing", nodeId: "fetch" });
    expect(codes(routes("fallback"))).toEqual([]);
  });

  it("validates cron expressions on schedule triggers", () => {
    const scheduled = (config: Record<string, unknown>) =>
      graph([node("start", "trigger", { kind: "schedule", ...config }), node("fetch", "code")], [edge("e1", "start", "fetch")]);

    expect(codes(scheduled({ cron: "0 9 * * *" }))).toEqual([]);
    expect(codes(scheduled({ cron: "bad cron" }))).toContainEqual({ code: "trigger.cron-invalid", nodeId: "start" });
    expect(codes(scheduled({ cron: "60 9 * * *" }))).toContainEqual({ code: "trigger.cron-invalid", nodeId: "start" });
    expect(codes(scheduled({ cron: "" }))).toContainEqual({ code: "trigger.cron-invalid", nodeId: "start" });
    expect(codes(scheduled({ mode: "once", runAt: "not-a-date" }))).toContainEqual({
      code: "trigger.run-at-invalid",
      nodeId: "start",
    });
  });

  it("requires a non-blank transcribe media path but accepts the default", () => {
    const transcribe = (config: Record<string, unknown>) =>
      graph([node("start", "trigger"), node("asr", "transcribe", config)], [edge("e1", "start", "asr")]);

    expect(codes(transcribe({}))).toEqual([]);
    expect(codes(transcribe({ mediaPath: "attachments" }))).toEqual([]);
    expect(codes(transcribe({ mediaPath: "   " }))).toContainEqual({
      code: "node.transcribe-media-path-missing",
      nodeId: "asr",
    });
  });

  it("reports cycles, trigger targets and unreachable nodes from the traversal pass", () => {
    const cyclic = graph([node("start", "trigger"), node("a", "code"), node("b", "code")], [
      edge("e1", "start", "a"),
      edge("e2", "a", "b"),
      edge("e3", "b", "a"),
    ]);
    expect(getGraphTraversalIssues(cyclic)).toContainEqual({ code: "graph.cycle", nodeId: "a" });

    const toTrigger = graph([node("start", "trigger"), node("a", "code")], [edge("e1", "a", "start")]);
    expect(getGraphTraversalIssues(toTrigger)).toContainEqual({ code: "edge.target-trigger", edgeId: "e1" });

    const orphan = graph([node("start", "trigger"), node("a", "code"), node("lonely", "code")], [
      edge("e1", "start", "a"),
    ]);
    expect(getGraphTraversalIssues(orphan)).toContainEqual({ code: "node.unreachable", nodeId: "lonely", detail: "start" });
  });

  it("counts onError route targets as reachable and their back-edges as cycles", () => {
    const routed = graph(
      [node("start", "trigger"), node("fetch", "code", {}, { onError: { strategy: "route", target: "fallback" } }), node("fallback", "code")],
      [edge("e1", "start", "fetch")],
    );
    expect(getGraphTraversalIssues(routed)).toEqual([]);

    const loop = graph(
      [node("start", "trigger"), node("fetch", "code", {}, { onError: { strategy: "route", target: "fallback" } }), node("fallback", "code")],
      [edge("e1", "start", "fetch"), edge("e2", "fallback", "fetch")],
    );
    expect(getGraphTraversalIssues(loop)).toContainEqual({ code: "graph.cycle", nodeId: "fetch" });
  });

  it("keeps unsupported integration events behind the strictEvents flag", () => {
    const g = graph(
      [node("start", "trigger", { kind: "integration", integrationId: "i1", event: "unsupported.event" }), node("a", "code")],
      [edge("e1", "start", "a")],
    );
    expect(getGraphInvariantIssues(g)).toContainEqual({
      code: "trigger.event-unsupported",
      nodeId: "start",
      detail: "unsupported.event",
    });
    expect(getGraphInvariantIssues(g, { strictEvents: false })).toEqual([]);
  });
});

describe("shared cron primitives", () => {
  it("accepts 5-field expressions and rejects malformed ones", () => {
    expect(isValidCronExpression("*/15 9-17 * * 1-5")).toBe(true);
    expect(isValidCronExpression("0 0 1 1 *")).toBe(true);
    expect(isValidCronExpression("60 9 * * *")).toBe(false);
    expect(isValidCronExpression("* * *")).toBe(false);
    expect(isValidCronExpression("")).toBe(false);
  });
});
