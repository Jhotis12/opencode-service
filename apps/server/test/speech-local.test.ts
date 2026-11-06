import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkflowGraph } from "@platform/shared";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { SafeFsWorkspaceAdapter } from "../src/infrastructure/out/workspace-fs/safe-workspace.ts";
import { FsMediaStore } from "../src/infrastructure/out/media/fs-media-store.ts";
import { OpenAiCompatibleSpeechService } from "../src/infrastructure/out/speech/openai-compatible-speech-service.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { FfmpegAudioConverter } from "../src/infrastructure/out/audio/ffmpeg-audio-converter.ts";
import { ExecuteWorkflowRunUseCase } from "../src/application/use-cases/execute-workflow.ts";
import { TelegramChannelAdapter, type TelegramTransport } from "../src/infrastructure/in/channels/telegram-adapter.ts";
import { BunWorkerPoolAdapter } from "../src/infrastructure/out/worker-sandbox/bun-worker-pool.ts";
import { FakeAgentRuntime } from "../src/infrastructure/out/opencode/fake-runtime.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import { NoopErrorTracker } from "../src/infrastructure/out/telemetry/sentry.ts";
import type { Logger } from "../src/domain/telemetry/index.ts";

const baseUrl = process.env.SPEECH_E2E_URL;
const silentLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return silentLogger;
  },
};

describe("local speech end to end", () => {
  it.skipIf(!baseUrl)("synthesizes through a speak node and delivers a telegram voice note", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-speech-e2e-"));
    try {
      const workspace = new SafeFsWorkspaceAdapter(join(dir, "workspaces"));
      await workspace.createProject({ slug: "voz", name: "Voz" });
      const store = new SqliteStore(":memory:");
      const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 9));
      const now = new Date().toISOString();
      store.projects.create({
        id: "p1",
        slug: "voz",
        name: "Voz",
        description: "",
        createdAt: now,
        updatedAt: now,
      });
      store.integrations.create({
        id: "tts1",
        scope: "project",
        projectSlug: "voz",
        kind: "speech",
        name: "Voz local",
        slug: "voz-local",
        config: { baseUrl, model: "speaches-ai/Kokoro-82M-v1.0-ONNX", voice: "ef_dora", speed: 1, responseFormat: "mp3" },
        secretRefs: {},
        capabilities: ["synthesize_speech"],
        status: "connected",
        createdAt: now,
        updatedAt: now,
      });
      store.projects.update("voz", { speechIntegrationId: "tts1" });
      const media = new FsMediaStore({ workspacesDir: join(dir, "workspaces"), controlDirectory: join(dir, "control") });
      const speech = new OpenAiCompatibleSpeechService({ store, vault, fetchImpl: fetch, logger: silentLogger });
      const graph: WorkflowGraph = {
        version: 1,
        id: "voz-flow",
        name: "Voz",
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
            id: "hablar",
            type: "speak",
            position: { x: 1, y: 0 },
            config: {},
            notebookIds: [],
            timeoutMs: 120_000,
            retryPolicy: { maxRetries: 0 },
          },
        ],
        edges: [{ id: "e1", source: "start", target: "hablar" }],
        updatedAt: now,
      };
      await workspace.writeWorkflow("voz", graph);
      const executor = new ExecuteWorkflowRunUseCase({
        store,
        workspace,
        worker: new BunWorkerPoolAdapter(),
        agent: new FakeAgentRuntime(),
        events: { publish() {} },
        metrics: new InMemoryMetrics(),
        errors: new NoopErrorTracker(),
        logger: silentLogger,
        speech,
        media,
      });
      const run = await executor.execute({
        projectSlug: "voz",
        graph,
        payload: { text: "Hola, esta es una prueba de voz local." },
        entryPoint: "web_ui",
      });
      expect(run.status).toBe("succeeded");
      const output = run.output as { audio: { path: string; mime: string } };
      expect(output.audio.path.startsWith(".opencode/media/")).toBe(true);
      const bytes = new Uint8Array(await readFile(join(dir, "workspaces", "voz", output.audio.path)));
      expect(bytes.byteLength).toBeGreaterThan(1_000);

      const transport: TelegramTransport & {
        voice: Array<{ bytes: Uint8Array; caption?: string }>;
        audio: Array<{ bytes: Uint8Array; caption?: string }>;
      } = {
        type: "telegram",
        voice: [],
        audio: [],
        async verify() {
          return { botId: "1", username: "test" };
        },
        async clearWebhook() {},
        async start() {},
        async send() {
          return {};
        },
        async sendVoice(_to, voiceBytes, _filename, caption) {
          this.voice.push({ bytes: voiceBytes, caption });
          return {};
        },
        async sendAudio(_to, audioBytes, _filename, _mime, caption) {
          this.audio.push({ bytes: audioBytes, caption });
          return {};
        },
        async stop() {},
        status() {
          return "connected";
        },
      };
      const adapter = new TelegramChannelAdapter({
        integrationId: "i1",
        scope: "project",
        projectSlug: "voz",
        transport,
        router: { execute: async () => ({ decision: "agent" }) },
        events: { publish() {} },
        logger: silentLogger,
        converter: new FfmpegAudioConverter(),
      });
      await adapter.sendMedia("i1", { bytes, filename: "reply.mp3", mime: output.audio.mime, caption: "Hola" }, "123");
      expect(transport.voice).toHaveLength(1);
      expect(transport.voice[0]?.caption).toBe("Hola");
      expect(String.fromCharCode(...transport.voice[0]!.bytes.slice(0, 4))).toBe("OggS");
      expect(transport.audio).toHaveLength(0);
      store.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
