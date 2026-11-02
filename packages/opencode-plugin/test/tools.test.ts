import { describe, expect, it } from "bun:test";
import { HttpPlatformClient, createPlatformTools, type PlatformClient } from "../src/tools.ts";
import plugin from "../src/index.ts";

class FakeClient implements PlatformClient {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private record(method: string, args: unknown[]) {
    this.calls.push({ method, args });
    return { method, args };
  }
  async listProjects() { return this.record("listProjects", []); }
  async getWorkflow(slug: string) { return this.record("getWorkflow", [slug]); }
  async upsertWorkflow(slug: string, graph: unknown) { return this.record("upsertWorkflow", [slug, graph]); }
  async triggerWorkflow(slug: string, payload: unknown, key?: string) { return this.record("triggerWorkflow", [slug, payload, key]); }
  async listRuns(slug: string, limit?: number) { return this.record("listRuns", [slug, limit]); }
  async upsertSubagent(slug: string, category: string, role: string, input: unknown) { return this.record("upsertSubagent", [slug, category, role, input]); }
  async listSubagents(slug: string) { return this.record("listSubagents", [slug]); }
  async searchKnowledge(slug: string, query: string, limit?: number) { return this.record("searchKnowledge", [slug, query, limit]); }
  async queryDatabase(alias: string, sql: string, params?: unknown[]) { return this.record("queryDatabase", [alias, sql, params]); }
  async notify(slug: string, text: string) { return this.record("notify", [slug, text]); }
  async health() { return this.record("health", []); }
}

const graph = {
  version: 1,
  id: "p1",
  name: "P1",
  description: "",
  nodes: [{ id: "start", type: "trigger", config: { kind: "manual" }, position: { x: 0, y: 0 } }],
  edges: [],
  updatedAt: new Date().toISOString(),
};

function tool(name: string, client: FakeClient) {
  const found = createPlatformTools(client).find((item) => item.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

describe("platform tool namespace", () => {
  it("registers every documented tool with a JSON schema and description", () => {
    const tools = createPlatformTools(new FakeClient());
    expect(tools.map((item) => item.name)).toEqual([
      "workflow_list",
      "workflow_get",
      "workflow_upsert",
      "workflow_trigger",
      "workflow_runs",
      "subagent_upsert",
      "subagent_list",
      "kb_search",
      "db_query",
      "notify",
      "health_summary",
    ]);
    for (const item of tools) {
      expect(item.description.length).toBeGreaterThan(10);
      expect(item.input.type).toBe("object");
    }
  });

  it("validates input before delegating", async () => {
    const client = new FakeClient();
    await expect(tool("workflow_get", client).execute({ projectSlug: "../evil" })).rejects.toThrow();
    await expect(tool("db_query", client).execute({ alias: "x", sql: "" })).rejects.toThrow();
    await expect(tool("notify", client).execute({ channelSlug: "ok", text: "" })).rejects.toThrow();
    expect(client.calls).toHaveLength(0);
  });

  it("delegates workflow operations and returns JSON content", async () => {
    const client = new FakeClient();
    const result = await tool("workflow_trigger", client).execute({
      projectSlug: "p1",
      payload: { n: 1 },
      idempotencyKey: "k1",
    });
    expect(JSON.parse(result.content).method).toBe("triggerWorkflow");
    expect(client.calls[0]?.args).toEqual(["p1", { n: 1 }, "k1"]);
    await tool("workflow_upsert", client).execute({ projectSlug: "p1", graph });
    expect(client.calls[1]?.method).toBe("upsertWorkflow");
  });

  it("delegates sub-agent, knowledge, database and notification tools", async () => {
    const client = new FakeClient();
    await tool("subagent_upsert", client).execute({
      projectSlug: "p1",
      category: "ventas",
      role: "calificador",
      description: "Califica",
      body: "Instrucciones",
    });
    expect(client.calls[0]?.args.slice(0, 3)).toEqual(["p1", "ventas", "calificador"]);
    await tool("kb_search", client).execute({ notebookSlug: "manual", query: "facturas" });
    expect(client.calls[1]?.method).toBe("searchKnowledge");
    await tool("db_query", client).execute({ alias: "crm", sql: "SELECT 1" });
    expect(client.calls[2]?.args).toEqual(["crm", "SELECT 1", undefined]);
    await tool("notify", client).execute({ channelSlug: "telegram", text: "hola" });
    expect(client.calls[3]?.args).toEqual(["telegram", "hola"]);
  });

  it("scopes HTTP requests to the current project", async () => {
    const original = globalThis.fetch;
    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await new HttpPlatformClient("http://platform", "token", "ventas-bot").listProjects();
      expect(sentHeaders["x-platform-project"]).toBe("ventas-bot");
      expect(sentHeaders["x-platform-token"]).toBe("token");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("exposes the plugin definition", () => {
    expect(plugin.id).toBe("platform-tools");
    expect(typeof plugin.setup).toBe("function");
  });
});
