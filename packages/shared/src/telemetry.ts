import { z } from "zod";

export const EntryPointTypeSchema = z.enum([
  "web_ui",
  "scheduler",
  "schedule",
  "webhook",
  "telegram",
  "whatsapp",
  "email",
  "external_chat",
  "replay",
  "bootstrap",
  "worker",
  "system",
  "global_orchestrator",
]);
export type EntryPointType = z.infer<typeof EntryPointTypeSchema>;

export const ErrorEventSchema = z.object({
  id: z.string(),
  requestId: z.string().optional(),
  entryPoint: EntryPointTypeSchema,
  level: z.enum(["warn", "error", "fatal"]),
  message: z.string(),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const ServiceHealthSchema = z.object({
  name: z.string(),
  status: HealthStatusSchema,
  detail: z.string(),
  latencyMs: z.number().optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const MetricsSummarySchema = z.object({
  requests: z.number(),
  errors: z.number(),
  errorRate: z.number(),
  p50Ms: z.number(),
  p95Ms: z.number(),
  p99Ms: z.number(),
});
export type MetricsSummary = z.infer<typeof MetricsSummarySchema>;

export const HealthSnapshotSchema = z.object({
  status: HealthStatusSchema,
  uptimeSeconds: z.number(),
  services: z.array(ServiceHealthSchema),
  metrics: MetricsSummarySchema,
  recentErrors: z.array(ErrorEventSchema),
  generatedAt: z.string(),
});
export type HealthSnapshot = z.infer<typeof HealthSnapshotSchema>;
