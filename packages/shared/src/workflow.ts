import { z } from "zod";

export const NodeTypeSchema = z.enum([
  "trigger",
  "code",
  "agent",
  "decision",
  "approval",
  "http",
  "delay",
  "transform",
  "validate",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const TriggerKindSchema = z.enum(["manual", "schedule", "webhook", "integration"]);
export type TriggerKind = z.infer<typeof TriggerKindSchema>;

export const InputFieldTypeSchema = z.enum(["string", "number", "boolean", "json"]);
export type InputFieldType = z.infer<typeof InputFieldTypeSchema>;

export const InputFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  type: InputFieldTypeSchema.default("string"),
  required: z.boolean().default(false),
  description: z.string().optional(),
  example: z.unknown().optional(),
});
export type InputField = z.infer<typeof InputFieldSchema>;

export const InputSchemaSchema = z.object({
  fields: z.array(InputFieldSchema).default([]),
});
export type InputSchema = z.infer<typeof InputSchemaSchema>;

export const ValidateRuleSchema = InputFieldSchema.extend({
  message: z.string().optional(),
});
export type ValidateRule = z.infer<typeof ValidateRuleSchema>;

export const ValidateConfigSchema = z.object({
  rules: z.array(ValidateRuleSchema).min(1),
});
export type ValidateConfig = z.infer<typeof ValidateConfigSchema>;

export const TriggerConfigSchema = z.object({
  kind: TriggerKindSchema.default("manual"),
  cron: z.string().optional(),
  integrationId: z.string().optional(),
  event: z.string().optional(),
  inputSchema: InputSchemaSchema.optional(),
});
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

export const NodeSpecSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/, "node id must be kebab-case"),
  type: NodeTypeSchema,
  label: z.string().min(1).optional(),
  position: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  config: z.record(z.unknown()).default({}),
  codeFile: z.string().optional(),
  agentId: z.string().optional(),
  modelOverride: z.string().optional(),
  notebookIds: z.array(z.string()).default([]),
  timeoutMs: z.number().int().positive().max(600_000).default(30_000),
  retryPolicy: z.object({ maxRetries: z.number().int().min(0).max(5) }).default({ maxRetries: 0 }),
});
export type NodeSpec = z.infer<typeof NodeSpecSchema>;

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  condition: z.string().optional(),
});
export type Edge = z.infer<typeof EdgeSchema>;

export const WorkflowGraphSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  defaultModel: z.string().optional(),
  nodes: z.array(NodeSpecSchema).min(1),
  edges: z.array(EdgeSchema).default([]),
  updatedAt: z.string(),
});
export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;

export const WorkflowRunStatusSchema = z.enum([
  "running",
  "paused",
  "succeeded",
  "failed",
  "timed_out",
  "cancelled",
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const StepStatusSchema = z.enum(["running", "succeeded", "failed", "timed_out", "skipped"]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const RunProvenanceSchema = z.object({
  launchedBy: z.string().optional(),
  graphHash: z.string().optional(),
  integrationId: z.string().optional(),
  sourceDetail: z.string().optional(),
});
export type RunProvenance = z.infer<typeof RunProvenanceSchema>;

export const StepCheckpointSchema = z.object({
  runId: z.string(),
  nodeId: z.string(),
  status: StepStatusSchema,
  input: z.unknown(),
  output: z.unknown().optional(),
  model: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
  startedAt: z.string(),
  finishedAt: z.string().optional(),
  error: z.string().optional(),
});
export type StepCheckpoint = z.infer<typeof StepCheckpointSchema>;
