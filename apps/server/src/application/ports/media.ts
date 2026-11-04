import type { MediaRef } from "@platform/shared";

export type MediaScope = "project" | "global";

export class MediaStoreError extends Error {
  constructor(
    public readonly code: "UNSUPPORTED_TYPE" | "TOO_LARGE" | "UNSAFE_PATH" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "MediaStoreError";
  }
}

export interface SaveMediaInput {
  scope: MediaScope;
  projectSlug?: string;
  filename?: string;
  mime?: string;
  bytes: Uint8Array;
  durationSeconds?: number;
}

export interface MediaStorePort {
  save(input: SaveMediaInput): Promise<MediaRef>;
  resolve(input: { scope: MediaScope; projectSlug?: string; media: MediaRef }): Promise<string>;
}

export const MEDIA_MAX_BYTES = 20 * 1024 * 1024;
export const MEDIA_MAX_DURATION_SECONDS = 300;
