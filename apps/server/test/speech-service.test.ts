import { describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { Aes256GcmVaultAdapter } from "../src/infrastructure/out/vault/aes-vault.ts";
import { OpenAiCompatibleSpeechService } from "../src/infrastructure/out/speech/openai-compatible-speech-service.ts";
import { InMemoryMetrics } from "../src/domain/telemetry/metrics.ts";
import type { LogBindings, Logger } from "../src/domain/telemetry/index.ts";

const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
const WAV = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
]);

function setup(options: { secret?: string } = {}) {
  const store = new SqliteStore(":memory:");
  const vault = new Aes256GcmVaultAdapter(Buffer.alloc(32, 5));
  const now = new Date().toISOString();
  const secretRefs: Record<string, string> = {};
  if (options.secret) {
    const alias = "integration:tts:apiKey";
    store.vault.upsert({
      id: "secret-1",
      scope: "project",
      projectSlug: "ventas",
      alias,
      kind: "integration_key",
      ciphertext: vault.encrypt(options.secret),
      createdAt: now,
    });
    secretRefs.apiKey = alias;
  }
  store.integrations.create({
    id: "tts",
    scope: "project",
    projectSlug: "ventas",
    kind: "speech",
    name: "Voz",
    slug: "voz",
    config: {
      baseUrl: "http://speech.local/v1",
      model: "kokoro",
      voice: "ef_dora",
      speed: 1,
      responseFormat: "mp3",
    },
    secretRefs,
    capabilities: ["synthesize_speech"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
  return { store, vault };
}

function captureLogger() {
  const entries: Array<{ level: string; bindings: LogBindings }> = [];
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

describe("OpenAI-compatible speech service", () => {
  it("sends the speech request and returns the detected audio", async () => {
    const { store, vault } = setup();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(MP3, { status: 200, headers: { "content-type": "audio/mpeg" } });
    }) as typeof fetch;
    const service = new OpenAiCompatibleSpeechService({ store, vault, fetchImpl });
    const result = await service.synthesize({
      integrationId: "tts",
      scope: "project",
      projectSlug: "ventas",
      text: "Hola mundo",
    });
    expect(calls[0]?.url).toBe("http://speech.local/v1/audio/speech");
    expect(calls[0]?.init.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      model: "kokoro",
      input: "Hola mundo",
      voice: "ef_dora",
      response_format: "mp3",
      speed: 1,
    });
    expect(result.mime).toBe("audio/mpeg");
    expect([...result.bytes]).toEqual([...MP3]);
    store.close();
  });

  it("uses the vaulted API key and node overrides", async () => {
    const { store, vault } = setup({ secret: "sk-test" });
    let init: RequestInit | undefined;
    const fetchImpl = (async (_url: string, request: RequestInit) => {
      init = request;
      return new Response(WAV, { status: 200 });
    }) as typeof fetch;
    const service = new OpenAiCompatibleSpeechService({ store, vault, fetchImpl });
    const result = await service.synthesize({
      integrationId: "tts",
      scope: "project",
      projectSlug: "ventas",
      text: "Hola",
      model: "otro",
      voice: "em_alex",
      speed: 1.3,
      format: "wav",
    });
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "otro",
      voice: "em_alex",
      speed: 1.3,
      response_format: "wav",
    });
    expect(result.mime).toBe("audio/wav");
    store.close();
  });

  it("rejects empty, unexpected, and failed responses", async () => {
    const cases: Array<{ response: Response; code: string }> = [
      { response: new Response(new Uint8Array(), { status: 200 }), code: "EMPTY_AUDIO" },
      { response: new Response("<html>error</html>", { status: 200 }), code: "UNSUPPORTED_FORMAT" },
      { response: new Response("nope", { status: 401 }), code: "PROVIDER_ERROR" },
    ];
    for (const item of cases) {
      const { store, vault } = setup();
      const service = new OpenAiCompatibleSpeechService({
        store,
        vault,
        fetchImpl: (async () => item.response) as unknown as typeof fetch,
      });
      await expect(
        service.synthesize({ integrationId: "tts", scope: "project", projectSlug: "ventas", text: "Hola" }),
      ).rejects.toMatchObject({ code: item.code });
      store.close();
    }
  });

  it("tests the connection with a short sample and lists models", async () => {
    const { store, vault } = setup();
    const fetchImpl = (async (url: string) => {
      if (String(url).endsWith("/models")) {
        return Response.json({
          data: [
            { id: "kokoro", voices: [{ id: "ef_dora" }, { name: "em_alex" }] },
            { id: "otra" },
          ],
        });
      }
      return new Response(MP3, { status: 200 });
    }) as typeof fetch;
    const service = new OpenAiCompatibleSpeechService({ store, vault, fetchImpl });
    const result = await service.test({ integrationId: "tts", scope: "project", projectSlug: "ventas" });
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("bytes");
    expect(result.models).toEqual(["kokoro", "otra"]);
    expect(result.voices).toEqual(["ef_dora", "em_alex"]);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    store.close();
  });

  it("records synthesis telemetry without the text", async () => {
    const { store, vault } = setup();
    const metrics = new InMemoryMetrics();
    const { entries, logger } = captureLogger();
    const service = new OpenAiCompatibleSpeechService({
      store,
      vault,
      metrics,
      logger,
      fetchImpl: (async () => new Response(MP3, { status: 200 })) as unknown as typeof fetch,
    });
    await service.synthesize({
      integrationId: "tts",
      scope: "project",
      projectSlug: "ventas",
      text: "contenido privado",
    });
    expect(metrics.counter("speech_requests")).toBe(1);
    expect(metrics.counter("speech_succeeded")).toBe(1);
    const completed = entries.find((entry) => entry.bindings.event === "speech_completed");
    expect(completed?.bindings).toMatchObject({
      projectSlug: "ventas",
      integrationId: "tts",
      model: "kokoro",
      voice: "ef_dora",
      chars: 17,
      format: "mp3",
    });
    expect(JSON.stringify(entries)).not.toContain("contenido privado");
    store.close();
  });
});
