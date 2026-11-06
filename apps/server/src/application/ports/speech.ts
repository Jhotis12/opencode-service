import type { MediaScope } from "./media.ts";

export interface SpeechAccess {
  integrationId: string;
  scope: MediaScope;
  projectSlug?: string;
}

export interface SpeechRequest extends SpeechAccess {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  format?: "mp3" | "wav" | "flac";
  timeoutMs?: number;
}

export interface SpeechResult {
  bytes: Uint8Array;
  mime: string;
}

export interface SpeechTestResult {
  ok: boolean;
  detail?: string;
  latencyMs?: number;
  models?: string[];
  voices?: string[];
}

export class SpeechError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_CONFIG"
      | "MISSING_CREDENTIAL"
      | "PROVIDER_ERROR"
      | "EMPTY_AUDIO"
      | "UNSUPPORTED_FORMAT",
    message: string,
  ) {
    super(message);
    this.name = "SpeechError";
  }
}

export interface SpeechPort {
  synthesize(input: SpeechRequest): Promise<SpeechResult>;
  listModels(input: SpeechAccess): Promise<string[]>;
  test(input: SpeechAccess): Promise<SpeechTestResult>;
}

export const SPEECH_MAX_CHARS = 4_000;
