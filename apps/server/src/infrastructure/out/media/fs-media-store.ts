import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, normalize, relative, resolve } from "node:path";
import type { MediaRef } from "@platform/shared";
import {
  MEDIA_MAX_BYTES,
  MEDIA_MAX_DURATION_SECONDS,
  MediaStoreError,
  type MediaScope,
  type MediaStorePort,
  type SaveMediaInput,
} from "../../../application/ports/media.ts";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,60}$/;

interface DetectedMedia {
  kind: "image" | "audio";
  mime: string;
  extension: string;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes[index] === value);
}

export function detectMediaType(bytes: Uint8Array): DetectedMedia | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: "image", mime: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "image", mime: "image/png", extension: "png" };
  }
  if (ascii(bytes, 0, 4) === "GIF8") return { kind: "image", mime: "image/gif", extension: "gif" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return { kind: "image", mime: "image/webp", extension: "webp" };
  }
  if (ascii(bytes, 0, 4) === "OggS") return { kind: "audio", mime: "audio/ogg", extension: "ogg" };
  if (ascii(bytes, 0, 4) === "fLaC") return { kind: "audio", mime: "audio/flac", extension: "flac" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE") {
    return { kind: "audio", mime: "audio/wav", extension: "wav" };
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: "audio", mime: "audio/webm", extension: "webm" };
  }
  if (ascii(bytes, 4, 4) === "ftyp") return { kind: "audio", mime: "audio/mp4", extension: "m4a" };
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0)) {
    return { kind: "audio", mime: "audio/mpeg", extension: "mp3" };
  }
  return undefined;
}

function safeFilename(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const name = basename(value).replace(/[^\w.\-()]+/g, "_").trim();
  return name ? name.slice(0, 200) : undefined;
}

export class FsMediaStore implements MediaStorePort {
  constructor(
    private readonly options: {
      workspacesDir: string;
      controlDirectory: string;
    },
  ) {}

  async save(input: SaveMediaInput): Promise<MediaRef> {
    if (input.bytes.byteLength > MEDIA_MAX_BYTES) {
      throw new MediaStoreError("TOO_LARGE", `media exceeds ${MEDIA_MAX_BYTES} bytes`);
    }
    if (input.durationSeconds !== undefined && input.durationSeconds > MEDIA_MAX_DURATION_SECONDS) {
      throw new MediaStoreError("TOO_LARGE", `audio exceeds ${MEDIA_MAX_DURATION_SECONDS} seconds`);
    }
    const detected = detectMediaType(input.bytes);
    if (!detected) {
      throw new MediaStoreError("UNSUPPORTED_TYPE", `unsupported media type${input.mime ? `: ${input.mime}` : ""}`);
    }
    const root = this.rootFor(input.scope, input.projectSlug);
    const directory = join(root, ".opencode", "media");
    await mkdir(directory, { recursive: true });
    const hash = createHash("sha256").update(input.bytes).digest("hex");
    const extension = detected.extension;
    const absolute = join(directory, `${hash}.${extension}`);
    try {
      await writeFile(absolute, input.bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return {
      kind: detected.kind,
      path: `.opencode/media/${hash}.${extension}`,
      filename: safeFilename(input.filename) ?? `${hash}.${extension}`,
      mime: detected.mime,
      size: input.bytes.byteLength,
      ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    };
  }

  async resolve(input: { scope: MediaScope; projectSlug?: string; media: MediaRef }): Promise<string> {
    const relativePath = normalize(input.media.path).replaceAll("\\", "/");
    if (isAbsolute(relativePath) || !relativePath.startsWith(".opencode/media/")) {
      throw new MediaStoreError("UNSAFE_PATH", `media path is outside the managed area: ${input.media.path}`);
    }
    const root = this.rootFor(input.scope, input.projectSlug);
    const absolute = resolve(root, relativePath);
    const relation = relative(root, absolute);
    if (!relation || relation.startsWith("..") || isAbsolute(relation)) {
      throw new MediaStoreError("UNSAFE_PATH", `media path escapes the workspace: ${input.media.path}`);
    }
    try {
      await stat(absolute);
    } catch {
      throw new MediaStoreError("NOT_FOUND", `media file not found: ${input.media.path}`);
    }
    return absolute;
  }

  private rootFor(scope: MediaScope, projectSlug?: string): string {
    if (scope === "global") return this.options.controlDirectory;
    if (!projectSlug || !SLUG_PATTERN.test(projectSlug)) {
      throw new MediaStoreError("UNSAFE_PATH", "project media requires a valid project slug");
    }
    return join(this.options.workspacesDir, projectSlug);
  }
}
