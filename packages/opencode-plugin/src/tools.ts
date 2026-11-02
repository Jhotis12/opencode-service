import { z } from "zod";
import { WorkflowGraphSchema } from "@platform/shared";

export interface PlatformClient {
  listProjects(): Promise<unknown>;
  getWorkflow(projectSlug: string): Promise<unknown>;
  upsertWorkflow(projectSlug: string, graph: unknown): Promise<unknown>;
  triggerWorkflow(projectSlug: string, payload: unknown, idempotencyKey?: string): Promise<unknown>;
  listRuns(projectSlug: string, limit?: number): Promise<unknown>;
  upsertSubagent(projectSlug: string, category: string, role: string, input: unknown): Promise<unknown>;
  listSubagents(projectSlug: string): Promise<unknown>;
  searchKnowledge(notebookSlug: string, query: string, limit?: number): Promise<unknown>;
  queryDatabase(alias: string, sql: string, params?: unknown[]): Promise<unknown>;
  notify(channelSlug: string, text: string): Promise<unknown>;
  health(): Promise<unknown>;
}

export class HttpPlatformClient implements PlatformClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly projectSlug?: string,
  ) {}

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { "x-platform-token": this.token } : {}),
        ...(this.projectSlug ? { "x-platform-project": this.projectSlug } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : undefined;
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? JSON.stringify((payload as { error: unknown }).error)
          : `${response.status} ${response.statusText}`;
      throw new Error(`platform request failed: ${message}`);
    }
    return payload;
  }

  listProjects() {
    return this.request("GET", "/api/projects");
  }
  getWorkflow(projectSlug: string) {
    return this.request("GET", `/api/projects/${projectSlug}/workflow`);
  }
  upsertWorkflow(projectSlug: string, graph: unknown) {
    return this.request("PUT", `/api/projects/${projectSlug}/workflow`, graph);
  }
  triggerWorkflow(projectSlug: string, payload: unknown, idempotencyKey?: string) {
    return this.request("POST", `/api/projects/${projectSlug}/runs`, { payload, idempotencyKey });
  }
  listRuns(projectSlug: string, limit = 10) {
    return this.request("GET", `/api/projects/${projectSlug}/runs?limit=${limit}`);
  }
  upsertSubagent(projectSlug: string, category: string, role: string, input: unknown) {
    return this.request("PUT", `/api/projects/${projectSlug}/agents/${category}/${role}`, input);
  }
  listSubagents(projectSlug: string) {
    return this.request("GET", `/api/projects/${projectSlug}/agents`);
  }
  searchKnowledge(notebookSlug: string, query: string, limit = 5) {
    return this.request("POST", `/api/notebooks/${notebookSlug}/search`, { query, limit });
  }
  queryDatabase(alias: string, sql: string, params: unknown[] = []) {
    return this.request("POST", `/api/databases/${alias}/query`, { sql, params });
  }
  notify(channelSlug: string, text: string) {
    return this.request("POST", `/api/channels/${channelSlug}/notify`, { text });
  }
  health() {
    return this.request("GET", "/api/system/health");
  }
}

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "must be kebab-case");
const agentSegment = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must be kebab-case");
const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export interface PlatformTool {
  name: string;
  description: string;
  input: Record<string, unknown>;
  execute(input: unknown): Promise<{ content: string }>;
}

