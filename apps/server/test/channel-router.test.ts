import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import {
  RouteGlobalIntegrationMessageUseCase,
  RouteProjectIntegrationMessageUseCase,
} from "../src/application/use-cases/route-channel-message.ts";
import { parseApprovalCommand, routeProjectMessage, senderMatchesAllowlist } from "../src/domain/channels/router.ts";
import { ChatTurnService } from "../src/application/use-cases/chat-turns.ts";
import { SseHub } from "../src/infrastructure/in/sse/sse-hub.ts";
import { FsMediaStore } from "../src/infrastructure/out/media/fs-media-store.ts";
import type { IntegrationEgressPort, TriggerRef } from "../src/application/ports/channels.ts";
import type { TranscriptionPort } from "../src/application/ports/transcription.ts";
import type { SpeechPort } from "../src/application/ports/speech.ts";
import type { OutgoingMedia } from "../src/application/ports/channels.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import type { Metrics } from "../src/domain/telemetry/index.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";
import type { IntegrationRecord } from "../src/domain/entities.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

function captureLogger() {
  const entries: Array<{ level: string; bindings: Record<string, unknown> }> = [];
  const logger: Logger = {
    debug(bindings) {
      entries.push({ level: "debug", bindings });
    },
    info(bindings) {
      entries.push({ level: "info", bindings });
    },
    warn(bindings) {
      entries.push({ level: "warn", bindings });
    },
    error(bindings) {
      entries.push({ level: "error", bindings });
    },
    child() {
      return logger;
    },
  };
  return { entries, logger };
}

class FakeEgress implements IntegrationEgressPort {
  sent: Array<{ integrationId: string; text: string }> = [];
  sentMedia: Array<{ integrationId: string; media: OutgoingMedia; recipient?: string }> = [];
  async send(integrationId: string, text: string) {
    this.sent.push({ integrationId, text });
    return {};
  }
  async sendMedia(integrationId: string, media: OutgoingMedia, recipient?: string) {
    this.sentMedia.push({ integrationId, media, recipient });
    return { providerMessageId: "media-1" };
  }
}

function fakeTranscription(text = "hola transcript", fail = false): TranscriptionPort {
  return {
    async transcribe() {
      if (fail) throw new Error("provider down");
      return { text, language: "es" };
    },
    async listModels() {
      return ["small"];
    },
    async test() {
      return { ok: !fail, models: ["small"] };
    },
  };
}

function fakeSpeech(fail = false): { port: SpeechPort; calls: Array<{ integrationId: string; text: string }> } {
  const calls: Array<{ integrationId: string; text: string }> = [];
  return {
    calls,
    port: {
      async synthesize(input) {
        calls.push({ integrationId: input.integrationId, text: input.text });
        if (fail) throw new Error("speech provider down");
        return { bytes: new Uint8Array([0xff, 0xfb, 0x90, 0x64]), mime: "audio/mpeg" };
      },
      async listModels() {
        return ["kokoro"];
      },
      async test() {
        return { ok: !fail };
      },
    },
  };
}

const trigger: TriggerRef = {
  projectSlug: "ventas",
  workflowId: "ventas",
  nodeId: "start",
  integrationId: "i1",
  event: "message.received",
};

