import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MediaRefSchema, type MediaRef } from "@platform/shared";
import { resolvePath } from "./workflow/template.ts";

export class MediaAttachmentError extends Error {
  constructor(
    public readonly code: "UNSAFE_PATH" | "TOO_MANY" | "NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "MediaAttachmentError";
  }
}

export interface ResolvedAttachment {
  uri: string;
  name?: string;
  description?: string;
}

const MAX_ATTACHMENTS = 5;

export function resolveMediaPath(root: string, media: MediaRef): string {
  const relativePath = media.path.replaceAll("\\", "/").replace(/^\.\//, "");
  if (isAbsolute(relativePath) || !relativePath.startsWith(".opencode/media/")) {
    throw new MediaAttachmentError("UNSAFE_PATH", `media path is outside the managed area: ${media.path}`);
  }
  const absolute = resolve(root, relativePath);
  const relation = relative(root, absolute);
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) {
    throw new MediaAttachmentError("UNSAFE_PATH", `media path escapes the workspace: ${media.path}`);
  }
  return absolute;
}

export function toAttachmentFiles(root: string, media: MediaRef[] | undefined): ResolvedAttachment[] {
  const images = (media ?? []).filter((item) => item.kind === "image");
  if (images.length > MAX_ATTACHMENTS) {
    throw new MediaAttachmentError("TOO_MANY", `a turn can attach at most ${MAX_ATTACHMENTS} images`);
  }
  return images.map((item) => {
    const absolute = resolveMediaPath(root, item);
    return {
      uri: pathToFileURL(absolute).href,
      ...(item.filename ? { name: item.filename } : {}),
    };
  });
}

export function collectMedia(input: unknown, mediaPath: string): MediaRef[] {
  const value = resolvePath(input, mediaPath);
  const candidates = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const refs: MediaRef[] = [];
  for (const candidate of candidates) {
    const parsed = MediaRefSchema.safeParse(candidate);
    if (parsed.success) refs.push(parsed.data);
  }
  return refs;
}

export async function readMedia(root: string, media: MediaRef): Promise<{ bytes: Uint8Array; filename: string }> {
  const absolute = resolveMediaPath(root, media);
  try {
    return { bytes: new Uint8Array(await readFile(absolute)), filename: media.filename ?? basename(absolute) };
  } catch {
    throw new MediaAttachmentError("NOT_FOUND", `media file not found: ${media.path}`);
  }
}
