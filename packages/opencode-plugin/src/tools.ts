import { z } from "zod";
import {
  WorkflowGraphSchema,
  evaluateToolPermission,
  type AgentExecutionContext,
  type PermissionRule,
} from "@platform/shared";

export interface PlatformClient {
  listProjects(): Promise<unknown>;
  getWorkflow(projectSlug: string): Promise<unknown>;
  upsertWorkflow(projectSlug: string, graph: unknown): Promise<unknown>;
  triggerWorkflow(projectSlug: string, payload: unknown, idempotencyKey?: string): Promise<unknown>;
  listRuns(projectSlug: string, limit?: number): Promise<unknown>;
  listAllRuns(limit?: number): Promise<unknown>;
  upsertSubagent(projectSlug: string, category: string, role: string, input: unknown): Promise<unknown>;
  listSubagents(projectSlug: string): Promise<unknown>;
  searchKnowledge(projectSlug: string, notebookSlug: string, query: string, limit?: number): Promise<unknown>;
  searchKnowledgeAcrossProjects(query: string, projectSlug?: string, limit?: number): Promise<unknown>;
  queryDatabase(projectSlug: string, integrationId: string, sql: string, params?: unknown[]): Promise<unknown>;
  notify(projectSlug: string, integrationId: string, text: string, recipient?: string): Promise<unknown>;
  health(): Promise<unknown>;
  overview(): Promise<unknown>;
}

export interface PlatformClientScope {
  projectSlug?: string;
  global?: boolean;
  agentId?: string;
  executionContext?: AgentExecutionContext;
  permissions?: PermissionRule[];
}

