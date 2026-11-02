import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { ChatWithProjectUseCase } from "../src/application/use-cases/projects.ts";
import { ChatWithOrchestratorUseCase } from "../src/application/use-cases/orchestrator.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("global orchestrator", () => {
  it("keeps its conversation separate from project chat", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-orch-"));
    dirs.push(dir);
    const store = new SqliteStore(":memory:");
    const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
    await workspace.createProject({ slug: "ventas", name: "Ventas" });
    const now = new Date().toISOString();
    store.projects.create({
      id: "p1",
      slug: "ventas",
      name: "Ventas",
      description: "",
      primaryAgent: "principal/agente",
      createdAt: now,
      updatedAt: now,
    });
    const agent = new FakeAgentRuntime();
    const projectChat = new ChatWithProjectUseCase({ store, workspace, agent, events: { publish() {} } });
    const orchestrator = new ChatWithOrchestratorUseCase({
      store,
      agent,
      controlDirectory: join(dir, "control"),
      orchestratorAgent: "orchestrator/agente",
    });
    await projectChat.execute("ventas", "hola proyecto");
    await orchestrator.execute("hola orquestador");
    expect(projectChat.history("ventas")).toHaveLength(2);
    expect(orchestrator.history()).toHaveLength(2);
    expect(projectChat.history("ventas")[0]?.content).toBe("hola proyecto");
    expect(orchestrator.history()[0]?.content).toBe("hola orquestador");
    expect(agent.sessionCount).toBe(2);
    store.close();
  });

  it("returns a cross-project overview without secrets", async () => {
    const store = new SqliteStore(":memory:");
    const now = new Date().toISOString();
    store.projects.create({ id: "p1", slug: "ventas", name: "Ventas", description: "", createdAt: now, updatedAt: now });
    store.integrations.create({
      id: "i1",
      scope: "global",
      kind: "telegram",
      name: "Alertas",
      slug: "alertas",
      config: { alerts: ["run.failed"] },
      secretRefs: { token: "secret" },
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const orchestrator = new ChatWithOrchestratorUseCase({
      store,
      agent: new FakeAgentRuntime(),
      controlDirectory: "/tmp/control",
      orchestratorAgent: "orchestrator/agente",
    });
    const overview = orchestrator.overview();
    expect(overview.projects.map((project) => project.slug)).toEqual(["ventas"]);
    expect(overview.integrations[0]).toMatchObject({ id: "i1", scope: "global", status: "connected" });
    expect(JSON.stringify(overview)).not.toContain("secret");
    store.close();
  });
});
