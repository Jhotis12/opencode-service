import { z } from "zod";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  WorkflowGraphSchema,
  evaluateToolPermission,
  type AgentExecutionContext,
  type PermissionRule,
  type PlatformToolName,
} from "@platform/shared";

export interface PlatformToolContext {
  sessionID: string;
  agent: string;
  messageID?: string;
  id?: string;
}

const toolContext = new AsyncLocalStorage<PlatformToolContext | undefined>();

function withToolContext<T>(context: PlatformToolContext | undefined, fn: () => Promise<T>): Promise<T> {
  return toolContext.run(context, fn);
}

/** Renders an HTTP failure with its status and the server's error envelope, never a bare status text. */
function describeFailure(response: Response, payload: unknown, text: string): string {
  const envelope =
    typeof payload === "object" && payload !== null && "error" in payload
      ? (payload as { error: unknown }).error
      : undefined;
  if (typeof envelope === "string") return `${response.status} ${envelope}`;
  if (envelope && typeof envelope === "object") {
    const { code, message } = envelope as { code?: unknown; message?: unknown };
    if (typeof code === "string" && typeof message === "string") return `${response.status} ${code}: ${message}`;
    if (typeof message === "string") return `${response.status} ${message}`;
  }
  const detail = text.trim().slice(0, 200);
  return `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`.trim();
}

export interface PlatformClient {
  listProjects(): Promise<unknown>;
  listIntegrations(projectSlug: string): Promise<unknown>;
  getWorkflow(projectSlug: string): Promise<unknown>;
  upsertWorkflow(projectSlug: string, graph: unknown): Promise<unknown>;
  triggerWorkflow(projectSlug: string, payload: unknown, idempotencyKey?: string): Promise<unknown>;
  listRuns(projectSlug: string, limit?: number): Promise<unknown>;
  listAllRuns(limit?: number): Promise<unknown>;
  upsertSubagent(projectSlug: string, category: string, role: string, input: unknown): Promise<unknown>;
  listSubagents(projectSlug: string): Promise<unknown>;
  searchKnowledge(projectSlug: string, notebookSlug: string, query: string, limit?: number): Promise<unknown>;
  searchKnowledgeProject(projectSlug: string, query: string, limit?: number): Promise<unknown>;
  searchKnowledgeAcrossProjects(
    query: string,
    projectSlug?: string,
    limit?: number,
    notebookSlug?: string,
  ): Promise<unknown>;
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
    const context = toolContext.getStore();
    const agent = context?.agent ?? this.scope.agentId;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.token ? { "x-platform-token": this.token } : {}),
      ...(this.scope.projectSlug ? { "x-platform-project": this.scope.projectSlug } : {}),
      ...(this.scope.global ? { "x-platform-scope": "global" } : {}),
      ...(this.scope.executionContext ? { "x-platform-context": this.scope.executionContext } : {}),
      ...(context?.sessionID ? { "x-platform-session": context.sessionID } : {}),
      ...(agent ? { "x-platform-agent": agent } : {}),
    };
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`platform request failed: ${method} ${path} (${reason})`);
    }
    const text = await response.text();
    let payload: unknown;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(
          `platform request failed: ${method} ${path} returned ${response.status} with a non-JSON body: ${text.slice(0, 200)}`,
        );
      }
    }
    if (!response.ok) {
      throw new Error(`platform request failed: ${method} ${path} (${describeFailure(response, payload, text)})`);
    }
    return payload;
  }

  private projectPath(projectSlug: string, suffix: string): string {
    return `/api/projects/${projectSlug}${suffix}`;
  }

  listProjects() {
    return this.request("GET", "/api/projects");
  }
  listIntegrations(projectSlug: string) {
    return this.request("GET", this.projectPath(projectSlug, "/integrations"));
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
  searchKnowledgeProject(projectSlug: string, query: string, limit = 5) {
    return this.request("POST", this.projectPath(projectSlug, "/knowledge/search"), { query, limit });
  }
  searchKnowledgeAcrossProjects(query: string, projectSlug?: string, limit = 5, notebookSlug?: string) {
    return this.request("POST", "/api/control/knowledge/search", {
      query,
      projectSlug,
      limit,
      ...(notebookSlug ? { notebookSlug } : {}),
    });
  }
  queryDatabase(projectSlug: string, integrationId: string, sql: string, params: unknown[] = []) {
    return this.request("POST", this.projectPath(projectSlug, `/integrations/${encodeURIComponent(integrationId)}/database/query`), {
      sql,
      params,
    });
  }
  notify(projectSlug: string, integrationId: string, text: string, recipient?: string) {
    return this.request("POST", this.projectPath(projectSlug, `/integrations/${encodeURIComponent(integrationId)}/notify`), {
      text,
      recipient,
    });
  }
  health() {
    return this.request("GET", "/api/system/health");
  }
  /**
   * The control-plane overview is global-only, so a project-scoped client composes the same summary from the
   * project endpoints it is allowed to read. Calling /api/control/* with a project credential returns 403.
   */
  async overview() {
    if (this.scope.global || !this.scope.projectSlug) {
      return this.request("GET", "/api/control/overview");
    }
    const slug = this.scope.projectSlug;
    type ListResponse = { data?: Array<Record<string, unknown>> };
    const [projects, runs, integrations] = (await Promise.all([
      this.request("GET", "/api/projects"),
      this.request("GET", this.projectPath(slug, "/runs?limit=20")),
      this.request("GET", this.projectPath(slug, "/integrations")),
    ])) as [ListResponse, ListResponse, ListResponse];
    const projectRuns = runs.data ?? [];
    return {
      projects: (projects.data ?? [])
        .filter((project) => project.slug === slug)
        .map((project) => ({
          slug: project.slug,
          name: project.name,
          description: project.description,
          status: "active",
        })),
      recentRuns: projectRuns.map((run) => ({
        id: run.id,
        projectSlug: run.projectSlug,
        workflowId: run.workflowId,
        status: run.status,
        error: run.error,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      })),
      recentErrors: projectRuns
        .filter((run) => typeof run.error === "string" && run.error.length > 0)
        .map((run) => ({
          id: run.id,
          message: run.error,
          entryPoint: "run",
          createdAt: run.finishedAt ?? run.startedAt,
        })),
      integrations: (integrations.data ?? []).map((integration) => ({
        id: integration.id,
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        kind: integration.kind,
        name: integration.name,
        status: integration.status,
      })),
    };
  }
}

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "must be kebab-case");
const notebookSlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/, "must be kebab-case");
const integrationIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/i, "must be a plain integration id");
const agentSegment = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must be kebab-case");
const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

