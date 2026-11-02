import { describe, expect, it } from "bun:test";
import type { WorkflowGraph } from "@platform/shared";
import {
  IdempotencyMismatchError,
  WorkflowValidationError,
  computePayloadHash,
  nextEdge,
  reachableFrom,
  startNode,
  topologicalOrder,
  validateWorkflowGraph,
} from "../src/domain/workflow/graph.ts";

function graph(overrides: Partial<WorkflowGraph> = {}): WorkflowGraph {
  return {
    version: 1,
    id: "wf",
    name: "Demo",
    description: "",
    nodes: [
      { id: "start", type: "trigger", position: { x: 0, y: 0 }, config: { kind: "manual" }, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
      { id: "fetch", type: "code", codeFile: "nodes/fetch.ts", position: { x: 1, y: 0 }, config: {}, notebookIds: [], timeoutMs: 30000, retryPolicy: { maxRetries: 0 } },
    ],
    edges: [{ id: "e1", source: "start", target: "fetch" }],
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("workflow graph validation", () => {
  it("accepts a valid linear graph", () => {
    expect(() => validateWorkflowGraph(graph())).not.toThrow();
  });

  it("requires exactly one trigger and rejects trigger types without an executor", () => {
    const multiple = graph();
    multiple.nodes.push({
      id: "second-trigger",
      type: "trigger",
      position: { x: 0, y: 1 },
      config: { kind: "manual" },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    expect(() => validateWorkflowGraph(multiple)).toThrow(/exactly one trigger/);

    const scheduled = graph();
    scheduled.nodes[0] = { ...scheduled.nodes[0]!, config: { kind: "schedule", cron: "0 9 * * *" } };
    expect(() => validateWorkflowGraph(scheduled)).toThrow(/no active executor/);
  });

  it("rejects duplicate node ids", () => {
    const bad = graph();
    bad.nodes.push({ ...bad.nodes[1]!, position: { x: 2, y: 0 } });
    expect(() => validateWorkflowGraph(bad)).toThrow(WorkflowValidationError);
  });

  it("rejects edges to unknown nodes", () => {
    const bad = graph();
    bad.edges.push({ id: "e2", source: "fetch", target: "ghost" });
    expect(() => validateWorkflowGraph(bad)).toThrow(/unknown target/);
  });

  it("rejects cycles", () => {
    const bad = graph();
    bad.edges.push({ id: "e2", source: "fetch", target: "start" });
    expect(() => validateWorkflowGraph(bad)).toThrow(/cycle/);
  });

  it("requires codeFile on code nodes", () => {
    const bad = graph();
    bad.nodes[1] = { ...bad.nodes[1]!, codeFile: undefined };
    expect(() => validateWorkflowGraph(bad)).toThrow(/codeFile/);
  });

  it("requires agentId on agent nodes", () => {
    const bad = graph();
    bad.nodes[1] = { ...bad.nodes[1]!, type: "agent" };
    expect(() => validateWorkflowGraph(bad)).toThrow(/agentId/);
  });

  it("validates http, delay and transform nodes", () => {
    const http = graph();
    http.nodes[1] = { ...http.nodes[1]!, type: "http", codeFile: undefined, config: {} };
    expect(() => validateWorkflowGraph(http)).toThrow(/config.url/);

    const delay = graph();
    delay.nodes[1] = { ...delay.nodes[1]!, type: "delay", codeFile: undefined, config: {} };
    expect(() => validateWorkflowGraph(delay)).toThrow(/config.ms/);

    const transform = graph();
    transform.nodes[1] = { ...transform.nodes[1]!, type: "transform", codeFile: undefined, config: {} };
    expect(() => validateWorkflowGraph(transform)).toThrow(/config.template/);
  });

  it("accepts a visual decision condition without code", () => {
    const branching = graph();
    const template = branching.nodes[1]!;
    branching.nodes = [branching.nodes[0]!];
    branching.nodes.push(
      { ...template, id: "check", type: "decision", codeFile: undefined, config: { mode: "condition", condition: { field: "status", operator: "equals", value: "ok" } } },
      { ...template, id: "yes", position: { x: 3, y: -1 } },
      { ...template, id: "no", position: { x: 3, y: 1 } },
    );
    branching.edges = [
      { id: "e1", source: "start", target: "check" },
      { id: "yes", source: "check", target: "yes", condition: "true" },
      { id: "no", source: "check", target: "no", condition: "false" },
    ];
    expect(() => validateWorkflowGraph(branching)).not.toThrow();
  });

  it("requires decision nodes to have true/false branches", () => {
    const bad = graph();
    bad.nodes.push({
      id: "check",
      type: "decision",
      codeFile: "nodes/check.ts",
      position: { x: 2, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30000,
      retryPolicy: { maxRetries: 0 },
    });
    bad.edges = [{ id: "e1", source: "start", target: "check" }];
    expect(() => validateWorkflowGraph(bad)).toThrow(/true.*false|two outgoing/);
  });

  it("rejects unreachable nodes", () => {
    const bad = graph();
    bad.nodes.push({
      id: "orphan",
      type: "code",
      codeFile: "nodes/orphan.ts",
      position: { x: 3, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30000,
      retryPolicy: { maxRetries: 0 },
    });
    expect(() => validateWorkflowGraph(bad)).toThrow(/not reachable/);
  });
});

describe("graph helpers", () => {
  it("orders nodes topologically and finds the start", () => {
    expect(topologicalOrder(graph())).toEqual(["start", "fetch"]);
    expect(startNode(graph()).id).toBe("start");
    expect(reachableFrom(graph(), "start")).toEqual(new Set(["start", "fetch"]));
  });

  it("chooses decision edges by condition", () => {
    const branching = graph();
    branching.nodes.push({
      id: "check",
      type: "decision",
      codeFile: "nodes/check.ts",
      position: { x: 2, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30000,
      retryPolicy: { maxRetries: 0 },
    });
    branching.edges = [
      { id: "e1", source: "start", target: "check" },
      { id: "yes", source: "check", target: "fetch", condition: "true" },
      { id: "no", source: "check", target: "check", condition: "false" },
    ];
    expect(nextEdge(branching, "check", true)?.id).toBe("yes");
  });

  it("hashes payloads deterministically regardless of key order", () => {
    expect(computePayloadHash({ a: 1, b: 2 })).toBe(computePayloadHash({ b: 2, a: 1 }));
    expect(computePayloadHash({ a: 1 })).not.toBe(computePayloadHash({ a: 2 }));
  });

  it("exposes typed errors", () => {
    expect(new IdempotencyMismatchError().name).toBe("IdempotencyMismatchError");
  });
});
