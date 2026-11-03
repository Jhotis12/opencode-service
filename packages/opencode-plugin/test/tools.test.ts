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
  async listIntegrations(slug: string) { return this.record("listIntegrations", [slug]); }
  async getWorkflow(slug: string) { return this.record("getWorkflow", [slug]); }
  async upsertWorkflow(slug: string, graph: unknown) { return this.record("upsertWorkflow", [slug, graph]); }
  async triggerWorkflow(slug: string, payload: unknown, key?: string) { return this.record("triggerWorkflow", [slug, payload, key]); }
  async listRuns(slug: string, limit?: number) { return this.record("listRuns", [slug, limit]); }
  async listAllRuns(limit?: number) { return this.record("listAllRuns", [limit]); }
  async upsertSubagent(slug: string, category: string, role: string, input: unknown) { return this.record("upsertSubagent", [slug, category, role, input]); }
  async listSubagents(slug: string) { return this.record("listSubagents", [slug]); }
  async searchKnowledge(projectSlug: string, notebookSlug: string, query: string, limit?: number) {
    return this.record("searchKnowledge", [projectSlug, notebookSlug, query, limit]);
  }
  async searchKnowledgeAcrossProjects(query: string, projectSlug?: string, limit?: number) {
    return this.record("searchKnowledgeAcrossProjects", [query, projectSlug, limit]);
  }
  async queryDatabase(projectSlug: string, integrationId: string, sql: string, params?: unknown[]) {
    return this.record("queryDatabase", [projectSlug, integrationId, sql, params]);
  }
  async notify(projectSlug: string, integrationId: string, text: string, recipient?: string) {
    return this.record("notify", [projectSlug, integrationId, text, recipient]);
  }
  async health() { return this.record("health", []); }
  async overview() { return this.record("overview", []); }
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

