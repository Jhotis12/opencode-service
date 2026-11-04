import { z } from "zod";

export const MediaKindSchema = z.enum(["image", "audio"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

/**
 * A media file captured by a channel and stored inside the owning workspace.
 * `path` is always relative to the project (or control) root.
 */
export const MediaRefSchema = z.object({
  kind: MediaKindSchema,
  path: z.string().min(1),
  filename: z.string().min(1).optional(),
  mime: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().nonnegative().optional(),
});
export type MediaRef = z.infer<typeof MediaRefSchema>;
