import { describe, expect, it } from "bun:test";
import {
  AgentExecutionContextSchema,
  AgentNodeConfigSchema,
  ApiErrorSchema,
  ChatMessageRequestSchema,
  CreateProjectRequestSchema,
  EntryPointTypeSchema,
  NodeSpecSchema,
  PaginationMetaSchema,
  ProjectTemplateSchema,
  SseEventSchema,
  SubagentFrontmatterSchema,
  TriggerConfigSchema,
  WorkflowGraphSchema,
  WorkflowVersionSchema,
  apiError,
  modelRefToString,
  parseModelRef,
} from "../src/index.ts";

const graph = {
  version: 1 as const,
  id: "wf-1",
  name: "Facturacion",
  description: "",
  nodes: [
    { id: "start", type: "trigger" as const, config: { kind: "manual" } },
    {
      id: "fetch",
      type: "code" as const,
      codeFile: "nodes/fetch.ts",
      position: { x: 10, y: 20 },
    },
  ],
  edges: [{ id: "e1", source: "start", target: "fetch" }],
  updatedAt: new Date().toISOString(),
};

describe("workflow contracts", () => {
  it("accepts a valid DAG and applies defaults", () => {
    const parsed = WorkflowGraphSchema.parse(graph);
    expect(parsed.nodes[1]?.timeoutMs).toBe(30_000);
    expect(parsed.nodes[1]?.retryPolicy.maxRetries).toBe(0);
  });

  it("rejects node ids that are not kebab-case", () => {
    const result = NodeSpecSchema.safeParse({ id: "Node_1", type: "code" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown node type", () => {
    const result = NodeSpecSchema.safeParse({ id: "x", type: "email" });
    expect(result.success).toBe(false);
  });
});

describe("agent contracts", () => {
  it("parses subagent frontmatter with defaults", () => {
    const parsed = SubagentFrontmatterSchema.parse({ description: "Clasifica leads" });
    expect(parsed.mode).toBe("subagent");
    expect(parsed.permissions).toEqual([]);
  });

  it("round-trips model references", () => {
    const ref = parseModelRef("opencode-go/gpt-5#high");
    expect(ref).toEqual({ providerID: "opencode-go", modelID: "gpt-5", variant: "high" });
    expect(modelRefToString(ref!)).toBe("opencode-go/gpt-5#high");
  });
});

describe("api and event contracts", () => {
  it("builds a consistent api error body", () => {
    expect(ApiErrorSchema.parse(apiError("FORBIDDEN", "nope")).error.code).toBe("FORBIDDEN");
  });

  it("validates pagination metadata", () => {
    expect(PaginationMetaSchema.parse({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 }).totalPages).toBe(1);
  });

  it("validates sse workflow events", () => {
    const event = SseEventSchema.parse({ type: "workflow.updated", projectSlug: "p1", graph });
    expect(event.type).toBe("workflow.updated");
  });

  it("validates external chat requests", () => {
    const result = ChatMessageRequestSchema.safeParse({ threadId: "t1", message: "hola" });
    expect(result.success).toBe(true);
  });

  it("accepts every declared entry point", () => {
    for (const point of ["web_ui", "scheduler", "schedule", "webhook", "telegram", "external_chat", "replay"] as const) {
      expect(EntryPointTypeSchema.parse(point)).toBe(point);
    }
  });

  it("validates workflow versions, agent output schema, webhook secret alias, and project templates", () => {
    const version = WorkflowVersionSchema.parse({
      id: "v1",
      projectSlug: "p1",
      version: 1,
      graphHash: "abc123",
      graph,
      codeBundle: { "nodes/fetch.ts": "export default async () => ({})" },
      createdAt: new Date().toISOString(),
    });
    expect(version.version).toBe(1);
    expect(TriggerConfigSchema.parse({ kind: "webhook", secretAlias: "wh-secret" }).secretAlias).toBe("wh-secret");
    expect(
      AgentNodeConfigSchema.parse({
        outputSchema: { fields: [{ name: "urgencia", type: "string", required: true }] },
      }).outputSchema?.fields,
    ).toHaveLength(1);
    expect(ProjectTemplateSchema.parse("triaje-operativo")).toBe("triaje-operativo");
    expect(CreateProjectRequestSchema.parse({ slug: "p1", name: "P1" }).template).toBe("blank");
    expect(AgentExecutionContextSchema.parse("workflow")).toBe("workflow");
  });
});
