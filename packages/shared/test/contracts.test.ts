import { describe, expect, it } from "bun:test";
import {
  AgentExecutionContextSchema,
  AgentNodeConfigSchema,
  ApiErrorSchema,
  ChatMessageRequestSchema,
  ChatMessageSchema,
  MediaRefSchema,
  TranscribeNodeConfigSchema,
  TranscriptionIntegrationConfigSchema,
  CreateProjectRequestSchema,
  DatabaseNodeConfigSchema,
  EntryPointTypeSchema,
  NodeSpecSchema,
  NodeErrorPolicySchema,
  NotifyNodeConfigSchema,
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

  it("parses native database and notify node contracts", () => {
    const database = DatabaseNodeConfigSchema.parse({
      integrationId: "db-1",
      statements: [{ sql: "select 1", params: [] }],
    });
    expect(database.mode).toBe("read");
    expect(database.statements).toHaveLength(1);
    const notify = NotifyNodeConfigSchema.parse({ integrationId: "tg-1", text: "hola {{input.nombre}}" });
    expect(notify.integrationId).toBe("tg-1");
    expect(NodeSpecSchema.parse({ id: "db", type: "database" }).type).toBe("database");
    expect(NodeSpecSchema.parse({ id: "msg", type: "notify" }).type).toBe("notify");
  });

  it("parses error policy and retry backoff without changing existing workflows", () => {
    const parsed = NodeSpecSchema.parse({ id: "http", type: "http", config: { url: "https://example.com" } });
    expect(parsed.onError).toBeUndefined();
    expect(parsed.retryPolicy).toEqual({ maxRetries: 0 });
    const routed = NodeSpecSchema.parse({
      id: "http",
      type: "http",
      config: { url: "https://example.com" },
      retryPolicy: { maxRetries: 2, backoffMs: 250, backoffMultiplier: 3 },
      onError: { strategy: "route", target: "fallback" },
    });
    expect(routed.retryPolicy.backoffMultiplier).toBe(3);
    expect(routed.onError?.target).toBe("fallback");
    expect(NodeErrorPolicySchema.safeParse({ strategy: "route" }).success).toBe(false);
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

describe("media and transcription contracts", () => {
  it("validates an OpenAI-compatible transcription integration", () => {
    const parsed = TranscriptionIntegrationConfigSchema.parse({
      kind: "transcription",
      baseUrl: "http://transcription:8000/v1",
      model: "Systran/faster-whisper-small",
      language: "es",
    });
    expect(parsed.model).toBe("Systran/faster-whisper-small");
    expect(TranscriptionIntegrationConfigSchema.safeParse({ kind: "transcription", baseUrl: "nope" }).success).toBe(false);
  });

  it("defaults trigger media acceptance to text", () => {
    expect(TriggerConfigSchema.parse({ kind: "integration" }).accepts).toEqual(["text"]);
    expect(TriggerConfigSchema.parse({ kind: "integration", accepts: ["text", "image", "audio"] }).accepts).toHaveLength(3);
  });

  it("validates transcribe node configuration and media references", () => {
    expect(TranscribeNodeConfigSchema.parse({}).mediaPath).toBe("attachments");
    expect(
      MediaRefSchema.parse({
        kind: "audio",
        path: ".opencode/media/abc.ogg",
        mime: "audio/ogg",
        filename: "voice.ogg",
      }).kind,
    ).toBe("audio");
  });

  it("keeps attachments optional in chat messages", () => {
    expect(
      ChatMessageSchema.parse({ id: "m1", threadId: "t1", role: "user", content: "hola", createdAt: new Date().toISOString() })
        .attachments,
    ).toBeUndefined();
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
    const scheduled = TriggerConfigSchema.parse({ kind: "schedule", cron: "0 9 * * *" });
    expect(scheduled.timezone).toBe("UTC");
    expect(scheduled.enabled).toBe(true);
    expect(scheduled.overlapPolicy).toBe("skip");
    expect(scheduled.catchUp).toBe(false);
    expect(TriggerConfigSchema.safeParse({ kind: "schedule", cron: "0 9 * * *", timezone: "Mars/Olympus" }).success).toBe(false);
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
