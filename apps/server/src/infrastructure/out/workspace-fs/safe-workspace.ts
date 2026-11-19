import { lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { WorkflowGraphSchema, type ProjectTemplate, type WorkflowGraph } from "@platform/shared";
import type { WorkspacePort } from "../../../application/ports/workspace.ts";
import { validateWorkflowGraph } from "../../../domain/workflow/graph.ts";

export class WorkspaceError extends Error {
  constructor(
    public readonly code: "FORBIDDEN_PATH" | "INVALID_SLUG" | "NOT_FOUND" | "INVALID_WORKFLOW",
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/** Matches a project or notebook slug; anything else is rejected before touching the filesystem. */
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,60}$/;

/** Matches a stored knowledge source id (UUID-shaped, no path characters). */
export const KNOWLEDGE_SOURCE_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

/**
 * Default permissions written into every project's opencode.jsonc. The agent
 * can read/edit inside its own project but not walk into sibling projects.
 * Shell commands remain a trusted capability (see README).
 */
export const PROJECT_ISOLATION_PERMISSIONS = [
  { action: "read", resource: "**", effect: "allow" as const },
  { action: "read", resource: "../**", effect: "deny" as const },
  { action: "edit", resource: "**", effect: "allow" as const },
  { action: "edit", resource: "../**", effect: "deny" as const },
  { action: "external_directory", resource: "*", effect: "deny" as const },
];

export class SafeFsWorkspaceAdapter implements WorkspacePort {
  constructor(private readonly rootDir: string) {}

  private assertSlug(slug: string): void {
    if (!WORKSPACE_SLUG_PATTERN.test(slug)) throw new WorkspaceError("INVALID_SLUG", `invalid project slug: ${slug}`);
  }

  /**
   * Resolves a project-relative path and rejects anything that escapes the
   * project root, including through symlinked parents.
   */
  private async safePath(slug: string, relativePath: string): Promise<string> {
    this.assertSlug(slug);
    if (isAbsolute(relativePath)) throw new WorkspaceError("FORBIDDEN_PATH", "absolute paths are not allowed");
    const projectRoot = resolve(this.rootDir, slug);
    const candidate = resolve(projectRoot, normalize(relativePath));
    const relation = relative(projectRoot, candidate);
    if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) {
      throw new WorkspaceError("FORBIDDEN_PATH", `path escapes project root: ${relativePath}`);
    }
    const realRoot = await realpath(projectRoot).catch(() => {
      throw new WorkspaceError("NOT_FOUND", `project not found: ${slug}`);
    });
    let anchor = candidate;
    while (anchor !== projectRoot) {
      try {
        await lstat(anchor);
        break;
      } catch {
        anchor = resolve(anchor, "..");
      }
    }
    const realAnchor = await realpath(anchor);
    const realTarget = anchor === candidate ? realAnchor : join(realAnchor, relative(anchor, candidate));
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${sep}`)) {
      throw new WorkspaceError("FORBIDDEN_PATH", `path escapes project root: ${relativePath}`);
    }
    return realTarget;
  }

  private async atomicWrite(path: string, content: string): Promise<void> {
    await mkdir(resolve(path, ".."), { recursive: true });
    const temporary = `${path}.tmp-${crypto.randomUUID()}`;
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  }

  async createProject(input: {
    slug: string;
    name: string;
    description?: string;
    template?: ProjectTemplate;
  }): Promise<void> {
    this.assertSlug(input.slug);
    const projectRoot = join(this.rootDir, input.slug);
    await mkdir(join(projectRoot, "nodes"), { recursive: true });
    await mkdir(join(projectRoot, ".opencode", "agents", "principal"), { recursive: true });
    await mkdir(join(projectRoot, "knowledge"), { recursive: true });
    await this.ensureProjectScaffold(input.slug, input.name);
    const now = new Date().toISOString();
    let graph: WorkflowGraph;
    if (input.template === "triaje-operativo") {
      await mkdir(join(projectRoot, ".opencode", "agents", "operaciones"), { recursive: true });
      await this.atomicWrite(
        join(projectRoot, ".opencode", "agents", "operaciones", "clasificador.md"),
        [
          "---",
          "description: Clasifica tickets operativos y devuelve un dictamen estructurado con urgencia y necesidad de aprobación.",
          "mode: subagent",
          "permissions:",
          "  - action: tool",
          "    resource: workflow_upsert",
          "    effect: deny",
          "  - action: tool",
          "    resource: subagent_upsert",
          "    effect: deny",
          "---",
          "",
          "Eres el agente clasificador de operaciones. Analiza el ticket entrante y responde con el objeto JSON solicitado indicando categoría, urgencia, si requiere aprobación humana y la acción sugerida.",
        ].join("\n") + "\n",
      );
      await this.atomicWrite(
        join(projectRoot, "nodes", "resumen-accion.ts"),
        [
          "export default async function run(input: Record<string, unknown>) {",
          "  return {",
          '    estado: "procesado",',
          '    categoria: input.categoria ?? "general",',
          '    urgencia: input.urgencia ?? "media",',
          '    accion: input.accionSugerida ?? "Atender en cola operativa",',
          "  };",
          "}",
        ].join("\n") + "\n",
      );
      graph = {
        version: 1,
        id: input.slug,
        name: input.name,
        description: input.description || "Triaje y escalamiento operativo con salida estructurada.",
        nodes: [
          {
            id: "start",
            type: "trigger",
            label: "Ticket entrante",
            position: { x: 0, y: 120 },
            config: {
              kind: "manual",
              inputSchema: {
                fields: [
                  { name: "cliente", label: "Cliente", type: "string", required: true, example: "Acme Corp" },
                  { name: "mensaje", label: "Mensaje", type: "string", required: true, example: "Caída en producción" },
                  { name: "canal", label: "Canal", type: "string", required: false, example: "whatsapp" },
                ],
              },
            },
            notebookIds: [],
            timeoutMs: 30_000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            id: "validar-entrada",
            type: "validate",
            label: "Validar ticket",
            position: { x: 240, y: 120 },
            config: {
              rules: [
                { name: "cliente", type: "string", required: true, message: "Falta el nombre del cliente." },
                { name: "mensaje", type: "string", required: true, message: "Falta el mensaje del ticket." },
              ],
            },
            notebookIds: [],
            timeoutMs: 10_000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            id: "clasificar-caso",
            type: "agent",
            label: "Clasificar caso",
            agentId: "operaciones/clasificador",
            position: { x: 480, y: 120 },
            config: {
              instruction: "Clasifica el ticket y determina si requiere aprobación de un supervisor.",
              outputSchema: {
                fields: [
                  { name: "categoria", type: "string", required: true, example: "incidente" },
                  { name: "urgencia", type: "string", required: true, example: "alta" },
                  { name: "requiereAprobacion", type: "boolean", required: true, example: false },
                  { name: "accionSugerida", type: "string", required: true, example: "Notificar guardia" },
                ],
              },
            },
            notebookIds: [],
            timeoutMs: 60_000,
            retryPolicy: { maxRetries: 1 },
          },
          {
            id: "requiere-aprobacion",
            type: "decision",
            label: "¿Requiere aprobación?",
            position: { x: 740, y: 120 },
            config: {
              mode: "condition",
              condition: { field: "requiereAprobacion", operator: "equals", value: true },
            },
            notebookIds: [],
            timeoutMs: 10_000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            id: "aprobacion-supervisor",
            type: "approval",
            label: "Aprobación supervisor",
            position: { x: 1000, y: 20 },
            config: {
              message: "Revisar caso crítico antes de emitir dictamen operativo.",
            },
            notebookIds: [],
            timeoutMs: 60_000,
            retryPolicy: { maxRetries: 0 },
          },
          {
            id: "emitir-dictamen",
            type: "code",
            label: "Emitir dictamen",
            codeFile: "nodes/resumen-accion.ts",
            position: { x: 1260, y: 120 },
            config: {},
            notebookIds: [],
            timeoutMs: 15_000,
            retryPolicy: { maxRetries: 0 },
          },
        ],
        edges: [
          { id: "e1", source: "start", target: "validar-entrada" },
          { id: "e2", source: "validar-entrada", target: "clasificar-caso" },
          { id: "e3", source: "clasificar-caso", target: "requiere-aprobacion" },
          { id: "e4", source: "requiere-aprobacion", target: "aprobacion-supervisor", condition: "true" },
          { id: "e5", source: "requiere-aprobacion", target: "emitir-dictamen", condition: "false" },
          { id: "e6", source: "aprobacion-supervisor", target: "emitir-dictamen" },
        ],
        updatedAt: now,
      };
    } else {
      graph = {
        version: 1,
        id: input.slug,
        name: input.name,
        description: input.description ?? "",
        nodes: [
          {
            id: "start",
            type: "trigger",
            label: "Inicio manual",
            position: { x: 0, y: 0 },
            config: { kind: "manual", isPublic: false },
            notebookIds: [],
            timeoutMs: 30_000,
            retryPolicy: { maxRetries: 0 },
          },
        ],
        edges: [],
        updatedAt: now,
      };
    }
    await this.atomicWrite(join(projectRoot, "workflow.json"), JSON.stringify(graph, null, 2));
    await this.atomicWrite(
      join(projectRoot, "opencode.jsonc"),
      `${JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          default_agent: "principal/agente",
          permissions: PROJECT_ISOLATION_PERMISSIONS,
        },
        null,
        2,
      )}\n`,
    );
  }

  async ensureProjectScaffold(slug: string, projectName = slug): Promise<void> {
    this.assertSlug(slug);
    const projectRoot = join(this.rootDir, slug);
    await mkdir(join(projectRoot, "nodes"), { recursive: true });
    await mkdir(join(projectRoot, ".opencode", "agents", "principal"), { recursive: true });
    await mkdir(join(projectRoot, "knowledge"), { recursive: true });

    const agentsPath = join(projectRoot, "AGENTS.md");
    const agentsExists = await readFile(agentsPath, "utf8").then(() => true).catch(() => false);
    if (!agentsExists) {
      await this.atomicWrite(
        agentsPath,
        [
          `# Proyecto ${projectName}`,
          "",
          "- Este proyecto es un caso de uso autocontenido.",
          "- El flujo vive en `workflow.json`; los nodos de código en `nodes/`.",
          "- Los agentes viven en `.opencode/agents/<categoria>/<rol>.md`.",
          "- El conocimiento del proyecto vive en `knowledge/`.",
          "- No compartas recursos, secretos ni conocimiento con otros proyectos.",
        ].join("\n") + "\n",
      );
    }

    const primaryPath = join(projectRoot, ".opencode", "agents", "principal", "agente.md");
    const primaryExists = await readFile(primaryPath, "utf8").then(() => true).catch(() => false);
    if (!primaryExists) {
      await this.atomicWrite(
        primaryPath,
        [
          "---",
          "description: Agente principal del proyecto; co-diseña flujos y explica en lenguaje de negocio.",
          "mode: primary",
          "---",
          "",
          "Eres el agente principal de este proyecto. Hablas con personas de negocio.",
          "",
          "- Explica en términos de nodos, flujos y resultados.",
          "- No menciones rutas, archivos ni nombres internos salvo que te lo pidan.",
          "- Empieza con un resumen de 2-3 líneas; luego \"Qué cambié\" y \"Siguiente paso\".",
          "- No uses tablas de más de 3 columnas; para datos largos usa listas.",
          "- No pegues JSON crudo; describe el resultado.",
          "- Antes de borrar o reemplazar algo, pide confirmación.",
        ].join("\n") + "\n",
      );
    }

    const configPath = join(projectRoot, "opencode.jsonc");
    const config = await this.readOpencodeConfig(slug);
    let changed = false;
    if (!config.default_agent) {
      config.default_agent = "principal/agente";
      changed = true;
    }
    if (!Array.isArray(config.permissions)) {
      config.permissions = PROJECT_ISOLATION_PERMISSIONS;
      changed = true;
    }
    if (changed) await this.writeOpencodeConfig(slug, config);
  }

  async listProjects(): Promise<string[]> {
    const entries = await readdir(this.rootDir, { withFileTypes: true }).catch(() => []);
    const projects: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !WORKSPACE_SLUG_PATTERN.test(entry.name)) continue;
      const hasWorkflow = await readFile(join(this.rootDir, entry.name, "workflow.json"), "utf8")
        .then(() => true)
        .catch(() => false);
      if (hasWorkflow) projects.push(entry.name);
    }
    return projects.sort();
  }

  async projectDirectory(slug: string): Promise<string> {
    this.assertSlug(slug);
    const dir = await realpath(join(this.rootDir, slug)).catch(() => {
      throw new WorkspaceError("NOT_FOUND", `project not found: ${slug}`);
    });
    return dir;
  }

  async readWorkflow(slug: string): Promise<WorkflowGraph> {
    const path = await this.safePath(slug, "workflow.json");
    const raw = await readFile(path, "utf8");
    const parsed = WorkflowGraphSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new WorkspaceError("INVALID_WORKFLOW", `workflow.json is invalid: ${parsed.error.message}`);
    }
    validateWorkflowGraph(parsed.data, { strictEvents: false });
    return parsed.data;
  }

  async writeWorkflow(slug: string, graph: WorkflowGraph): Promise<void> {
    const parsed = WorkflowGraphSchema.parse(graph);
    validateWorkflowGraph(parsed);
    const path = await this.safePath(slug, "workflow.json");
    await this.atomicWrite(path, JSON.stringify({ ...parsed, updatedAt: new Date().toISOString() }, null, 2));
  }

  async readNode(slug: string, file: string): Promise<string> {
    const path = await this.safePath(slug, file);
    return readFile(path, "utf8").catch(() => {
      throw new WorkspaceError("NOT_FOUND", `node not found: ${file}`);
    });
  }

  async writeNode(slug: string, file: string, code: string): Promise<void> {
    if (!file.startsWith("nodes/") || !file.endsWith(".ts")) {
      throw new WorkspaceError("FORBIDDEN_PATH", "node files must live under nodes/ and end with .ts");
    }
    const path = await this.safePath(slug, file);
    await this.atomicWrite(path, code);
  }

  async listNodes(slug: string): Promise<string[]> {
    const path = await this.safePath(slug, "nodes");
    const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ts")).map((entry) => entry.name).sort();
  }

  async readAgent(slug: string, relativePath: string): Promise<string> {
    const path = await this.safePath(slug, relativePath);
    return readFile(path, "utf8").catch(() => {
      throw new WorkspaceError("NOT_FOUND", `agent not found: ${relativePath}`);
    });
  }

  async writeAgent(slug: string, relativePath: string, markdown: string): Promise<void> {
    if (!relativePath.startsWith(".opencode/agents/") || !relativePath.endsWith(".md")) {
      throw new WorkspaceError("FORBIDDEN_PATH", "agent files must live under .opencode/agents/ and end with .md");
    }
    const path = await this.safePath(slug, relativePath);
    await this.atomicWrite(path, markdown);
  }

  async removeAgent(slug: string, relativePath: string): Promise<void> {
    if (!relativePath.startsWith(".opencode/agents/") || !relativePath.endsWith(".md")) {
      throw new WorkspaceError("FORBIDDEN_PATH", "agent files must live under .opencode/agents/ and end with .md");
    }
    const path = await this.safePath(slug, relativePath);
    await rm(path, { force: true });
  }

  /**
   * Removes a notebook's knowledge directory. Slugs are validated first so a
   * traversal attempt never reaches the filesystem, and the resolved path is
   * re-checked against the project root before removal.
   */
  async removeKnowledgeNotebook(slug: string, notebookSlug: string): Promise<void> {
    if (!WORKSPACE_SLUG_PATTERN.test(slug) || !WORKSPACE_SLUG_PATTERN.test(notebookSlug)) {
      throw new WorkspaceError("FORBIDDEN_PATH", `invalid knowledge path: ${slug}/${notebookSlug}`);
    }
    const path = await this.safePath(slug, join("knowledge", notebookSlug));
    await rm(path, { recursive: true, force: true });
  }

  /** Removes one stored source markdown file inside the notebook's sources directory. */
  async removeKnowledgeSource(slug: string, notebookSlug: string, sourceId: string): Promise<void> {
    if (
      !WORKSPACE_SLUG_PATTERN.test(slug) ||
      !WORKSPACE_SLUG_PATTERN.test(notebookSlug) ||
      !KNOWLEDGE_SOURCE_ID_PATTERN.test(sourceId)
    ) {
      throw new WorkspaceError("FORBIDDEN_PATH", `invalid knowledge path: ${slug}/${notebookSlug}/${sourceId}`);
    }
    const path = await this.safePath(slug, join("knowledge", notebookSlug, "sources", `${sourceId}.md`));
    await rm(path, { force: true });
  }

  async listAgentFiles(slug: string): Promise<string[]> {
    const base = await this.safePath(slug, ".opencode/agents");
    const files: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(relative(await this.projectDirectory(slug), full).split(sep).join("/"));
        }
      }
    };
    await walk(base);
    return files.sort();
  }

  async readOpencodeConfig(slug: string): Promise<Record<string, unknown>> {
    const path = await this.safePath(slug, "opencode.jsonc");
    const raw = await readFile(path, "utf8").catch(() => "{}");
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  async writeOpencodeConfig(slug: string, config: Record<string, unknown>): Promise<void> {
    const path = await this.safePath(slug, "opencode.jsonc");
    await this.atomicWrite(path, `${JSON.stringify(config, null, 2)}\n`);
  }

  async removeProject(slug: string): Promise<void> {
    this.assertSlug(slug);
    const dir = join(this.rootDir, slug);
    const realRoot = await realpath(this.rootDir).catch(() => undefined);
    if (!realRoot) return;
    const realDir = await realpath(dir).catch(() => undefined);
    if (!realDir) return;
    if (!realDir.startsWith(`${realRoot}${sep}`)) {
      throw new WorkspaceError("FORBIDDEN_PATH", `refusing to remove ${slug}`);
    }
    await rm(realDir, { recursive: true, force: true });
  }
}
