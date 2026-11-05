import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import {
  DestinationError,
  ManageDestinationsUseCase,
  resolveDestinationList,
  resolveDestinationValue,
} from "../src/application/use-cases/destinations.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-destinations-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  await workspace.createProject({ slug: "soporte", name: "Soporte" });
  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  store.projects.create({ id: "p1", slug: "ventas", name: "Ventas", description: "", createdAt: now, updatedAt: now });
  store.projects.create({ id: "p2", slug: "soporte", name: "Soporte", description: "", createdAt: now, updatedAt: now });
  return { dir, workspace, store, destinations: new ManageDestinationsUseCase({ store, workspace }) };
}

describe("project destinations", () => {
  it("creates, lists, updates and removes a destination", async () => {
    const { destinations } = await setup();
    const created = destinations.create("ventas", { kind: "telegram_chat", label: "Admin", value: "123456" });
    expect(created.projectSlug).toBe("ventas");
    expect(destinations.list("ventas")).toHaveLength(1);
    const updated = destinations.update("ventas", created.id, { label: "Supervisor" });
    expect(updated.label).toBe("Supervisor");
    expect(await destinations.remove("ventas", created.id)).toBe(true);
    expect(destinations.list("ventas")).toHaveLength(0);
  });

  it("isolates destinations by project", async () => {
    const { destinations, store } = await setup();
    const created = destinations.create("ventas", { kind: "telegram_chat", label: "Admin", value: "123" });
    expect(destinations.list("soporte")).toHaveLength(0);
    expect(() => destinations.update("soporte", created.id, { label: "X" })).toThrow(DestinationError);
    expect(() => resolveDestinationValue(store, "soporte", created.id)).toThrow(/another project/);
  });

  it("resolves destination ids and keeps raw values valid", async () => {
    const { destinations, store } = await setup();
    const created = destinations.create("ventas", { kind: "telegram_chat", label: "Admin", value: "123456" });
    expect(resolveDestinationValue(store, "ventas", created.id)).toBe("123456");
    expect(resolveDestinationValue(store, "ventas", "+573001112233")).toBe("+573001112233");
    expect(resolveDestinationList(store, "ventas", [created.id, "raw"])).toEqual(["123456", "raw"]);
  });

  it("blocks deletion while an integration or workflow references the destination", async () => {
    const { destinations, store, workspace } = await setup();
    const now = new Date().toISOString();
    const first = destinations.create("ventas", { kind: "telegram_chat", label: "Admin", value: "123" });
    store.integrations.create({
      id: "i1",
      scope: "project",
      projectSlug: "ventas",
      kind: "telegram",
      name: "Telegram",
      slug: "telegram",
      config: { routing: { mode: "hybrid", allowlist: [first.id], public: false } },
      secretRefs: { token: "alias" },
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    await expect(destinations.remove("ventas", first.id)).rejects.toThrow(/routing\.allowlist/);

    const second = destinations.create("ventas", { kind: "telegram_chat", label: "Notify", value: "456" });
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes.push({
      id: "notify",
      type: "notify",
      position: { x: 200, y: 0 },
      config: { integrationId: "i1", recipient: second.id, text: "hola" },
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e1", source: "start", target: "notify" });
    await workspace.writeWorkflow("ventas", graph);
    await expect(destinations.remove("ventas", second.id)).rejects.toThrow(/workflow\.node:notify/);
  });

  it("keeps existing data when reopening a migrated database", async () => {
    const { dir } = await setup();
    const path = join(dir, "platform.sqlite");
    const first = new SqliteStore(path);
    const now = new Date().toISOString();
    first.projects.create({ id: "p1", slug: "ventas", name: "Ventas", description: "", createdAt: now, updatedAt: now });
    first.destinations.create({
      id: "d1",
      projectSlug: "ventas",
      kind: "telegram_chat",
      label: "Admin",
      value: "123",
      createdAt: now,
      updatedAt: now,
    });
    first.close();

    const reopened = new SqliteStore(path);
    expect(reopened.projects.findBySlug("ventas")).toBeDefined();
    expect(reopened.destinations.list("ventas")).toHaveLength(1);
    reopened.close();
  });
});