describe("project channel routing domain", () => {
  it("routes allowlisted senders to the project agent in hybrid mode", () => {
    const decision = routeProjectMessage({
      senderId: "+57 300 111 2233",
      text: "¿cómo va el flujo?",
      mode: "hybrid",
      allowlist: ["+573001112233"],
      publicTriggers: true,
      triggers: [trigger],
    });
    expect(decision.type).toBe("agent");
  });

  it("parses approval commands from admins", () => {
    expect(parseApprovalCommand("/approve run-12345678 review")).toEqual({
      action: "approve",
      runId: "run-12345678",
      nodeId: "review",
    });
    expect(parseApprovalCommand("/reject run-12345678 review")?.action).toBe("reject");
    expect(parseApprovalCommand("hola")).toBeUndefined();
    const decision = routeProjectMessage({
      senderId: "123",
      text: "/approve run-12345678 review",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: false,
      triggers: [],
    });
    expect(decision.type).toBe("approval");
  });

  it("routes unknown senders only to public triggers", () => {
    const allowed = routeProjectMessage({
      senderId: "999",
      text: "hola",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: true,
      triggers: [trigger],
    });
    expect(allowed.type).toBe("workflow");
    const dropped = routeProjectMessage({
      senderId: "999",
      text: "hola",
      mode: "hybrid",
      allowlist: ["123"],
      publicTriggers: false,
      triggers: [trigger],
    });
    expect(dropped.type).toBe("dropped");
  });

  it("matches phone numbers regardless of formatting", () => {
    expect(senderMatchesAllowlist("+57 300-111-2233", ["573001112233"])).toBe(true);
    expect(senderMatchesAllowlist("12345@s.whatsapp.net", ["12345"])).toBe(true);
    expect(senderMatchesAllowlist("999", ["123"])).toBe(false);
  });
});

async function setup(
  useTurns = false,
  options: {
    transcription?: TranscriptionPort;
    transcriptionIntegrationId?: string;
    speech?: SpeechPort;
    speechIntegrationId?: string;
    voiceReplies?: "auto" | "never";
    metrics?: Metrics;
    logger?: Logger;
    workflowOutput?: unknown;
  } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), "platform-channels-"));
  dirs.push(dir);
  const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
  await workspace.createProject({ slug: "ventas", name: "Ventas" });
  const graph = await workspace.readWorkflow("ventas");
  graph.nodes[0] = {
    ...graph.nodes[0]!,
    config: { kind: "integration", integrationId: "i1", event: "message.received" },
  };
  graph.nodes.push({
    id: "reply",
    type: "code",
    codeFile: "nodes/reply.ts",
    position: { x: 200, y: 0 },
    config: {},
    notebookIds: [],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 0 },
  });
  graph.edges.push({ id: "e1", source: "start", target: "reply" });
  await workspace.writeWorkflow("ventas", graph);
  await workspace.writeNode("ventas", "nodes/reply.ts", `export default async (input: any) => "eco:" + input.message;`);

  const store = new SqliteStore(":memory:");
  const now = new Date().toISOString();
  const integration: IntegrationRecord = {
    id: "i1",
    scope: "project",
    projectSlug: "ventas",
    kind: "telegram",
    name: "Telegram",
    slug: "telegram",
    config: {
      routing: {
        mode: "hybrid",
        allowlist: ["+573001112233"],
        public: true,
        voiceReplies: options.voiceReplies ?? "never",
      },
    },
    secretRefs: {},
    capabilities: ["inbound_message", "outbound_message"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  };
  store.integrations.create(integration);
  store.projects.create({
    id: "p1",
    slug: "ventas",
    name: "Ventas",
    description: "",
    primaryAgent: "principal/agente",
    ...(options.transcriptionIntegrationId
      ? { transcriptionIntegrationId: options.transcriptionIntegrationId }
      : {}),
    ...(options.speechIntegrationId ? { speechIntegrationId: options.speechIntegrationId } : {}),
    createdAt: now,
    updatedAt: now,
  });
  const agent = new FakeAgentRuntime();
  const egress = new FakeEgress();
  const turns = useTurns
    ? new ChatTurnService({
        store,
        agent,
        events: new SseHub(),
        policy: { maxMs: 2_000, idleMs: 2_000, pollMs: 20, transportRetryMs: 20 },
      })
    : undefined;
  const executed: unknown[] = [];
  const approvals: unknown[] = [];
  const executor = {
    execute: async (input: unknown) => {
      executed.push(input);
      return { id: "run-12345678", status: "succeeded", output: options.workflowOutput ?? "resultado-flujo" };
    },
    resumeWithApproval: async (runId: string, nodeId: string, approved: boolean, by: string) => {
      approvals.push({ runId, nodeId, approved, by });
      return { id: runId, status: approved ? "succeeded" : "failed" };
    },
  };
  const router = new RouteProjectIntegrationMessageUseCase({
    store,
    workspace,
    agent,
    turns,
    executor: executor as never,
    egress,
    media: new FsMediaStore({ workspacesDir: join(dir, "workspaces"), controlDirectory: join(dir, "control") }),
    transcription: options.transcription,
    speech: options.speech,
    metrics: options.metrics,
    events: { publish() {} },
    logger: options.logger ?? silentLogger,
  });
  return { dir, workspace, router, store, agent, egress, executed, approvals };
}