export function createPlatformTools(client: PlatformClient): PlatformTool[] {
  const projectSlug = { type: "string", description: "Project/automation slug" };

  return [
    {
      name: "workflow_list",
      description: "Lista los proyectos/automatizaciones de la plataforma.",
      input: objectSchema({}, []),
      async execute() {
        return { content: JSON.stringify(await client.listProjects(), null, 2) };
      },
    },
    {
      name: "workflow_get",
      description: "Lee el grafo workflow.json de un proyecto.",
      input: objectSchema({ projectSlug }, ["projectSlug"]),
      async execute(input) {
        const { projectSlug: project } = z.object({ projectSlug: slug }).parse(input);
        return { content: JSON.stringify(await client.getWorkflow(project), null, 2) };
      },
    },
    {
      name: "workflow_upsert",
      description: "Crea o reemplaza el grafo de un flujo. Valida el esquema y las invariantes DAG antes de guardar.",
      input: objectSchema(
        {
          projectSlug,
          graph: { type: "object", description: "WorkflowGraph completo (version, nodes, edges)" },
        },
        ["projectSlug", "graph"],
      ),
      async execute(input) {
        const { projectSlug: project, graph } = z
          .object({ projectSlug: slug, graph: WorkflowGraphSchema })
          .parse(input);
        return { content: JSON.stringify(await client.upsertWorkflow(project, graph), null, 2) };
      },
    },
    {
      name: "workflow_trigger",
      description: "Ejecuta un flujo con una carga JSON y una clave de idempotencia opcional.",
      input: objectSchema(
        {
          projectSlug,
          payload: { type: "object", description: "Entrada del trigger" },
          idempotencyKey: { type: "string", description: "Clave estable para reintentos seguros" },
        },
        ["projectSlug"],
      ),
      async execute(input) {
        const parsed = z
          .object({ projectSlug: slug, payload: z.unknown().optional(), idempotencyKey: z.string().optional() })
          .parse(input);
        return {
          content: JSON.stringify(
            await client.triggerWorkflow(parsed.projectSlug, parsed.payload ?? {}, parsed.idempotencyKey),
            null,
            2,
          ),
        };
      },
    },
    {
      name: "workflow_runs",
      description: "Consulta las últimas ejecuciones y sus pasos/errores.",
      input: objectSchema({ projectSlug, limit: { type: "number", minimum: 1, maximum: 50 } }, ["projectSlug"]),
      async execute(input) {
        const parsed = z.object({ projectSlug: slug, limit: z.number().int().min(1).max(50).optional() }).parse(input);
        return { content: JSON.stringify(await client.listRuns(parsed.projectSlug, parsed.limit), null, 2) };
      },
    },
    {
      name: "subagent_upsert",
      description: "Crea o actualiza un sub-agente Markdown en .opencode/agents/<categoria>/<rol>.md.",
      input: objectSchema(
        {
          projectSlug,
          category: agentSegment,
          role: agentSegment,
          description: { type: "string" },
          mode: { type: "string", enum: ["primary", "subagent", "all"] },
          model: { type: "string", description: "provider/model#variant" },
          body: { type: "string", description: "Instrucciones de sistema del sub-agente" },
          permissions: { type: "array", description: "Reglas allow/deny/ask" },
          notebooks: { type: "array", items: { type: "string" }, description: "Bancos de información asignados" },
        },
        ["projectSlug", "category", "role", "description", "body"],
      ),
      async execute(input) {
        const parsed = z
          .object({
            projectSlug: slug,
            category: agentSegment,
            role: agentSegment,
            description: z.string().min(1),
            mode: z.enum(["primary", "subagent", "all"]).optional(),
            model: z.string().optional(),
            body: z.string().min(1),
            permissions: z
              .array(z.object({ action: z.string(), resource: z.string(), effect: z.enum(["allow", "deny", "ask"]) }))
              .optional(),
            notebooks: z.array(z.string()).optional(),
          })
          .parse(input);
        const { projectSlug: project, category, role, ...rest } = parsed;
        return { content: JSON.stringify(await client.upsertSubagent(project, category, role, rest), null, 2) };
      },
    },
    {
      name: "subagent_list",
      description: "Lista los sub-agentes y categorías de un proyecto.",
      input: objectSchema({ projectSlug }, ["projectSlug"]),
      async execute(input) {
        const { projectSlug: project } = z.object({ projectSlug: slug }).parse(input);
        return { content: JSON.stringify(await client.listSubagents(project), null, 2) };
      },
    },
    {
      name: "kb_search",
      description: "Busca en un Banco de Información (Notebook) y devuelve fragmentos con citas.",
      input: objectSchema(
        { notebookSlug: slug, query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } },
        ["notebookSlug", "query"],
      ),
      async execute(input) {
        const parsed = z
          .object({ notebookSlug: slug, query: z.string().min(1), limit: z.number().int().min(1).max(20).optional() })
          .parse(input);
        return { content: JSON.stringify(await client.searchKnowledge(parsed.notebookSlug, parsed.query, parsed.limit), null, 2) };
      },
    },
    {
      name: "db_query",
      description: "Ejecuta una consulta SQL contra una base de datos externa registrada por alias.",
      input: objectSchema(
        {
          alias: { type: "string", pattern: "^[a-z][a-z0-9_-]{1,60}$", description: "Database alias" },
          sql: { type: "string" },
          params: { type: "array" },
        },
        ["alias", "sql"],
      ),
      async execute(input) {
        const parsed = z
          .object({
            alias: z.string().regex(/^[a-z][a-z0-9_-]{1,60}$/),
            sql: z.string().min(1),
            params: z.array(z.unknown()).optional(),
          })
          .parse(input);
        return { content: JSON.stringify(await client.queryDatabase(parsed.alias, parsed.sql, parsed.params), null, 2) };
      },
    },
    {
      name: "notify",
      description: "Envía un mensaje a un canal (Telegram, WhatsApp o chat externo).",
      input: objectSchema({ channelSlug: slug, text: { type: "string" } }, ["channelSlug", "text"]),
      async execute(input) {
        const parsed = z.object({ channelSlug: slug, text: z.string().min(1).max(4096) }).parse(input);
        return { content: JSON.stringify(await client.notify(parsed.channelSlug, parsed.text), null, 2) };
      },
    },
    {
      name: "health_summary",
      description: "Resume la salud de la plataforma, ejecuciones recientes y errores.",
      input: objectSchema({}, []),
      async execute() {
        return { content: JSON.stringify(await client.health(), null, 2) };
      },
    },
  ];
}
