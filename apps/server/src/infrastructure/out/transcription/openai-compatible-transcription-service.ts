import type { Store } from "../../../application/ports/store.ts";
import type { SecretVault } from "../../../application/ports/security.ts";
import type { IntegrationRecord } from "../../../domain/entities.ts";
import {
  TranscriptionError,
  type TranscriptionAccess,
  type TranscriptionPort,
  type TranscriptionRequest,
  type TranscriptionResult,
  type TranscriptionTestResult,
} from "../../../application/ports/transcription.ts";

interface Connection {
  integration: IntegrationRecord;
  apiKey?: string;
}

export class OpenAiCompatibleTranscriptionService implements TranscriptionPort {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly deps: {
      store: Store;
      vault: SecretVault;
      fetchImpl?: typeof fetch;
    },
  ) {
    this.fetchImpl = deps.fetchImpl ?? fetch;
  }

  async transcribe(input: TranscriptionRequest): Promise<TranscriptionResult> {
    const connection = this.resolve(input);
    const config = connection.integration.config;
    const model = input.model ?? String(config.model ?? "");
    if (!model) throw new TranscriptionError("INVALID_CONFIG", "transcription model is not configured");
    const form = new FormData();
    form.append("file", new Blob([input.bytes as unknown as BlobPart], { type: input.mime }), input.filename);
    form.append("model", model);
    const language = input.language ?? (typeof config.language === "string" ? config.language : undefined);
    if (language) form.append("language", language);
    if (input.prompt) form.append("prompt", input.prompt);
    form.append("response_format", "json");

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl(connection.integration)}/audio/transcriptions`, {
        method: "POST",
        headers: connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : {},
        body: form,
        signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
      });
    } catch (error) {
      throw new TranscriptionError(
        "PROVIDER_ERROR",
        `transcription provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const raw = await response.text().catch(() => "");
    if (!response.ok) {
      throw new TranscriptionError(
        "PROVIDER_ERROR",
        `transcription provider returned ${response.status}: ${raw.slice(0, 300)}`,
      );
    }
    let payload: unknown = raw.trim();
    try {
      payload = JSON.parse(raw);
    } catch {
      // Some compatible providers return plain text for response_format=json.
    }
    const text =
      typeof payload === "string"
        ? payload.trim()
        : typeof (payload as { text?: unknown })?.text === "string"
          ? (payload as { text: string }).text.trim()
          : typeof (payload as { transcription?: unknown })?.transcription === "string"
            ? (payload as { transcription: string }).transcription.trim()
            : "";
    if (!text) throw new TranscriptionError("EMPTY_TRANSCRIPT", "transcription provider returned an empty transcript");
    const duration =
      typeof (payload as { duration?: unknown })?.duration === "number"
        ? (payload as { duration: number }).duration
        : typeof (payload as { duration_seconds?: unknown })?.duration_seconds === "number"
          ? (payload as { duration_seconds: number }).duration_seconds
          : undefined;
    return {
      text,
      ...(typeof (payload as { language?: unknown })?.language === "string"
        ? { language: (payload as { language: string }).language }
        : language
          ? { language }
          : {}),
      ...(duration !== undefined ? { durationSeconds: duration } : {}),
    };
  }

  async listModels(input: TranscriptionAccess): Promise<string[]> {
    const connection = this.resolve(input);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl(connection.integration)}/models`, {
        headers: connection.apiKey ? { authorization: `Bearer ${connection.apiKey}` } : {},
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new TranscriptionError(
        "PROVIDER_ERROR",
        `transcription provider request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) {
      throw new TranscriptionError("PROVIDER_ERROR", `transcription provider returned ${response.status}`);
    }
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

  async test(input: TranscriptionAccess): Promise<TranscriptionTestResult> {
    const started = Date.now();
    try {
      const models = await this.listModels(input);
      return {
        ok: true,
        detail: `${models.length} modelos disponibles`,
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

  private baseUrl(integration: IntegrationRecord): string {
    const value = String(integration.config.baseUrl ?? "").replace(/\/+$/, "");
    if (!/^https?:\/\//i.test(value)) {
      throw new TranscriptionError("INVALID_CONFIG", "transcription base URL must be an http(s) URL");
    }
    return value;
  }

  private resolve(input: TranscriptionAccess): Connection {
    const integration = this.deps.store.integrations.findById(input.integrationId);
    if (!integration) throw new TranscriptionError("NOT_FOUND", "transcription integration not found");
    if (integration.scope !== input.scope || (input.scope === "project" && integration.projectSlug !== input.projectSlug)) {
      throw new TranscriptionError("FORBIDDEN", "transcription integration belongs to another scope");
    }
    if (integration.kind !== "transcription") {
      throw new TranscriptionError("INVALID_CONFIG", "integration is not a transcription integration");
    }
    const alias = integration.secretRefs.apiKey;
    let apiKey: string | undefined;
    if (alias) {
      const secret = this.deps.store.vault.findByAlias({
        scope: integration.scope,
        projectSlug: integration.projectSlug,
        alias,
      });
      if (!secret) throw new TranscriptionError("MISSING_CREDENTIAL", "transcription API key is missing");
      apiKey = this.deps.vault.decrypt(secret.ciphertext);
    }
    return { integration, apiKey };
  }
}