export class HttpPlatformClient implements PlatformClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly scope: PlatformClientScope = {},
  ) {}

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { "x-platform-token": this.token } : {}),
        ...(this.scope.projectSlug ? { "x-platform-project": this.scope.projectSlug } : {}),
        ...(this.scope.global ? { "x-platform-scope": "global" } : {}),
        ...(this.scope.agentId ? { "x-platform-agent": this.scope.agentId } : {}),
        ...(this.scope.executionContext ? { "x-platform-context": this.scope.executionContext } : {}),
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

  private projectPath(projectSlug: string, suffix: string): string {
    return `/api/projects/${projectSlug}${suffix}`;
  }

  listProjects() {
    return this.request("GET", "/api/projects");
  }
  getWorkflow(projectSlug: string) {
    return this.request("GET", this.projectPath(projectSlug, "/workflow"));
  }
  upsertWorkflow(projectSlug: string, graph: unknown) {
    return this.request("PUT", this.projectPath(projectSlug, "/workflow"), graph);
  }
  triggerWorkflow(projectSlug: string, payload: unknown, idempotencyKey?: string) {
    return this.request("POST", this.projectPath(projectSlug, "/runs"), { payload, idempotencyKey });
  }
  listRuns(projectSlug: string, limit = 10) {
    return this.request("GET", this.projectPath(projectSlug, `/runs?limit=${limit}`));
  }
  listAllRuns(limit = 20) {
    return this.request("GET", `/api/control/runs?limit=${limit}`);
  }
  upsertSubagent(projectSlug: string, category: string, role: string, input: unknown) {
    return this.request("PUT", this.projectPath(projectSlug, `/agents/${category}/${role}`), input);
  }
  listSubagents(projectSlug: string) {
    return this.request("GET", this.projectPath(projectSlug, "/agents"));
  }
  searchKnowledge(projectSlug: string, notebookSlug: string, query: string, limit = 5) {
    return this.request("POST", this.projectPath(projectSlug, `/notebooks/${notebookSlug}/search`), { query, limit });
  }
  searchKnowledgeAcrossProjects(query: string, projectSlug?: string, limit = 5) {
    return this.request("POST", "/api/control/knowledge/search", { query, projectSlug, limit });
  }
  queryDatabase(projectSlug: string, integrationId: string, sql: string, params: unknown[] = []) {
    return this.request("POST", this.projectPath(projectSlug, `/integrations/${integrationId}/database/query`), { sql, params });
  }
  notify(projectSlug: string, integrationId: string, text: string, recipient?: string) {
    return this.request("POST", this.projectPath(projectSlug, `/integrations/${integrationId}/notify`), { text, recipient });
  }
  health() {
    return this.request("GET", "/api/system/health");
  }
  overview() {
    return this.request("GET", "/api/control/overview");
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

const GLOBAL_READ_ONLY_TOOLS = new Set([
  "workflow_list",
  "workflow_get",
  "workflow_runs",
  "project_overview",
  "subagent_list",
  "kb_search",
  "health_summary",
]);

export function createPlatformTools(client: PlatformClient, scope: PlatformClientScope = {}): PlatformTool[] {
  const projectSlug = { type: "string", description: "Project/automation slug" };
  const currentProject = scope.projectSlug;

  const rawTools: PlatformTool[] = [
    {
      name: "workflow_list",
      description: "Lista los proyectos/automatizaciones visibles para este scope.",
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
      description: "Consulta las últimas ejecuciones y sus pasos/errores. Sin projectSlug consulta todos los proyectos.",
      input: objectSchema(
        { projectSlug: { ...projectSlug, description: "Opcional; si se omite consulta todos los proyectos" }, limit: { type: "number", minimum: 1, maximum: 50 } },
        [],
      ),
      async execute(input) {
        const parsed = z
          .object({ projectSlug: slug.optional(), limit: z.number().int().min(1).max(50).optional() })
          .parse(input);
        const project = parsed.projectSlug ?? currentProject;
        return {
          content: JSON.stringify(
            project ? await client.listRuns(project, parsed.limit) : await client.listAllRuns(parsed.limit),
            null,
            2,
          ),
        };
      },
    },
    {
      name: "project_overview",
      description: "Resume proyectos, ejecuciones recientes, errores e integraciones de la plataforma.",
      input: objectSchema({}, []),
      async execute() {
        return { content: JSON.stringify(await client.overview(), null, 2) };
      },
    },
    {
      name: "subagent_upsert",
      description: "Crea o actualiza un agente Markdown en .opencode/agents/<categoria>/<rol>.md.",
      input: objectSchema(
        {
          projectSlug,
          category: agentSegment,
          role: agentSegment,
          description: { type: "string" },
          mode: { type: "string", enum: ["primary", "subagent", "all"] },
          model: { type: "string", description: "provider/model#variant" },
          body: { type: "string", description: "Instrucciones de sistema del agente" },
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
      description: "Lista los agentes y categorías de un proyecto.",
      input: objectSchema({ projectSlug }, ["projectSlug"]),
      async execute(input) {
        const { projectSlug: project } = z.object({ projectSlug: slug }).parse(input);
        return { content: JSON.stringify(await client.listSubagents(project), null, 2) };
      },
    },
    {
      name: "kb_search",
      description: "Busca en los Bancos de Información de un proyecto o en todos los proyectos y devuelve citas.",
      input: objectSchema(
        {
          projectSlug: { ...projectSlug, description: "Opcional; en scope global busca en todos si se omite" },
          notebookSlug: { type: "string", description: "Notebook slug dentro del proyecto" },
          query: { type: "string" },
          limit: { type: "number", minimum: 1, maximum: 20 },
        },
        ["query"],
      ),
      async execute(input) {
        const parsed = z
          .object({
            projectSlug: slug.optional(),
            notebookSlug: z.string().optional(),
            query: z.string().min(1),
            limit: z.number().int().min(1).max(20).optional(),
          })
          .parse(input);
        const project = parsed.projectSlug ?? currentProject;
        const result =
          project && parsed.notebookSlug
            ? await client.searchKnowledge(project, parsed.notebookSlug, parsed.query, parsed.limit)
            : await client.searchKnowledgeAcrossProjects(parsed.query, project, parsed.limit);
        return { content: JSON.stringify(result, null, 2) };
      },
    },
    {
      name: "db_query",
      description: "Ejecuta una consulta SQL contra una integración de base de datos del proyecto.",
      input: objectSchema(
        {
          projectSlug,
          integrationId: { type: "string", description: "ID estable de la integración de base de datos" },
          sql: { type: "string" },
          params: { type: "array" },
        },
        ["projectSlug", "integrationId", "sql"],
      ),
      async execute(input) {
        const parsed = z
          .object({
            projectSlug: slug,
            integrationId: z.string().min(1),
            sql: z.string().min(1),
            params: z.array(z.unknown()).optional(),
          })
          .parse(input);
        return {
          content: JSON.stringify(
            await client.queryDatabase(parsed.projectSlug, parsed.integrationId, parsed.sql, parsed.params),
            null,
            2,
          ),
        };
      },
    },
    {
      name: "notify",
      description: "Envía un mensaje por una integración de canal del proyecto.",
      input: objectSchema(
        { projectSlug, integrationId: { type: "string" }, text: { type: "string" }, recipient: { type: "string" } },
        ["projectSlug", "integrationId", "text"],
      ),
      async execute(input) {
        const parsed = z
          .object({
            projectSlug: slug,
            integrationId: z.string().min(1),
            text: z.string().min(1).max(4096),
            recipient: z.string().optional(),
          })
          .parse(input);
        return {
          content: JSON.stringify(
            await client.notify(parsed.projectSlug, parsed.integrationId, parsed.text, parsed.recipient),
            null,
            2,
          ),
        };
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

  const scopedTools = scope.global
    ? rawTools.filter((tool) => GLOBAL_READ_ONLY_TOOLS.has(tool.name))
    : rawTools;

  return scopedTools.map((tool) => ({
    ...tool,
    async execute(input: unknown) {
      const verdict = evaluateToolPermission({
        tool: tool.name,
        context: scope.executionContext,
        permissions: scope.permissions,
      });
      if (!verdict.allowed) {
        throw new Error(`FORBIDDEN: ${verdict.reason}`);
      }
      return tool.execute(input);
    },
  }));
}