function tool(name: string, client: FakeClient, scope = {}) {
  const found = createPlatformTools(client, scope).find((item) => item.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

describe("platform tool namespace", () => {
  it("registers every documented tool with a JSON schema and description", () => {
    const tools = createPlatformTools(new FakeClient());
    expect(tools.map((item) => item.name)).toEqual([
      "workflow_list",
      "integration_list",
      "workflow_get",
      "workflow_upsert",
      "workflow_trigger",
      "workflow_runs",
      "project_overview",
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

  it("propagates session context and sanitizes integration discovery", async () => {
    const original = globalThis.fetch;
    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "i1",
              kind: "telegram",
              name: "Bot",
              capabilities: ["outbound_message"],
              status: "connected",
              secretRefs: { token: "alias" },
              config: { token: "should-not-leak" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    try {
      const client = new HttpPlatformClient("http://platform", "token", { projectSlug: "p1" });
      const listTool = createPlatformTools(client, { projectSlug: "p1" }).find(
        (item) => item.name === "integration_list",
      )!;
      const result = await listTool.execute(
        { projectSlug: "p1" },
        { sessionID: "s1", agent: "ventas/calificador" },
      );
      expect(sentHeaders["x-platform-session"]).toBe("s1");
      expect(sentHeaders["x-platform-agent"]).toBe("ventas/calificador");
      expect(JSON.parse(result.content)).toEqual([
        { id: "i1", kind: "telegram", name: "Bot", capabilities: ["outbound_message"], status: "connected" },
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("registers only read-only tools for the global scope", () => {
    const globalTools = createPlatformTools(new FakeClient(), { global: true }).map((item) => item.name);
    expect(globalTools).toEqual([
      "workflow_list",
      "workflow_get",
      "workflow_runs",
      "project_overview",
      "subagent_list",
      "kb_search",
      "health_summary",
    ]);
    expect(globalTools).not.toContain("workflow_upsert");
    expect(globalTools).not.toContain("workflow_trigger");
    expect(globalTools).not.toContain("subagent_upsert");
    expect(globalTools).not.toContain("db_query");
    expect(globalTools).not.toContain("notify");
    expect(globalTools).not.toContain("integration_list");

    const projectTools = createPlatformTools(new FakeClient(), { projectSlug: "p1" }).map((item) => item.name);
    expect(projectTools).toContain("workflow_upsert");
    expect(projectTools).toContain("workflow_trigger");
    expect(projectTools).toContain("subagent_upsert");
    expect(projectTools).toContain("db_query");
    expect(projectTools).toContain("notify");
    expect(projectTools).toContain("integration_list");
  });

  it("validates input before delegating", async () => {
    const client = new FakeClient();
    await expect(tool("workflow_get", client).execute({ projectSlug: "../evil" })).rejects.toThrow();
    await expect(tool("db_query", client).execute({ projectSlug: "p1", integrationId: "i1", sql: "" })).rejects.toThrow();
    await expect(tool("notify", client).execute({ projectSlug: "p1", integrationId: "i1", text: "" })).rejects.toThrow();
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
    await tool("kb_search", client).execute({ projectSlug: "p1", notebookSlug: "manual", query: "facturas" });
    expect(client.calls[1]?.method).toBe("searchKnowledge");
    expect(client.calls[1]?.args).toEqual(["p1", "manual", "facturas", undefined]);
    await tool("db_query", client).execute({ projectSlug: "p1", integrationId: "db1", sql: "SELECT 1" });
    expect(client.calls[2]?.args).toEqual(["p1", "db1", "SELECT 1", undefined]);
    await tool("notify", client).execute({ projectSlug: "p1", integrationId: "telegram", text: "hola" });
    expect(client.calls[3]?.args).toEqual(["p1", "telegram", "hola", undefined]);
  });

  it("uses the current project for runs and global search when no slug is provided", async () => {
    const client = new FakeClient();
    await tool("workflow_runs", client, { projectSlug: "p1" }).execute({});
    expect(client.calls[0]?.method).toBe("listRuns");
    expect(client.calls[0]?.args).toEqual(["p1", undefined]);
    await tool("kb_search", client, { global: true }).execute({ query: "politicas" });
    expect(client.calls[1]?.method).toBe("searchKnowledgeAcrossProjects");
  });

  it("scopes HTTP requests to the current project", async () => {
    const original = globalThis.fetch;
    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await new HttpPlatformClient("http://platform", "token", { projectSlug: "ventas-bot" }).listProjects();
      expect(sentHeaders["x-platform-project"]).toBe("ventas-bot");
      expect(sentHeaders["x-platform-token"]).toBe("token");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("sends the explicit global scope for the control workspace", async () => {
    const original = globalThis.fetch;
    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    try {
      await new HttpPlatformClient("http://platform", "global-token", { global: true }).overview();
      expect(sentHeaders["x-platform-scope"]).toBe("global");
      expect(sentHeaders["x-platform-project"]).toBeUndefined();
    } finally {
      globalThis.fetch = original;
    }
  });

  it("exposes the plugin definition", () => {
    expect(plugin.id).toBe("platform-tools");
    expect(typeof plugin.setup).toBe("function");
  });

  it("blocks workflow_upsert and subagent_upsert in workflow/external_channel contexts and enforces deny rules", async () => {
    const client = new FakeClient();
    await expect(
      tool("workflow_upsert", client, { projectSlug: "p1", executionContext: "workflow" }).execute({
        projectSlug: "p1",
        graph,
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      tool("subagent_upsert", client, { projectSlug: "p1", executionContext: "external_channel" }).execute({
        projectSlug: "p1",
        category: "ventas",
        role: "calificador",
        description: "Califica",
        body: "Instrucciones",
      }),
    ).rejects.toThrow(/FORBIDDEN/);
    await expect(
      tool("db_query", client, {
        projectSlug: "p1",
        permissions: [{ action: "tool", resource: "db_query", effect: "deny" }],
      }).execute({ projectSlug: "p1", integrationId: "db1", sql: "SELECT 1" }),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(client.calls).toHaveLength(0);

    // Allowed when explicitly permitted in workflow context
    await tool("workflow_upsert", client, {
      projectSlug: "p1",
      executionContext: "workflow",
      permissions: [{ action: "tool", resource: "workflow_upsert", effect: "allow" }],
    }).execute({ projectSlug: "p1", graph });
    expect(client.calls).toHaveLength(1);
  });
});
