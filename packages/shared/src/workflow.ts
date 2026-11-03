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
  "database",
  "notify",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const TriggerKindSchema = z.enum(["manual", "schedule", "webhook", "integration"]);
export type TriggerKind = z.infer<typeof TriggerKindSchema>;

export const ScheduleTimezoneSchema = z.string().min(1).refine((timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}, "timezone must be a valid IANA timezone");

export const ScheduleOverlapPolicySchema = z.enum(["skip", "allow"]);
export type ScheduleOverlapPolicy = z.infer<typeof ScheduleOverlapPolicySchema>;

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
  mode: z.enum(["cron", "once"]).default("cron"),
  runAt: z.string().datetime().optional(),
  timezone: ScheduleTimezoneSchema.default("UTC"),
  enabled: z.boolean().default(true),
  overlapPolicy: ScheduleOverlapPolicySchema.default("skip"),
  catchUp: z.boolean().default(false),
  catchUpWindowMinutes: z.number().int().min(0).max(1_440).default(60),
  secretAlias: z.string().optional(),
  integrationId: z.string().optional(),
  event: z.string().optional(),
  inputSchema: InputSchemaSchema.optional(),
});
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;

export const AgentNodeConfigSchema = z.object({
  instruction: z.string().optional(),
  strictGrounding: z.boolean().optional(),
  outputSchema: InputSchemaSchema.optional(),
});
export type AgentNodeConfig = z.infer<typeof AgentNodeConfigSchema>;

export const DatabaseStatementSchema = z.object({
  sql: z.string().min(1),
  params: z.unknown().optional(),
});
export type DatabaseStatement = z.infer<typeof DatabaseStatementSchema>;

export const DatabaseNodeConfigSchema = z.object({
  integrationId: z.string().min(1),
  mode: z.enum(["read", "write"]).default("read"),
  statements: z.array(DatabaseStatementSchema).min(1),
  transaction: z.boolean().optional(),
  maxRows: z.number().int().positive().max(10_000).optional(),
});
export type DatabaseNodeConfig = z.infer<typeof DatabaseNodeConfigSchema>;

export const NotifyNodeConfigSchema = z.object({
  integrationId: z.string().min(1),
  recipient: z.string().min(1).optional(),
  text: z.string().min(1),
  actionKey: z.string().min(1).optional(),
});
export type NotifyNodeConfig = z.infer<typeof NotifyNodeConfigSchema>;

export const ProjectTemplateSchema = z.enum(["blank", "triaje-operativo"]);
export type ProjectTemplate = z.infer<typeof ProjectTemplateSchema>;

export const NodeErrorStrategySchema = z.enum(["stop", "continue", "route"]);
export type NodeErrorStrategy = z.infer<typeof NodeErrorStrategySchema>;

export const NodeErrorPolicySchema = z
  .object({
    strategy: NodeErrorStrategySchema.default("stop"),
    target: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.strategy === "route" && !value.target) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target"],
        message: "route strategy requires a target node",
      });
    }
  });
export type NodeErrorPolicy = z.infer<typeof NodeErrorPolicySchema>;

export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5).default(0),
  backoffMs: z.number().int().min(0).max(60_000).optional(),
  backoffMultiplier: z.number().min(1).max(10).optional(),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

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
  retryPolicy: RetryPolicySchema.default({ maxRetries: 0 }),
  onError: NodeErrorPolicySchema.optional(),
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
  versionId: z.string().optional(),
  integrationId: z.string().optional(),
  sourceDetail: z.string().optional(),
});
export type RunProvenance = z.infer<typeof RunProvenanceSchema>;

export const WorkflowVersionSchema = z.object({
  id: z.string().min(1),
  projectSlug: z.string().min(1),
  version: z.number().int().positive(),
  graphHash: z.string().min(1),
  graph: WorkflowGraphSchema,
  codeBundle: z.record(z.string()).default({}),
  createdBy: z.string().optional(),
  createdAt: z.string().min(1),
});
export type WorkflowVersion = z.infer<typeof WorkflowVersionSchema>;

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
