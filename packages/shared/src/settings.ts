import { z } from "zod";

/** Modelo por defecto de plataforma, orquestador y proyectos sin override. */
export const PLATFORM_DEFAULT_MODEL = "opencode/deepseek-v4.1-flash-free";

export const EffectiveConfigSourceSchema = z.enum([
  "entity",
  "project",
  "platform",
  "environment",
  "default",
]);
export type EffectiveConfigSource = z.infer<typeof EffectiveConfigSourceSchema>;

export const EffectiveSettingSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.unknown(),
  source: EffectiveConfigSourceSchema,
  secret: z.boolean().default(false),
  masked: z.string().optional(),
  editable: z.boolean(),
  restartRequired: z.boolean().default(false),
});
export type EffectiveSetting = z.infer<typeof EffectiveSettingSchema>;

export const EffectiveConfigSchema = z.object({
  platform: z.array(EffectiveSettingSchema),
  project: z.array(EffectiveSettingSchema).optional(),
});
export type EffectiveConfig = z.infer<typeof EffectiveConfigSchema>;

export const PlatformSettingsSchema = z.object({
  defaultModel: z.string().optional(),
  orchestratorModel: z.string().optional(),
  sentryDsn: z.string().url().optional(),
  opencodeMode: z.enum(["auto", "service", "fake"]).default("auto"),
  sessionTtlHours: z.number().positive().default(168),
  agentTurnMaxMs: z.number().positive().default(1_800_000),
  agentTurnIdleMs: z.number().positive().default(600_000),
});
export type PlatformSettings = z.infer<typeof PlatformSettingsSchema>;

