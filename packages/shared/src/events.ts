import { z } from "zod";
import { StepStatusSchema, WorkflowGraphSchema } from "./workflow.ts";
import { EntryPointTypeSchema } from "./telemetry.ts";

export const SseEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("workflow.updated"),
    projectSlug: z.string(),
    graph: WorkflowGraphSchema,
  }),
  z.object({
    type: z.literal("run.updated"),
    projectSlug: z.string(),
    runId: z.string(),
    workflowId: z.string(),
    status: z.string(),
    nodeId: z.string().optional(),
    stepStatus: StepStatusSchema.optional(),
    output: z.unknown().optional(),
    error: z.string().optional(),
  }),
  z.object({
    type: z.literal("agent.updated"),
    projectSlug: z.string(),
    agentId: z.string(),
  }),
  z.object({
    type: z.literal("project.deleted"),
    projectSlug: z.string(),
  }),
  z.object({
    type: z.literal("integration.status"),
    integrationId: z.string(),
    scope: z.enum(["project", "global"]),
    projectSlug: z.string().optional(),
    status: z.string(),
    qr: z.string().optional(),
    detail: z.string().optional(),
  }),
  z.object({
    type: z.literal("system.error"),
    entryPoint: EntryPointTypeSchema,
    message: z.string(),
  }),
  z.object({
    type: z.literal("chat.turn.updated"),
    turnId: z.string(),
    threadId: z.string(),
    scope: z.enum(["project", "global"]),
    projectSlug: z.string().optional(),
    status: z.string(),
    activity: z.string().optional(),
  }),
  z.object({
    type: z.literal("ping"),
    at: z.string(),
  }),
]);
export type SseEvent = z.infer<typeof SseEventSchema>;

export const ChatMessageRequestSchema = z.object({
  threadId: z.string().min(1).max(200),
  message: z.string().min(1).max(20_000),
  metadata: z.record(z.unknown()).optional(),
  webhookUrl: z.string().url().optional(),
  clientMessageId: z.string().min(1).max(200).optional(),
});
export type ChatMessageRequest = z.infer<typeof ChatMessageRequestSchema>;

export const ChatMessageResponseSchema = z.object({
  threadId: z.string(),
  sessionId: z.string(),
  turnId: z.string().optional(),
  reply: z.string(),
});
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;
