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
  it("validates and exposes the project approval channel", async () => {
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
    const integrationBase = {
      scope: "project" as const,
      projectSlug: "ventas",
      kind: "telegram" as const,
      name: "Aprobaciones",
      slug: "aprobaciones",
      config: {},
      secretRefs: {},
      capabilities: ["inbound_message" as const, "outbound_message" as const],
      status: "connected" as const,
      createdAt: now,
      updatedAt: now,
    };
    store.integrations.create({ ...integrationBase, id: "tg1" });
    store.integrations.create({ ...integrationBase, id: "global1", scope: "global", projectSlug: undefined });

    const graph = await workspace.readWorkflow("ventas");
    graph.nodes.push({
      id: "review",
      type: "approval",
      position: { x: 0, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 30_000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e-review", source: "start", target: "review" });
    await workspace.writeWorkflow("ventas", graph);
    const before = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(before.readiness.find((item) => item.id === "approval-channel")?.ready).toBe(false);

    const useCase = new UpdateProjectSettingsUseCase(store, { publish() {} });
    const updated = useCase.execute("ventas", { approvalIntegrationId: "tg1", approvalRecipient: "123" });
    expect(updated.approvalIntegrationId).toBe("tg1");
    expect(updated.approvalRecipient).toBe("123");
    expect(() => useCase.execute("ventas", { approvalIntegrationId: "global1" })).toThrow(/belong/);
    const after = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(after.readiness.find((item) => item.id === "approval-channel")?.ready).toBe(true);
    store.close();
  });

  it("validates the default transcription connection and readiness", async () => {
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
    store.integrations.create({
      id: "asr1",
      scope: "project",
      projectSlug: "ventas",
      kind: "transcription",
      name: "ASR",
      slug: "asr",
      config: { baseUrl: "http://transcription:8000/v1", model: "Systran/faster-whisper-small" },
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
    store.integrations.create({
      id: "global-asr",
      scope: "global",
      kind: "transcription",
      name: "Global ASR",
      slug: "global-asr",
      config: { baseUrl: "http://transcription:8000/v1", model: "Systran/faster-whisper-small" },
      secretRefs: {},
      capabilities: ["transcribe_audio"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes.push({
      id: "transcribir",
      type: "transcribe",
      position: { x: 0, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 120_000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e-transcribe", source: "start", target: "transcribir" });
    await workspace.writeWorkflow("ventas", graph);

    const before = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(before.readiness.find((item) => item.id === "transcription")?.ready).toBe(false);

    const useCase = new UpdateProjectSettingsUseCase(store, { publish() {} });
    const updated = useCase.execute("ventas", { transcriptionIntegrationId: "asr1" });
    expect(updated.transcriptionIntegrationId).toBe("asr1");
    expect(() => useCase.execute("ventas", { transcriptionIntegrationId: "tg1" })).toThrow(/transcription/);
    expect(() => useCase.execute("ventas", { transcriptionIntegrationId: "global-asr" })).toThrow(/transcription/);
    const after = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(after.readiness.find((item) => item.id === "transcription")?.ready).toBe(true);
    store.close();
  });

  it("validates the default speech connection for voice replies and speak nodes", async () => {
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
    store.integrations.create({
      id: "tts1",
      scope: "project",
      projectSlug: "ventas",
      kind: "speech",
      name: "Voz",
      slug: "voz",
      config: { baseUrl: "http://transcription:8000/v1", model: "kokoro", voice: "ef_dora" },
      secretRefs: {},
      capabilities: ["synthesize_speech"],
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
      config: { routing: { mode: "agent", allowlist: [], public: false, voiceReplies: "auto" } },
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    store.integrations.create({
      id: "global-tts",
      scope: "global",
      kind: "speech",
      name: "Global TTS",
      slug: "global-tts",
      config: { baseUrl: "http://transcription:8000/v1", model: "kokoro", voice: "ef_dora" },
      secretRefs: {},
      capabilities: ["synthesize_speech"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes.push({
      id: "hablar",
      type: "speak",
      position: { x: 0, y: 0 },
      config: {},
      notebookIds: [],
      timeoutMs: 120_000,
      retryPolicy: { maxRetries: 0 },
    });
    graph.edges.push({ id: "e-speak", source: "start", target: "hablar" });
    await workspace.writeWorkflow("ventas", graph);

    const before = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(before.readiness.find((item) => item.id === "speech")?.ready).toBe(false);

    const useCase = new UpdateProjectSettingsUseCase(store, { publish() {} });
    const updated = useCase.execute("ventas", { speechIntegrationId: "tts1" });
    expect(updated.speechIntegrationId).toBe("tts1");
    expect(() => useCase.execute("ventas", { speechIntegrationId: "tg1" })).toThrow(/speech/);
    expect(() => useCase.execute("ventas", { speechIntegrationId: "global-tts" })).toThrow(/speech/);
    const after = await new GetProjectSettingsUseCase(store, workspace).execute("ventas");
    expect(after.readiness.find((item) => item.id === "speech")?.ready).toBe(true);
    store.close();
  });

  it("reports missing resources and updates the project model", async () => {    const dir = await mkdtemp(join(tmpdir(), "platform-settings-"));
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
