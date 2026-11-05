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
import { isValidCronExpression, matchesCron, matchesCronInTimeZone, cronWindowsBetween, nextCronDate } from "../src/domain/workflow/cron.ts";

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
    expect(() => validateWorkflowGraph(scheduled)).not.toThrow();

    const badSchedule = graph();
    badSchedule.nodes[0] = { ...badSchedule.nodes[0]!, config: { kind: "schedule", cron: "bad cron" } };
    expect(() => validateWorkflowGraph(badSchedule)).toThrow(/config.cron/);

    const webhook = graph();
    webhook.nodes[0] = { ...webhook.nodes[0]!, config: { kind: "webhook", secretAlias: "wh-secret" } };
    expect(() => validateWorkflowGraph(webhook)).not.toThrow();

    const badWebhook = graph();
    badWebhook.nodes[0] = { ...badWebhook.nodes[0]!, config: { kind: "webhook" } };
    expect(() => validateWorkflowGraph(badWebhook)).toThrow(/config.secretAlias/);

    const unknownKind = graph();
    unknownKind.nodes[0] = { ...unknownKind.nodes[0]!, config: { kind: "legacy_queue" } };
    expect(() => validateWorkflowGraph(unknownKind)).toThrow(/no active executor/);
  });

  it("validates integration trigger events and normalizes stale trigger config", () => {
    const unsupported = graph();
    unsupported.nodes[0] = {
      ...unsupported.nodes[0]!,
      config: { kind: "integration", integrationId: "tg-1", event: "unsupported.event" },
    };
    expect(() => validateWorkflowGraph(unsupported)).toThrow(/unsupported event/);

    const manual = graph();
    manual.nodes[0] = {
      ...manual.nodes[0]!,
      config: { kind: "manual", integrationId: "tg-1", event: "message.received" },
    };
    expect(() => validateWorkflowGraph(manual)).not.toThrow();
    expect(manual.nodes[0]!.config.integrationId).toBeUndefined();
    expect(manual.nodes[0]!.config.event).toBeUndefined();
  });

  it("validates node configs through the shared registry", () => {
    const badNotify = graph();
    badNotify.nodes[1] = { ...badNotify.nodes[1]!, type: "notify", codeFile: undefined, config: {} };
    expect(() => validateWorkflowGraph(badNotify)).toThrow(/config\.integrationId/);

    const badDatabase = graph();
    badDatabase.nodes[1] = { ...badDatabase.nodes[1]!, type: "database", codeFile: undefined, config: {} };
    expect(() => validateWorkflowGraph(badDatabase)).toThrow(/config\.integrationId/);
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

  it("validates error routes and rejects unknown, self and cyclic targets", () => {
    const routed = graph();
    routed.nodes.push({
      id: "fallback",
      type: "code",
      codeFile: "nodes/fallback.ts",
      position: { x: 2, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    routed.nodes[1] = { ...routed.nodes[1]!, onError: { strategy: "route", target: "fallback" } };
    expect(() => validateWorkflowGraph(routed)).not.toThrow();

    const unknown = graph();
    unknown.nodes[1] = { ...unknown.nodes[1]!, onError: { strategy: "route", target: "ghost" } };
    expect(() => validateWorkflowGraph(unknown)).toThrow(/unknown node/);

    const self = graph();
    self.nodes[1] = { ...self.nodes[1]!, onError: { strategy: "route", target: "fetch" } };
    expect(() => validateWorkflowGraph(self)).toThrow(/itself/);

    const cyclic = graph();
    cyclic.nodes.push({
      id: "fallback",
      type: "code",
      codeFile: "nodes/fallback.ts",
      position: { x: 2, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    cyclic.nodes[1] = { ...cyclic.nodes[1]!, onError: { strategy: "route", target: "fallback" } };
    cyclic.edges.push({ id: "e2", source: "fallback", target: "fetch" });
    expect(() => validateWorkflowGraph(cyclic)).toThrow(/cycle/);
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

  it("validates and matches 5-field cron expressions", () => {
    expect(isValidCronExpression("*/15 9-17 * * 1-5")).toBe(true);
    expect(isValidCronExpression("60 9 * * *")).toBe(false);
    expect(isValidCronExpression("* * *")).toBe(false);
    const monday915 = new Date("2026-11-02T09:15:00.000Z"); // 2026-11-02 is Monday
    expect(matchesCron("*/15 9-17 * * 1-5", monday915)).toBe(true);
    expect(matchesCron("0 9 * * 1-5", monday915)).toBe(false);
  });

  it("matches schedules in an IANA timezone across DST", () => {
    const newYork = "America/New_York";
    expect(matchesCronInTimeZone("0 9 * * *", new Date("2026-01-15T14:00:00.000Z"), newYork)).toBe(true);
    expect(matchesCronInTimeZone("0 9 * * *", new Date("2026-07-15T13:00:00.000Z"), newYork)).toBe(true);
    expect(matchesCronInTimeZone("0 9 * * *", new Date("2026-07-15T14:00:00.000Z"), newYork)).toBe(false);

    const repeated = cronWindowsBetween(
      "30 1 * * *",
      new Date("2026-11-01T05:00:00.000Z"),
      new Date("2026-11-01T07:00:00.000Z"),
      newYork,
    );
    expect(repeated).toHaveLength(1);

    const skipped = cronWindowsBetween(
      "30 2 * * *",
      new Date("2026-03-08T06:00:00.000Z"),
      new Date("2026-03-08T08:00:00.000Z"),
      newYork,
    );
    expect(skipped).toHaveLength(0);

    expect(nextCronDate("0 9 * * *", new Date("2026-01-15T14:00:00.000Z"), newYork)?.toISOString()).toBe(
      "2026-01-16T14:00:00.000Z",
    );
  });
});
