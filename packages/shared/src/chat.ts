import { z } from "zod";
import { MediaRefSchema } from "./media.ts";

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
  attachments: z.array(MediaRefSchema).optional(),
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

export const ChatTurnStatusSchema = z.enum([
  "queued",
  "running",
  "recovering",
  "retrying",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
  "interrupted",
  "unknown",
]);
export type ChatTurnStatus = z.infer<typeof ChatTurnStatusSchema>;

export const ChatTurnErrorCodeSchema = z.enum([
  "transport_interrupted",
  "opencode_unavailable",
  "session_not_found",
  "execution_failed",
  "execution_interrupted",
  "empty_reply",
  "not_delivered",
  "model_missing",
  "agent_missing",
  "turn_timeout",
  "cancelled",
  "delivery_failed",
  "unknown",
]);
export type ChatTurnErrorCode = z.infer<typeof ChatTurnErrorCodeSchema>;

export const ChatTurnUsageSchema = z
  .object({
    cost: z.number().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    reasoningTokens: z.number().optional(),
    busyMs: z.number().optional(),
    idleMs: z.number().optional(),
  })
  .partial();
export type ChatTurnUsage = z.infer<typeof ChatTurnUsageSchema>;

export const ChatTurnSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  scope: ChatScopeSchema,
  projectSlug: z.string().optional(),
  integrationId: z.string().optional(),
  externalThreadId: z.string().optional(),
  sessionId: z.string().optional(),
  userMessageId: z.string().optional(),
  assistantMessageId: z.string().optional(),
  inboxId: z.string().optional(),
  assistantOpencodeMessageId: z.string().optional(),
  status: ChatTurnStatusSchema,
  deliveryState: z.enum(["created", "enqueued", "delivered", "completed"]).default("created"),
  attempt: z.number().int().nonnegative().default(0),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  lastActivityAt: z.string(),
  lastSeq: z.number().optional(),
  errorCode: ChatTurnErrorCodeSchema.optional(),
  errorMessage: z.string().optional(),
  usage: ChatTurnUsageSchema.optional(),
  hasSideEffects: z.boolean().optional(),
  idempotencyKey: z.string().optional(),
  entryPoint: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const ChatTurnHistoryMessageSchema = ChatMessageSchema.extend({
  turnId: z.string().optional(),
  turnStatus: ChatTurnStatusSchema.optional(),
  errorCode: ChatTurnErrorCodeSchema.optional(),
  attachments: z.array(MediaRefSchema).optional(),
});
export type ChatTurnHistoryMessage = z.infer<typeof ChatTurnHistoryMessageSchema>;

export const ChatTurnEventSchema = z.union([
  z.object({ type: z.literal("turn"), turn: ChatTurnSchema }),
  z.object({
    type: z.literal("status"),
    turnId: z.string(),
    status: ChatTurnStatusSchema,
    text: z.string().optional(),
  }),
  z.object({ type: z.literal("text"), turnId: z.string(), text: z.string() }),
  z.object({
    type: z.literal("activity"),
    turnId: z.string(),
    id: z.string(),
    text: z.string(),
    status: z.enum(["started", "succeeded", "failed"]),
  }),
  z.object({
    type: z.literal("done"),
    turnId: z.string(),
    status: ChatTurnStatusSchema,
    reply: z.string(),
    messageId: z.string().optional(),
    sessionId: z.string().optional(),
    threadId: z.string(),
    startedAt: z.string(),
    finishedAt: z.string().optional(),
    usage: ChatTurnUsageSchema.optional(),
  }),
  z.object({
    type: z.literal("error"),
    turnId: z.string(),
    code: ChatTurnErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
  z.object({ type: z.literal("gap"), turnId: z.string(), fromSeq: z.number().optional() }),
  z.object({ type: z.literal("heartbeat"), at: z.string() }),
]);
export type ChatTurnEvent = z.infer<typeof ChatTurnEventSchema>;

export const ProjectSettingsSchema = z.object({
  defaultModel: z.string().optional(),
  primaryAgent: z.string().optional(),
  approvalIntegrationId: z.string().optional(),
  approvalRecipient: z.string().optional(),
  transcriptionIntegrationId: z.string().optional(),
  speechIntegrationId: z.string().optional(),
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
