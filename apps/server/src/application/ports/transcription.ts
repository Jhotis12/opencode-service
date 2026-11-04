import type { MediaScope } from "./media.ts";

export interface TranscriptionAccess {
  integrationId: string;
  scope: MediaScope;
  projectSlug?: string;
}

export interface TranscriptionRequest extends TranscriptionAccess {
  bytes: Uint8Array;
  filename: string;
  mime: string;
  model?: string;
  language?: string;
  prompt?: string;
  timeoutMs?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  durationSeconds?: number;
}

export interface TranscriptionTestResult {
  ok: boolean;
  detail?: string;
  latencyMs?: number;
  models?: string[];
}

export class TranscriptionError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_CONFIG"
      | "MISSING_CREDENTIAL"
      | "PROVIDER_ERROR"
      | "EMPTY_TRANSCRIPT",
    message: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export interface TranscriptionPort {
  transcribe(input: TranscriptionRequest): Promise<TranscriptionResult>;
  listModels(input: TranscriptionAccess): Promise<string[]>;
  test(input: TranscriptionAccess): Promise<TranscriptionTestResult>;
}