/**
 * Parses tool input strictly: the JSON schema advertises `additionalProperties: false`, so a misspelled key
 * must fail loudly instead of being stripped and silently replaced by a scope default.
 */
function parseToolInput<T extends z.ZodRawShape>(shape: T, input: unknown) {
  return z.object(shape).strict().parse(input);
}

export interface PlatformTool {
  name: PlatformToolName;
  description: string;
  input: Record<string, unknown>;
  execute(input: unknown, context?: PlatformToolContext): Promise<{ content: string }>;
}

const GLOBAL_READ_ONLY_TOOLS = new Set<PlatformToolName>([
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
      async execute(input) {
        parseToolInput({}, input ?? {});
        return { content: JSON.stringify(await client.listProjects(), null, 2) };
      },
    },
    {
      name: "integration_list",
      description: "Lista las integraciones del proyecto con id, tipo, capacidades, estado y nombre, sin secretos.",
      input: objectSchema({ projectSlug }, []),
      async execute(input) {
        const parsed = parseToolInput({ projectSlug: slug.optional() }, input);
        const project = parsed.projectSlug ?? currentProject;
        if (!project) throw new Error("projectSlug is required for integration_list");
        const result = (await client.listIntegrations(project)) as {
          data: Array<Record<string, unknown>>;
        };
        return {
          content: JSON.stringify(
            result.data.map((integration) => ({
              id: integration.id,
              kind: integration.kind,
              name: integration.name,
              capabilities: integration.capabilities,
              status: integration.status,
            })),
            null,
            2,
          ),
        };
      },
    },
    {
      name: "workflow_get",
      description: "Lee el grafo workflow.json de un proyecto.",
      input: objectSchema({ projectSlug }, ["projectSlug"]),
      async execute(input) {
        const { projectSlug: project } = parseToolInput({ projectSlug: slug }, input);
        return { content: JSON.stringify(await client.getWorkflow(project), null, 2) };
      },
    },
    {
      name: "workflow_upsert",
      description:
        "Crea o reemplaza el grafo de un flujo. Valida el esquema del grafo antes de enviarlo; el servidor verifica las invariantes DAG y los recursos referenciados.",
      input: objectSchema(
        {
          projectSlug,
          graph: { type: "object", description: "WorkflowGraph completo (version, nodes, edges)" },
        },
        ["projectSlug", "graph"],
      ),
      async execute(input) {
        const { projectSlug: project, graph } = parseToolInput(
          { projectSlug: slug, graph: WorkflowGraphSchema },
          input,
        );
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
        const parsed = parseToolInput(
          { projectSlug: slug, payload: z.record(z.unknown()).optional(), idempotencyKey: z.string().optional() },
          input,
        );
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
        {
          projectSlug: { ...projectSlug, description: "Opcional; si se omite consulta todos los proyectos" },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        [],
      ),
      async execute(input) {
        const parsed = parseToolInput(
          { projectSlug: slug.optional(), limit: z.number().int().min(1).max(50).optional() },
          input,
        );
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
      async execute(input) {
        parseToolInput({}, input ?? {});
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
          permissions: {
            type: "array",
            description: "Reglas allow/deny/ask",
            items: {
              type: "object",
              properties: {
                action: { type: "string" },
                resource: { type: "string" },
                effect: { type: "string", enum: ["allow", "deny", "ask"] },
              },
              required: ["action", "resource", "effect"],
              additionalProperties: false,
            },
          },
          notebooks: { type: "array", items: { type: "string" }, description: "Bancos de información asignados" },
        },
        ["projectSlug", "category", "role", "description", "body"],
      ),
      async execute(input) {
        const parsed = parseToolInput(
          {
            projectSlug: slug,
            category: agentSegment,
            role: agentSegment,
            description: z.string().min(1),
            mode: z.enum(["primary", "subagent", "all"]).optional(),
            model: z.string().optional(),
            body: z.string().min(1),
            permissions: z
              .array(
                z
                  .object({
                    action: z.string().min(1),
                    resource: z.string().min(1),
                    effect: z.enum(["allow", "deny", "ask"]),
                  })
                  .strict(),
              )
              .optional(),
            notebooks: z.array(z.string()).optional(),
          },
          input,
        );
        const { projectSlug: project, category, role, ...rest } = parsed;
        return { content: JSON.stringify(await client.upsertSubagent(project, category, role, rest), null, 2) };
      },
    },
    {
      name: "subagent_list",
      description: "Lista los agentes y categorías de un proyecto.",
      input: objectSchema({ projectSlug }, ["projectSlug"]),
      async execute(input) {
        const { projectSlug: project } = parseToolInput({ projectSlug: slug }, input);
        return { content: JSON.stringify(await client.listSubagents(project), null, 2) };
      },
    },
    {
      name: "kb_search",
      description: "Busca en los Bancos de Información de un proyecto o en todos los proyectos y devuelve citas.",
      input: objectSchema(
        {
          projectSlug: { ...projectSlug, description: "Opcional; en scope global busca en todos si se omite" },
          notebookSlug: {
            type: "string",
            pattern: "^[a-z0-9][a-z0-9-]{1,60}$",
            description: "Notebook slug dentro del proyecto; requiere projectSlug fuera de un workspace de proyecto",
          },
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 },
        },
        ["query"],
      ),
      async execute(input) {
        const parsed = parseToolInput(
          {
            projectSlug: slug.optional(),
            notebookSlug: notebookSlugSchema.optional(),
            query: z.string().min(1),
            limit: z.number().int().min(1).max(20).optional(),
          },
          input,
        );
        const project = parsed.projectSlug ?? currentProject;
        if (!project && parsed.notebookSlug) {
          throw new Error("notebookSlug requires projectSlug outside a project workspace");
        }
        if (scope.global) {
          return {
            content: JSON.stringify(
              await client.searchKnowledgeAcrossProjects(parsed.query, project, parsed.limit, parsed.notebookSlug),
              null,
              2,
            ),
          };
        }
        if (!project) {
          throw new Error("projectSlug is required for kb_search outside the global scope");
        }
        const result = parsed.notebookSlug
          ? await client.searchKnowledge(project, parsed.notebookSlug, parsed.query, parsed.limit)
          : await client.searchKnowledgeProject(project, parsed.query, parsed.limit);
        return { content: JSON.stringify(result, null, 2) };
      },
    },
    {
      name: "db_query",
      description: "Ejecuta una consulta SQL contra una integración de base de datos del proyecto.",
      input: objectSchema(
        {
          projectSlug,
          integrationId: {
            type: "string",
            pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$",
            description: "ID estable de la integración de base de datos",
          },
          sql: { type: "string" },
          params: { type: "array" },
        },
        ["projectSlug", "integrationId", "sql"],
      ),
      async execute(input) {
        const parsed = parseToolInput(
          {
            projectSlug: slug,
            integrationId: integrationIdSchema,
            sql: z.string().min(1),
            params: z.array(z.unknown()).optional(),
          },
          input,
        );
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
        {
          projectSlug,
          integrationId: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$" },
          text: { type: "string", maxLength: 4096 },
          recipient: { type: "string" },
        },
        ["projectSlug", "integrationId", "text"],
      ),
      async execute(input) {
        const parsed = parseToolInput(
          {
            projectSlug: slug,
            integrationId: integrationIdSchema,
            text: z.string().min(1).max(4096),
            recipient: z.string().optional(),
          },
          input,
        );
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
      async execute(input) {
        parseToolInput({}, input ?? {});
        return { content: JSON.stringify(await client.health(), null, 2) };
      },
    },
  ];

  const scopedTools = scope.global
    ? rawTools.filter((tool) => GLOBAL_READ_ONLY_TOOLS.has(tool.name))
    : rawTools;

  return scopedTools.map((tool) => ({
    ...tool,
    async execute(input: unknown, context?: PlatformToolContext) {
      const verdict = evaluateToolPermission({
        tool: tool.name,
        context: scope.executionContext,
        permissions: scope.permissions,
      });
      if (!verdict.allowed) {
        throw new Error(`FORBIDDEN: ${verdict.reason}`);
      }
      return withToolContext(context, () => tool.execute(input));
    },
  }));
}
