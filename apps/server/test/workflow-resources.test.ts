import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowGraph } from "@platform/shared";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { validateWorkflowResources } from "../src/application/use-cases/workflow-resources.ts";
import { WorkflowValidationError } from "../src/domain/workflow/graph.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function graph(integrationId?: string): WorkflowGraph {
  return {
    version: 1,
    id: "asr-flow",
    name: "ASR",
    description: "",
    nodes: [
      {
        id: "start",
        type: "trigger",
        position: { x: 0, y: 0 },
        config: { kind: "manual" },
        notebookIds: [],
        timeoutMs: 30_000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        id: "transcribir",
        type: "transcribe",
        position: { x: 1, y: 0 },
        config: integrationId ? { integrationId } : {},
        notebookIds: [],
        timeoutMs: 120_000,
        retryPolicy: { maxRetries: 0 },
      },
    ],
    edges: [{ id: "e1", source: "start", target: "transcribir" }],
    updatedAt: new Date().toISOString(),
  };
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "platform-resources-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  store.projects.create({
    id: "p1",
    slug: "ventas",
    name: "Ventas",
    description: "",
    createdAt: now,
    updatedAt: now,
  });
  store.integrations.create({
    id: "asr1",
    scope: "project",
    projectSlug: "ventas",
    kind: "transcription",
    name: "ASR",
    slug: "asr",
    config: { baseUrl: "http://asr.local/v1", model: "small" },
    secretRefs: {},
    capabilities: ["transcribe_audio"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
  store.integrations.create({
    id: "asr-other",
    scope: "project",
    projectSlug: "soporte",
    kind: "transcription",
    name: "ASR otro",
    slug: "asr-otro",
    config: { baseUrl: "http://asr.local/v1", model: "small" },
    secretRefs: {},
    capabilities: ["transcribe_audio"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
  store.integrations.create({
    id: "tg1",
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: "Telegram",
    slug: "telegram",
    config: {},
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
  return { store, workspace };
}

describe("transcription workflow resource validation", () => {
  it("accepts a project transcription integration or the project default", async () => {
    const { store, workspace } = await setup();
    await expect(validateWorkflowResources(store, workspace, "ventas", graph("asr1"))).resolves.toBeUndefined();
    store.projects.update("ventas", { transcriptionIntegrationId: "asr1" });
    await expect(validateWorkflowResources(store, workspace, "ventas", graph())).resolves.toBeUndefined();
    store.close();
  });

  it("rejects missing, cross-project, and non-transcription connections", async () => {
    const { store, workspace } = await setup();
    await expect(validateWorkflowResources(store, workspace, "ventas", graph())).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    await expect(
      validateWorkflowResources(store, workspace, "ventas", graph("asr-other")),
    ).rejects.toBeInstanceOf(WorkflowValidationError);
    await expect(validateWorkflowResources(store, workspace, "ventas", graph("tg1"))).rejects.toBeInstanceOf(
      WorkflowValidationError,
    );
    store.close();
  });
});
