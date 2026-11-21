import { describe, expect, it } from "bun:test";
import { PlatformToolNameSchema } from "@platform/shared";
import { HttpPlatformClient, createPlatformTools, type PlatformClient } from "../src/tools.ts";
import plugin from "../src/index.ts";

class FakeClient implements PlatformClient {
  calls: Array<{ method: string; args: unknown[] }> = [];
  private record(method: string, args: unknown[]) {
    this.calls.push({ method, args });
    return { method, args };
  }
  async listProjects() { return this.record("listProjects", []); }
  async listIntegrations(slug: string) { this.record("listIntegrations", [slug]); return { data: [] }; }
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
  async searchKnowledgeProject(projectSlug: string, query: string, limit?: number) {
    return this.record("searchKnowledgeProject", [projectSlug, query, limit]);
  }
  async searchKnowledgeAcrossProjects(query: string, projectSlug?: string, limit?: number, notebookSlug?: string) {
    return this.record("searchKnowledgeAcrossProjects", [query, projectSlug, limit, notebookSlug]);
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

  it("keeps the registered names identical to PlatformToolNameSchema", () => {
    const names = createPlatformTools(new FakeClient()).map((item) => item.name).sort();
    expect(names).toEqual([...PlatformToolNameSchema.options].sort());
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

  it("delegates the discovery tools to their client methods", async () => {
    const client = new FakeClient();
    await tool("workflow_list", client).execute({});
    await tool("workflow_get", client).execute({ projectSlug: "p1" });
    await tool("subagent_list", client).execute({ projectSlug: "p1" });
    await tool("health_summary", client).execute({});
    const integrations = await tool("integration_list", client).execute({ projectSlug: "p1" });
    expect(client.calls.map((call) => call.method)).toEqual([
      "listProjects",
      "getWorkflow",
      "listSubagents",
      "health",
      "listIntegrations",
    ]);
    expect(JSON.parse(integrations.content)).toEqual([]);
  });

  it("routes knowledge search to an endpoint each scope is allowed to call", async () => {
    const client = new FakeClient();
    await tool("kb_search", client, { projectSlug: "p1" }).execute({ query: "facturas" });
    expect(client.calls[0]).toEqual({ method: "searchKnowledgeProject", args: ["p1", "facturas", undefined] });

    await tool("kb_search", client, { projectSlug: "p1" }).execute({ query: "facturas", notebookSlug: "manual" });
    expect(client.calls[1]).toEqual({ method: "searchKnowledge", args: ["p1", "manual", "facturas", undefined] });

    await tool("kb_search", client, { global: true }).execute({
      projectSlug: "p1",
      notebookSlug: "manual",
      query: "facturas",
    });
    expect(client.calls[2]).toEqual({
      method: "searchKnowledgeAcrossProjects",
      args: ["facturas", "p1", undefined, "manual"],
    });

    await expect(tool("kb_search", client, { global: true }).execute({ notebookSlug: "manual", query: "x" })).rejects.toThrow(
      /notebookSlug requires projectSlug/,
    );
    await expect(tool("kb_search", client, {}).execute({ query: "x" })).rejects.toThrow(/projectSlug is required/);
    expect(client.calls).toHaveLength(3);
  });

  it("builds a project-scoped overview without calling the control plane", async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      urls.push(url);
      const body = url.endsWith("/api/projects")
        ? { data: [
            { slug: "p1", name: "P1", description: "uno" },
            { slug: "p2", name: "P2", description: "dos" },
          ] }
        : url.includes("/runs?limit=20")
          ? { data: [
              {
                id: "r1",
                projectSlug: "p1",
                workflowId: "wf",
                status: "failed",
                error: "boom",
                startedAt: "t0",
                finishedAt: "t1",
                steps: [],
              },
            ] }
          : url.endsWith("/integrations")
            ? { data: [
                { id: "i1", scope: "project", projectSlug: "p1", kind: "telegram", name: "Bot", status: "connected" },
              ] }
            : { data: [] };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    try {
      const client = new HttpPlatformClient("http://platform", "token", { projectSlug: "p1" });
      const overview = createPlatformTools(client, { projectSlug: "p1" }).find((item) => item.name === "project_overview")!;
      const body = JSON.parse((await overview.execute({})).content) as {
        projects: unknown[];
        recentRuns: unknown[];
        recentErrors: unknown[];
        integrations: unknown[];
      };
      expect(urls.some((url) => url.includes("/api/control/"))).toBe(false);
      expect(body.projects).toEqual([{ slug: "p1", name: "P1", description: "uno", status: "active" }]);
      expect(body.recentRuns).toEqual([
        { id: "r1", projectSlug: "p1", workflowId: "wf", status: "failed", error: "boom", startedAt: "t0", finishedAt: "t1" },
      ]);
      expect(body.recentErrors).toEqual([{ id: "r1", message: "boom", entryPoint: "run", createdAt: "t1" }]);
      expect(body.integrations).toEqual([
        { id: "i1", scope: "project", projectSlug: "p1", kind: "telegram", name: "Bot", status: "connected" },
      ]);

      const controlUrls: string[] = [];
      globalThis.fetch = (async (input: string | URL | Request) => {
        controlUrls.push(String(input));
        return new Response(JSON.stringify({ projects: [], recentRuns: [], recentErrors: [], integrations: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch;
      const globalOverview = createPlatformTools(new HttpPlatformClient("http://platform", "token", { global: true }), {
        global: true,
      }).find((item) => item.name === "project_overview")!;
      await globalOverview.execute({});
      expect(controlUrls).toEqual(["http://platform/api/control/overview"]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("surfaces HTTP status, error envelope and transport failures without hiding them", async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response("<html>bad gateway</html>", { status: 502 })) as unknown as typeof fetch;
      await expect(new HttpPlatformClient("http://platform", "token").listProjects()).rejects.toThrow(
        /platform request failed: GET \/api\/projects returned 502 with a non-JSON body/,
      );

      globalThis.fetch = (async () =>
        new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "nope" } }), { status: 403 })) as unknown as typeof fetch;
      await expect(new HttpPlatformClient("http://platform", "token").listProjects()).rejects.toThrow(
        /platform request failed: GET \/api\/projects \(403 FORBIDDEN: nope\)/,
      );

      globalThis.fetch = (async () => {
        throw new Error("connect ECONNREFUSED");
      }) as unknown as typeof fetch;
      await expect(new HttpPlatformClient("http://platform", "token").listProjects()).rejects.toThrow(
        /platform request failed: GET \/api\/projects \(connect ECONNREFUSED\)/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects unknown input keys and non-object trigger payloads", async () => {
    const client = new FakeClient();
    await expect(tool("integration_list", client).execute({ projectSlug: "p1", project_slugg: "p2" })).rejects.toThrow();
    await expect(tool("workflow_list", client).execute({ unexpected: true })).rejects.toThrow();
    await expect(
      tool("notify", client).execute({ projectSlug: "p1", integrationId: "i1", text: "hola", recipent: "x" }),
    ).rejects.toThrow();
    await expect(
      tool("subagent_upsert", client).execute({
        projectSlug: "p1",
        category: "ventas",
        role: "calificador",
        description: "Califica",
        body: "Instrucciones",
        permissions: [{ action: "tool", resource: "db_query", effect: "allow", extra: true }],
      }),
    ).rejects.toThrow();
    await expect(tool("workflow_trigger", client).execute({ projectSlug: "p1", payload: "texto" })).rejects.toThrow();
    await expect(tool("workflow_trigger", client).execute({ projectSlug: "p1", payload: [1, 2] })).rejects.toThrow();
    expect(client.calls).toHaveLength(0);
  });

  it("rejects identifiers that could rewrite the request path", async () => {
    const client = new FakeClient();
    await expect(
      tool("db_query", client).execute({ projectSlug: "p1", integrationId: "../control", sql: "SELECT 1" }),
    ).rejects.toThrow();
    await expect(
      tool("notify", client).execute({ projectSlug: "p1", integrationId: "a/../b", text: "hola" }),
    ).rejects.toThrow();
    await expect(
      tool("kb_search", client, { projectSlug: "p1" }).execute({ query: "x", notebookSlug: "../secrets" }),
    ).rejects.toThrow();
    expect(client.calls).toHaveLength(0);
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
    await expect(
      tool("notify", client, {
        projectSlug: "p1",
        permissions: [{ action: "tool", resource: "notify", effect: "ask" }],
      }).execute({ projectSlug: "p1", integrationId: "i1", text: "hola" }),
    ).rejects.toThrow(/FORBIDDEN: .*requires approval/);
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
