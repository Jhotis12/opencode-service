import { z } from "zod";

export const ChatScopeSchema = z.enum(["project", "global"]);
export type ChatScope = z.infer<typeof ChatScopeSchema>;

export const ChatRoleSchema = z.enum(["user", "agent", "system"]);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatThreadSchema = z.object({
  id: z.string().min(1),
  scope: ChatScopeSchema,
  projectSlug: z.string().optional(),
  integrationId: z.string().optional(),
  externalThreadId: z.string().optional(),
  opencodeSessionId: z.string().optional(),
  title: z.string().optional(),
  createdAt: z.string(),
  lastActiveAt: z.string(),
});
export type ChatThread = z.infer<typeof ChatThreadSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  role: ChatRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("activity"),
    id: z.string(),
    text: z.string(),
    status: z.enum(["started", "succeeded", "failed"]),
  }),
]);
export type ChatProgressEvent = z.infer<typeof ChatProgressEventSchema>;

export const ProjectSettingsSchema = z.object({
  defaultModel: z.string().optional(),
  primaryAgent: z.string().optional(),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const ProjectRecordSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/),
  name: z.string().min(1),
  description: z.string().default(""),
  defaultModel: z.string().optional(),
  primaryAgent: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});
export type ProjectRecord = z.infer<typeof ProjectRecordSchema>;
