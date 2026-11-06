import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { IntegrationRecord } from "../../../domain/entities.ts";
import type { Logger, Metrics } from "../../../domain/telemetry/index.ts";
import {
  SPEECH_MAX_CHARS,
  SpeechError,
  type SpeechAccess,
  type SpeechPort,
  type SpeechRequest,
  type SpeechResult,
  type SpeechTestResult,
} from "../../../application/ports/speech.ts";
import { detectMediaType } from "../media/fs-media-store.ts";

interface Connection {
  integration: IntegrationRecord;
  apiKey?: string;
}

const FORMAT_MIME = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
} as const;

export class OpenAiCompatibleSpeechService implements SpeechPort {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      fetchImpl?: typeof fetch;
      logger?: Logger;
      metrics?: Metrics;
    },
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  async synthesize(input: SpeechRequest): Promise<SpeechResult> {
    const started = Date.now();
    const connection = this.resolve(input);
    const config = connection.integration.config;
    const text = input.text.trim();
    if (!text) throw new SpeechError("INVALID_CONFIG", "speech text is empty");
    if (text.length > SPEECH_MAX_CHARS) {
      throw new SpeechError("INVALID_CONFIG", `speech text exceeds ${SPEECH_MAX_CHARS} characters`);
    }
    const model = input.model ?? String(config.model ?? "");
    const voice = input.voice ?? String(config.voice ?? "");
    if (!model) throw new SpeechError("INVALID_CONFIG", "speech model is not configured");
    if (!voice) throw new SpeechError("INVALID_CONFIG", "speech voice is not configured");
    const speed = input.speed ?? Number(config.speed ?? 1);
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new SpeechError("INVALID_CONFIG", "speech speed must be between 0.5 and 2");
    }
    const format = input.format ?? (config.responseFormat as SpeechRequest["format"]) ?? "mp3";

    this.deps.metrics?.increment("speech_requests");
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl(connection.integration)}/audio/speech`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: format,
          speed,
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
      });
    } catch (error) {
      this.failed(started, connection, model, voice, text.length, error);
      throw new SpeechError(
        "PROVIDER_ERROR",
        `speech provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      const error = new SpeechError("PROVIDER_ERROR", `speech provider returned ${response.status}`);
      this.failed(started, connection, model, voice, text.length, error);
      throw error;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      const error = new SpeechError("EMPTY_AUDIO", "speech provider returned empty audio");
      this.failed(started, connection, model, voice, text.length, error);
      throw error;
    }
    const detected = detectMediaType(bytes);
    if (!detected || detected.kind !== "audio" || detected.mime !== FORMAT_MIME[format]) {
      const error = new SpeechError(
        "UNSUPPORTED_FORMAT",
        `speech provider returned unexpected audio${detected ? `: ${detected.mime}` : ""}`,
      );
      this.failed(started, connection, model, voice, text.length, error);
      throw error;
    }
    this.deps.metrics?.increment("speech_succeeded");
    this.deps.logger?.info({
      event: "speech_completed",
      projectSlug: input.projectSlug,
      integrationId: input.integrationId,
      model,
      voice,
      chars: text.length,
      durationMs: Date.now() - started,
      bytes: bytes.byteLength,
      format,
    });
    return { bytes, mime: detected.mime };
  }

  async listModels(input: SpeechAccess): Promise<string[]> {
    const connection = this.resolve(input);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl(connection.integration)}/models`, {
        headers: connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new SpeechError(
        "PROVIDER_ERROR",
        `speech provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) throw new SpeechError("PROVIDER_ERROR", `speech provider returned ${response.status}`);
    const payload = (await response.json().catch(() => undefined)) as
      | { data?: unknown[]; models?: unknown[] }
      | undefined;
    const raw = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    const models = raw
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof (item as { id?: unknown })?.id === "string"
            ? (item as { id: string }).id
            : typeof (item as { name?: unknown })?.name === "string"
              ? (item as { name: string }).name
              : undefined,
      )
      .filter((item): item is string => Boolean(item));
    return [...new Set(models)].slice(0, 200);
  }

  async test(input: SpeechAccess): Promise<SpeechTestResult> {
    const started = Date.now();
    try {
      const sample = await this.synthesize({ ...input, text: "Prueba de voz.", timeoutMs: 30_000 });
      const models = await this.listModels(input).catch(() => []);
      return {
        ok: true,
        detail: `${sample.bytes.byteLength} bytes`,
        latencyMs: Date.now() - started,
        models,
      };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - started,
      };
    }
  }

  private failed(
    started: number,
    connection: Connection,
    model: string,
    voice: string,
    chars: number,
    error: unknown,
  ): void {
    this.deps.metrics?.increment("speech_failed");
    this.deps.logger?.error({
      event: "speech_failed",
      projectSlug: connection.integration.projectSlug,
      integrationId: connection.integration.id,
      model,
      voice,
      chars,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  private baseUrl(integration: IntegrationRecord): string {
    const value = String(integration.config.baseUrl ?? "").replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(value)) {
      throw new SpeechError("INVALID_CONFIG", "speech base URL must be an http(s) URL");
    }
    return value;
  }

  private resolve(input: SpeechAccess): Connection {
    const integration = this.deps.store.integrations.findById(input.integrationId);
    if (!integration) throw new SpeechError("NOT_FOUND", "speech integration not found");
    if (integration.scope !== input.scope || (input.scope === "project" && integration.projectSlug !== input.projectSlug)) {
      throw new SpeechError("FORBIDDEN", "speech integration belongs to another scope");
    }
    if (integration.kind !== "speech" || !integration.capabilities.includes("synthesize_speech")) {
      throw new SpeechError("INVALID_CONFIG", "integration is not a speech integration");
    }
    const alias = integration.secretRefs.apiKey;
    let apiKey: string | undefined;
    if (alias) {
      const secret = this.deps.store.vault.findByAlias({
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        alias,
      });
      if (!secret) throw new SpeechError("MISSING_CREDENTIAL", "speech API key is missing");
      apiKey = this.deps.vault.decrypt(secret.ciphertext);
    }
    return { integration, apiKey };
  }
}
