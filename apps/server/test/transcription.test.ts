import { afterEach, describe, expect, it } from "bun:test";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";
import { OpenAiCompatibleTranscriptionService } from "../src/infrastructure/out/transcription/openai-compatible-transcription-service.ts";
import type { SecretVault } from "../src/application/ports/security.ts";

const stores: SqliteStore[] = [];
afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

const vault: SecretVault = {
  encrypt: (value) => `enc:${value}`,
  decrypt: (value) => value.replace(/^enc:/, ""),
};

function setup(fetchImpl: typeof fetch) {
  const store = new SqliteStore(":memory:");
  stores.push(store);
  const now = new Date().toISOString();
  store.integrations.create({
    id: "asr1",
    scope: "project",
    projectSlug: "ventas",
    kind: "transcription",
    name: "ASR",
    slug: "asr",
    config: { baseUrl: "http://asr.local/v1/", model: "small", language: "es" },
    secretRefs: { apiKey: "asr-key" },
    capabilities: ["transcribe_audio"],
    status: "connected",
    createdAt: now,
    updatedAt: now,
  });
  store.vault.upsert({
    id: "secret-1",
    scope: "project",
    projectSlug: "ventas",
    alias: "asr-key",
    kind: "integration:transcription",
    ciphertext: "enc:secret",
    createdAt: now,
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
  return { store, service: new OpenAiCompatibleTranscriptionService({ store, vault, fetchImpl }) };
}

const audio = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
const access = { integrationId: "asr1", scope: "project" as const, projectSlug: "ventas" };

describe("OpenAI-compatible transcription service", () => {
  it("sends a multipart transcription request and parses the result", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ text: " hola mundo ", language: "es", duration: 2.4 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const { service } = setup(fetchImpl);
    const result = await service.transcribe({
      ...access,
      bytes: audio,
      filename: "voice.ogg",
      mime: "audio/ogg",
    });
    expect(result).toEqual({ text: "hola mundo", language: "es", durationSeconds: 2.4 });
    expect(calls[0]?.url).toBe("http://asr.local/v1/audio/transcriptions");
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    const form = calls[0]?.init.body as FormData;
    expect(form.get("model")).toBe("small");
    expect(form.get("language")).toBe("es");
    expect((form.get("file") as File).name).toBe("voice.ogg");
  });

  it("lists models, tests the connection, and overrides model and language", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "small" }, { id: "base" }, { id: "small" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ text: "transcrito", language: "en" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const { service } = setup(fetchImpl);
    await expect(service.listModels(access)).resolves.toEqual(["small", "base"]);
    const test = await service.test(access);
    expect(test.ok).toBe(true);
    expect(test.models).toEqual(["small", "base"]);
    await service.transcribe({
      ...access,
      bytes: audio,
      filename: "voice.ogg",
      mime: "audio/ogg",
      model: "large",
      language: "en",
    });
    const form = calls.at(-1)?.init.body as FormData;
    expect(form.get("model")).toBe("large");
    expect(form.get("language")).toBe("en");
  });

  it("returns sanitized provider failures and enforces project scope", async () => {
    const fetchImpl = (async () =>
      new Response("bad key", { status: 401 })) as unknown as typeof fetch;
    const { service } = setup(fetchImpl);
    await expect(
      service.transcribe({ ...access, bytes: audio, filename: "voice.ogg", mime: "audio/ogg" }),
    ).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
    await expect(
      service.transcribe({
        integrationId: "asr1",
        scope: "global",
        bytes: audio,
        filename: "voice.ogg",
        mime: "audio/ogg",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      service.transcribe({
        integrationId: "tg1",
        scope: "project",
        projectSlug: "ventas",
        bytes: audio,
        filename: "voice.ogg",
        mime: "audio/ogg",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CONFIG" });
  });
});