describe("route incoming project messages", () => {
  it("answers admin messages through the project agent", async () => {
    const { router, agent, egress, executed } = await setup();
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "+573001112233", text: "estado" });
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "+573001112233", text: "otra" });
    expect(agent.sessionCount).toBe(1);
    expect(agent.prompts).toHaveLength(2);
    expect(egress.sent).toHaveLength(2);
    expect(executed).toHaveLength(0);
  });

  it("stores inbound images and passes them to the agent prompt", async () => {
    const { dir, router, agent } = await setup();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    expect(agent.prompts[0]).toContain("Analiza la imagen adjunta");
    const files = await readdir(join(dir, "workspaces", "ventas", ".opencode", "media"));
    expect(files.some((file) => file.endsWith(".jpg"))).toBe(true);
  });

  it("does not persist media for a dropped sender", async () => {
    const { dir, router, store } = await setup();
    const integration = store.integrations.findById("i1")!;
    integration.config = { routing: { mode: "hybrid", allowlist: ["123"], public: false } };
    store.integrations.update("i1", { config: integration.config });
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const result = await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "999",
      text: "",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    expect(result.decision).toBe("dropped");
    const files = await readdir(join(dir, "workspaces", "ventas", ".opencode", "media")).catch(() => []);
    expect(files).toEqual([]);
  });

  it("includes accepted audio in the workflow payload", async () => {
    const { router, executed, workspace } = await setup();
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = { ...graph.nodes[0]!, config: { ...graph.nodes[0]!.config, accepts: ["audio"] } };
    await workspace.writeWorkflow("ventas", graph);
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "999",
      text: "",
      attachments: [{ kind: "audio", filename: "voice.ogg", mime: "audio/ogg", bytes }],
    });
    const payload = (executed[0] as { payload: { attachments: Array<{ kind: string; path: string }> } }).payload;
    expect(payload.attachments[0]?.kind).toBe("audio");
    expect(payload.attachments[0]?.path).toMatch(/^\.opencode\/media\/[a-f0-9]{64}\.ogg$/);
  });

  it("drops an image for a default text-only trigger", async () => {
    const { router, executed } = await setup();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const result = await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "999",
      text: "",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    expect(result.decision).toBe("dropped");
    expect(executed).toHaveLength(0);
  });

  it("passes only the accepted attachments to a mixed message", async () => {
    const { router, executed, workspace } = await setup();
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = { ...graph.nodes[0]!, config: { ...graph.nodes[0]!.config, accepts: ["text"] } };
    await workspace.writeWorkflow("ventas", graph);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "999",
      text: "mira esto",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    const payload = (executed[0] as { payload: { message: string; attachments: unknown[] } }).payload;
    expect(payload.message).toBe("mira esto");
    expect(payload.attachments).toEqual([]);
  });

  it("passes text and image when the trigger accepts both", async () => {
    const { router, executed, workspace } = await setup();
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = { ...graph.nodes[0]!, config: { ...graph.nodes[0]!.config, accepts: ["text", "image"] } };
    await workspace.writeWorkflow("ventas", graph);
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "999",
      text: "mira esto",
      attachments: [{ kind: "image", filename: "foto.jpg", mime: "image/jpeg", bytes }],
    });
    const payload = (executed[0] as { payload: { message: string; attachments: Array<{ kind: string }> } }).payload;
    expect(payload.message).toBe("mira esto");
    expect(payload.attachments[0]?.kind).toBe("image");
  });

  it("transcribes agent-mode audio with the project default connection", async () => {
    const { router, agent } = await setup(false, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
    });
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [{ kind: "audio", filename: "voice.ogg", mime: "audio/ogg", bytes }],
    });
    expect(agent.prompts[0]).toContain("Transcripción de audio:");
    expect(agent.prompts[0]).toContain("hola transcript");
  });

  it("rejects agent-mode audio when the project has no transcription connection", async () => {
    const { router, agent, egress } = await setup(false, { transcription: fakeTranscription() });
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [{ kind: "audio", filename: "voice.ogg", mime: "audio/ogg", bytes }],
    });
    expect(egress.sent[0]?.text).toContain("conexión de transcripción");
    expect(agent.prompts).toHaveLength(0);
  });

  it("rejects agent-mode audio when transcription fails", async () => {
    const { router, agent, egress } = await setup(false, {
      transcription: fakeTranscription("", true),
      transcriptionIntegrationId: "asr1",
    });
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [{ kind: "audio", filename: "voice.ogg", mime: "audio/ogg", bytes }],
    });
    expect(egress.sent[0]?.text).toContain("No pude transcribir");
    expect(agent.prompts).toHaveLength(0);
  });

  it("records media and transcription metrics without content", async () => {
    const metrics = new InMemoryMetrics();
    const { router } = await setup(false, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      metrics,
    });
    const audio = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [{ kind: "audio", filename: "voice.ogg", mime: "audio/ogg", bytes: audio }],
    });
    expect(metrics.counter("channel_media_captured")).toBe(1);
    expect(metrics.counter("transcription_requests")).toBe(1);
    expect(metrics.counter("transcription_succeeded")).toBe(1);
  });

  it("keeps text replies for audio messages when voice replies are disabled", async () => {
    const speech = fakeSpeech();
    const { router, egress } = await setup(true, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      speech: speech.port,
      speechIntegrationId: "tts1",
    });
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [
        {
          kind: "audio",
          filename: "voice.ogg",
          mime: "audio/ogg",
          bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]),
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(speech.calls).toHaveLength(0);
    expect(egress.sentMedia).toHaveLength(0);
    expect(egress.sent).toHaveLength(1);
  });

  it("synthesizes a voice reply only for audio-originated turns", async () => {
    const { entries, logger } = captureLogger();
    const speech = fakeSpeech();
    const { router, egress, agent } = await setup(true, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      speech: speech.port,
      speechIntegrationId: "tts1",
      voiceReplies: "auto",
      logger,
    });
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [
        {
          kind: "audio",
          filename: "voice.ogg",
          mime: "audio/ogg",
          bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]),
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(speech.calls).toHaveLength(1);
    expect(speech.calls[0]?.integrationId).toBe("tts1");
    expect(egress.sentMedia).toHaveLength(1);
    expect(egress.sentMedia[0]?.media.caption).toContain("Transcripción de audio");
    expect(egress.sent).toHaveLength(0);
    expect(entries.some((entry) => entry.bindings.event === "voice_reply_sent")).toBe(true);

    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "+573001112233", text: "hola" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(speech.calls).toHaveLength(1);
    expect(egress.sent.at(-1)?.text).toContain("hola");
    expect(agent.prompts).toHaveLength(2);
  });

  it("falls back to text when voice is enabled without a connection or on failure", async () => {
    const { entries, logger } = captureLogger();
    const metrics = new InMemoryMetrics();
    const audio = {
      kind: "audio" as const,
      filename: "voice.ogg",
      mime: "audio/ogg",
      bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]),
    };
    const missing = await setup(true, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      voiceReplies: "auto",
      metrics,
      logger,
    });
    await missing.router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [audio],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(missing.egress.sentMedia).toHaveLength(0);
    expect(missing.egress.sent).toHaveLength(1);

    const failingSpeech = fakeSpeech(true);
    const failing = await setup(true, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      speech: failingSpeech.port,
      speechIntegrationId: "tts1",
      voiceReplies: "auto",
      metrics,
      logger,
    });
    await failing.router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [audio],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(failing.egress.sentMedia).toHaveLength(0);
    expect(failing.egress.sent).toHaveLength(1);
    expect(metrics.counter("voice_reply_fallback")).toBeGreaterThanOrEqual(2);
    const reasons = entries.filter((entry) => entry.bindings.event === "voice_reply_fallback").map((entry) => entry.bindings.reason);
    expect(reasons).toContain("missing_speech");
    expect(reasons).toContain("synthesis_failed");
  });

  it("skips voice synthesis when the reply exceeds the character limit", async () => {
    const { entries, logger } = captureLogger();
    const speech = fakeSpeech();
    const { router, egress, agent } = await setup(true, {
      transcription: fakeTranscription(),
      transcriptionIntegrationId: "asr1",
      speech: speech.port,
      speechIntegrationId: "tts1",
      voiceReplies: "auto",
      logger,
    });
    agent.scriptedReplies.push("x".repeat(4_001));
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "",
      attachments: [
        {
          kind: "audio",
          filename: "voice.ogg",
          mime: "audio/ogg",
          bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]),
        },
      ],
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(speech.calls).toHaveLength(0);
    expect(egress.sentMedia).toHaveLength(0);
    expect(egress.sent[0]?.text).toHaveLength(4_001);
    expect(entries.some((entry) => entry.bindings.reason === "text_too_long")).toBe(true);
  });

  it("deduplicates a repeated channel message and delivers once", async () => {    const { router, egress } = await setup(true);
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "estado",
      externalMessageId: "tg-message-1",
    });
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "estado",
      externalMessageId: "tg-message-1",
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(egress.sent).toHaveLength(1);
  });

  it("executes public workflow triggers for unknown senders", async () => {
    const { router, egress, executed } = await setup();
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(executed).toHaveLength(1);
    expect(egress.sent[0]?.text).toBe("resultado-flujo");
  });

  it("delivers generated workflow audio as media and records the delivery", async () => {
    const { router, egress, executed, dir, store } = await setup(false, {
      workflowOutput: {
        text: "Hola desde el flujo",
        audio: {
          kind: "audio",
          path: ".opencode/media/reply.mp3",
          mime: "audio/mpeg",
          filename: "reply.mp3",
        },
      },
    });
    await mkdir(join(dir, "workspaces", "ventas", ".opencode", "media"), { recursive: true });
    await writeFile(
      join(dir, "workspaces", "ventas", ".opencode", "media", "reply.mp3"),
      new Uint8Array([0xff, 0xfb, 0x90, 0x64]),
    );
    await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(executed).toHaveLength(1);
    expect(egress.sent).toHaveLength(0);
    expect(egress.sentMedia).toHaveLength(1);
    expect(egress.sentMedia[0]?.media).toMatchObject({ caption: "Hola desde el flujo", mime: "audio/mpeg" });
    expect(
      store.deliveries.findByActionKey({ actionKey: "run:run-12345678:output", integrationId: "i1" })?.status,
    ).toBe("delivered");
  });

  it("records a failed workflow audio delivery when the file is missing", async () => {
    const { router, store } = await setup(false, {
      workflowOutput: {
        audio: {
          kind: "audio",
          path: ".opencode/media/missing.mp3",
          mime: "audio/mpeg",
          filename: "missing.mp3",
        },
      },
    });
    await expect(
      router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" }),
    ).rejects.toThrow(/media file not found/);
    expect(
      store.deliveries.findByActionKey({ actionKey: "run:run-12345678:output", integrationId: "i1" })?.status,
    ).toBe("failed");
  });

  it("does not route messages to a manual trigger that kept a stale integration id", async () => {
    const { dir, router, executed, workspace } = await setup();
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = {
      ...graph.nodes[0]!,
      config: { kind: "manual", integrationId: "i1", event: "message.received", accepts: ["text"] },
    };
    await writeFile(join(dir, "workspaces", "ventas", "workflow.json"), JSON.stringify(graph, null, 2));
    const result = await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(result.decision).toBe("dropped");
    expect(executed).toHaveLength(0);
  });

  it("does not route messages to a trigger with an unsupported event", async () => {
    const { dir, router, executed, workspace } = await setup();
    const graph = await workspace.readWorkflow("ventas");
    graph.nodes[0] = {
      ...graph.nodes[0]!,
      config: { kind: "integration", integrationId: "i1", event: "unsupported.event", accepts: ["text"] },
    };
    await writeFile(join(dir, "workspaces", "ventas", "workflow.json"), JSON.stringify(graph, null, 2));
    const result = await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(result.decision).toBe("dropped");
    expect(executed).toHaveLength(0);
  });

  it("drops unknown senders when public access is disabled", async () => {
    const { router, store, egress, executed } = await setup();
    const integration = store.integrations.findById("i1")!;
    integration.config = { routing: { mode: "hybrid", allowlist: ["123"], public: false } };
    store.integrations.update("i1", { config: integration.config });
    const result = await router.execute({ integrationId: "i1", kind: "telegram", senderId: "999", text: "hola" });
    expect(result.decision).toBe("dropped");
    expect(egress.sent).toHaveLength(0);
    expect(executed).toHaveLength(0);
  });

  it("resumes paused runs from admin approval commands", async () => {
    const { router, approvals, egress } = await setup();
    await router.execute({
      integrationId: "i1",
      kind: "telegram",
      senderId: "+573001112233",
      text: "/approve run-12345678 review",
    });
    expect(approvals).toEqual([{ runId: "run-12345678", nodeId: "review", approved: true, by: "+573001112233" }]);
    expect(egress.sent[0]?.text).toContain("succeeded");
  });

  it("routes only allowlisted senders to the global orchestrator", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-global-"));
    dirs.push(dir);
    const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
    const store = new SqliteStore(":memory:");
    const now = new Date().toISOString();
    store.integrations.create({
      id: "global-1",
      scope: "global",
      kind: "telegram",
      name: "Alertas",
      slug: "alertas",
      config: { routing: { mode: "agent", allowlist: ["123"], public: false } },
      secretRefs: {},
      capabilities: ["inbound_message", "outbound_message"],
      status: "connected",
      createdAt: now,
      updatedAt: now,
    });
    const agent = new FakeAgentRuntime();
    const egress = new FakeEgress();
    const router = new RouteGlobalIntegrationMessageUseCase({
      store,
      workspace,
      agent,
      executor: {} as never,
      egress,
      media: new FsMediaStore({ workspacesDir: join(dir, "workspaces"), controlDirectory: join(dir, "control") }),
      events: { publish() {} },
      logger: silentLogger,
      controlDirectory: join(dir, "control"),
      orchestratorAgent: "orchestrator/agente",
    });
    const allowed = await router.execute({ integrationId: "global-1", kind: "telegram", senderId: "123", text: "estado" });
    const dropped = await router.execute({ integrationId: "global-1", kind: "telegram", senderId: "999", text: "hola" });
    expect(allowed.decision).toBe("orchestrator");
    expect(dropped.decision).toBe("dropped");
    expect(egress.sent).toHaveLength(1);
    expect(agent.sessionCount).toBe(1);
    store.close();
  });
});
