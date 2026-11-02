import { lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { WorkflowGraphSchema, type WorkflowGraph } from "@platform/shared";
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

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,60}$/;

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
    if (!SLUG_PATTERN.test(slug)) throw new WorkspaceError("INVALID_SLUG", `invalid project slug: ${slug}`);
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

  async createProject(input: { slug: string; name: string; description?: string }): Promise<void> {
    this.assertSlug(input.slug);
    const projectRoot = join(this.rootDir, input.slug);
    await mkdir(join(projectRoot, "nodes"), { recursive: true });
    await mkdir(join(projectRoot, ".opencode", "agents"), { recursive: true });
    const now = new Date().toISOString();
    const graph: WorkflowGraph = {
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
    await this.atomicWrite(join(projectRoot, "workflow.json"), JSON.stringify(graph, null, 2));
    await this.atomicWrite(
      join(projectRoot, "opencode.jsonc"),
      `${JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          agents: {},
          permissions: PROJECT_ISOLATION_PERMISSIONS,
        },
        null,
        2,
      )}\n`,
    );
  }

  async listProjects(): Promise<string[]> {
    const entries = await readdir(this.rootDir, { withFileTypes: true }).catch(() => []);
    const projects: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SLUG_PATTERN.test(entry.name)) continue;
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
    validateWorkflowGraph(parsed.data);
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
    const realRoot = await realpath(this.rootDir);
    const realDir = await realpath(dir).catch(() => undefined);
    if (!realDir || !realDir.startsWith(`${realRoot}${sep}`)) {
      throw new WorkspaceError("FORBIDDEN_PATH", `refusing to remove ${slug}`);
    }
    await rm(realDir, { recursive: true, force: true });
  }
}
