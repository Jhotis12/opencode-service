import { z } from "zod";

export const AgentModeSchema = z.enum(["primary", "subagent", "all"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

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
