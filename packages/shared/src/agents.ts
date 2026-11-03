import { z } from "zod";

export const AgentModeSchema = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const AgentExecutionContextSchema = z.enum(["chat", "workflow", "external_channel"]);
export type AgentExecutionContext = z.infer<typeof AgentExecutionContextSchema>;

export const PlatformToolNameSchema = z.enum([
  "workflow_list",
  "workflow_get",
  "workflow_upsert",
  "workflow_trigger",
  "workflow_runs",
  "project_overview",
  "subagent_upsert",
  "subagent_list",
  "integration_list",
  "kb_search",
  "db_query",
  "notify",
  "health_summary",
]);
export type PlatformToolName = z.infer<typeof PlatformToolNameSchema>;

export const PermissionRuleSchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  effect: z.enum(["allow", "deny", "ask"]),
});
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

export const SubagentFrontmatterSchema = z.object({
  description: z.string().min(1),
  mode: AgentModeSchema.default("subagent"),
  model: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  steps: z.number().int().positive().optional(),
  hidden: z.boolean().optional(),
  permissions: z.array(PermissionRuleSchema).default([]),
  notebooks: z.array(z.string()).default([]),
});
export type SubagentFrontmatter = z.infer<typeof SubagentFrontmatterSchema>;

export const SubagentProfileSchema = z.object({
  category: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  role: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  frontmatter: SubagentFrontmatterSchema,
  body: z.string(),
  path: z.string().optional(),
});
export type SubagentProfile = z.infer<typeof SubagentProfileSchema>;

export const ModelRefSchema = z.object({
  providerID: z.string().min(1),
  modelID: z.string().min(1),
  variant: z.string().optional(),
});
export type ModelRef = z.infer<typeof ModelRefSchema>;

export function modelRefToString(ref: ModelRef): string {
  return `${ref.providerID}/${ref.modelID}${ref.variant ? `#${ref.variant}` : ""}`;
}

export function parseModelRef(value: string): ModelRef | undefined {
  const [providerID, rest] = value.split("/");
  if (!providerID || !rest) return undefined;
  const [modelID, variant] = rest.split("#");
  if (!modelID) return undefined;
  return { providerID, modelID, ...(variant ? { variant } : {}) };
}

export function evaluateToolPermission(input: {
  tool: string;
  context?: AgentExecutionContext;
  permissions?: PermissionRule[];
}): { allowed: boolean; reason?: string } {
  const rules = input.permissions ?? [];
  const context = input.context ?? "chat";
  const matchesRule = (rule: PermissionRule) =>
    (rule.action === "tool" || rule.action === "*" || rule.action === input.tool) &&
    (rule.resource === input.tool || rule.resource === "*" || rule.resource === `platform_${input.tool}`);

  const denied = rules.find((rule) => matchesRule(rule) && rule.effect === "deny");
  if (denied) {
    return { allowed: false, reason: `permission denied by agent rule for tool ${input.tool}` };
  }
  const explicitlyAllowed = rules.some((rule) => matchesRule(rule) && rule.effect === "allow");
  if (
    (context === "workflow" || context === "external_channel") &&
    (input.tool === "workflow_upsert" || input.tool === "subagent_upsert") &&
    !explicitlyAllowed
  ) {
    return {
      allowed: false,
      reason: `tool ${input.tool} is blocked in ${context} context without explicit allow permission`,
    };
  }
  return { allowed: true };
}
