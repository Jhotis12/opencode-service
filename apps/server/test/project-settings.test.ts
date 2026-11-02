import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { GetProjectSettingsUseCase, UpdateProjectSettingsUseCase } from "../src/application/use-cases/project-settings.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("project settings and readiness", () => {
  it("reports missing resources and updates the project model", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-settings-"));
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
      createdAt: now,
      updatedAt: now,
    });
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = {
      ...graph.nodes[0]!,
      config: { kind: "integration", integrationId: "missing", event: "message.received" },
    };
    await workspace.writeWorkflow("ventas", graph);

    const view = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(view.readiness.find((item) => item.id === "primary-agent")?.ready).toBe(false);
    expect(view.readiness.find((item) => item.id === "integrations")?.ready).toBe(false);

    const updated = new UpdateProjectSettingsUseCase(store, { publish() {} }).execute("ventas", {
      defaultModel: "opencode-go/fast",
      primaryAgent: "principal/agente",
    });
    expect(updated.defaultModel).toBe("opencode-go/fast");
    expect(updated.primaryAgent).toBe("principal/agente");
    const next = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(next.readiness.find((item) => item.id === "primary-agent")?.ready).toBe(true);
    store.close();
  });
});
