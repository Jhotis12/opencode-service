import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SafeFsWorkspaceAdapter, WorkspaceError } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { WorkflowValidationError } from "../src/domain/workflow/graph.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), "platform-ws-"));
  dirs.push(dir);
  return { dir, ws: new SafeFsWorkspaceAdapter(dir) };
}

describe("safe filesystem workspace", () => {
  it("scaffolds a project with workflow, nodes dir and opencode config", async () => {
    const { dir, ws } = await workspace();
    await ws.createProject({ slug: "ventas-bot", name: "Ventas Bot" });
    const graph = await ws.readWorkflow("ventas-bot");
    expect(graph.nodes[0]?.type).toBe("trigger");
    expect(await ws.listProjects()).toEqual(["ventas-bot"]);
    expect(JSON.parse(await readFile(join(dir, "ventas-bot", "opencode.jsonc"), "utf8")).$schema).toContain("opencode.ai");
  });

  it("round-trips workflow and node files", async () => {
    const { ws } = await workspace();
    await ws.createProject({ slug: "p1", name: "P1" });
    const graph = await ws.readWorkflow("p1");
    graph.nodes.push({
      id: "fetch",
      type: "code",
      codeFile: "nodes/fetch.ts",
      position: { x: 200, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e1", source: "start", target: "fetch" });
    await ws.writeWorkflow("p1", graph);
    expect((await ws.readWorkflow("p1")).nodes).toHaveLength(2);
    await ws.writeNode("p1", "nodes/fetch.ts", "export default async () => ({ ok: true })\n");
    expect(await ws.readNode("p1", "nodes/fetch.ts")).toContain("ok: true");
    expect(await ws.listNodes("p1")).toEqual(["fetch.ts"]);
  });

  it("rejects path traversal and absolute paths", async () => {
    const { ws } = await workspace();
    await ws.createProject({ slug: "p1", name: "P1" });
    await expect(ws.readNode("p1", "../outside.ts")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
    await expect(ws.readNode("p1", "/etc/passwd")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
    await expect(ws.writeNode("p1", "nodes/../../escape.ts", "x")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
    await expect(ws.readNode("p1", "nodes/../../secret.txt")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
  });

  it("rejects symlinks that escape the project root", async () => {
    const { dir, ws } = await workspace();
    await ws.createProject({ slug: "p1", name: "P1" });
    const outside = join(dir, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "secret.txt"), "top-secret");
    await symlink(join(outside, "secret.txt"), join(dir, "p1", "nodes", "link.ts"));
    await expect(ws.readNode("p1", "nodes/link.ts")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
  });

  it("rejects invalid slugs and invalid graphs without writing", async () => {
    const { ws } = await workspace();
    await expect(ws.createProject({ slug: "../evil", name: "x" })).rejects.toBeInstanceOf(WorkspaceError);
    await ws.createProject({ slug: "p1", name: "P1" });
    const graph = await ws.readWorkflow("p1");
    graph.edges.push({ id: "bad", source: "start", target: "ghost" });
    await expect(ws.writeWorkflow("p1", graph)).rejects.toBeInstanceOf(WorkflowValidationError);
    expect((await ws.readWorkflow("p1")).edges).toHaveLength(0);
  });

  it("writes and lists nested agent markdown files", async () => {
    const { ws } = await workspace();
    await ws.createProject({ slug: "p1", name: "P1" });
    await ws.writeAgent("p1", ".opencode/agents/ventas/calificador.md", "---\ndescription: x\n---\nbody\n");
    expect(await ws.listAgentFiles("p1")).toEqual([
      ".opencode/agents/principal/agente.md",
      ".opencode/agents/ventas/calificador.md",
    ]);
    expect(await ws.readAgent("p1", ".opencode/agents/ventas/calificador.md")).toContain("body");
    await expect(ws.writeAgent("p1", "nodes/evil.md", "x")).rejects.toMatchObject({ code: "FORBIDDEN_PATH" });
  });
});
