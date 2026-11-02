import { z } from "zod";

export const IntegrationScopeSchema = z.enum(["project", "global"]);
export type IntegrationScope = z.infer<typeof IntegrationScopeSchema>;

export const IntegrationKindSchema = z.enum([
  "telegram",
  "whatsapp",
  "external_chat",
  "email",
  "postgres",
  "mysql",
  "mssql",
  "sqlite",
  "http",
]);
export type IntegrationKind = z.infer<typeof IntegrationKindSchema>;

export const IntegrationCapabilitySchema = z.enum([
  "inbound_message",
  "outbound_message",
  "send_email",
  "read_email",
  "query",
]);
export type IntegrationCapability = z.infer<typeof IntegrationCapabilitySchema>;

export const IntegrationStatusSchema = z.enum([
  "connected",
  "disconnected",
  "needs_config",
  "qr_pending",
  "error",
]);
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

export const ChannelModeSchema = z.enum(["agent", "workflow", "hybrid"]);
export type ChannelMode = z.infer<typeof ChannelModeSchema>;

export const ChannelRoutingSchema = z.object({
  mode: ChannelModeSchema.default("hybrid"),
  allowlist: z.array(z.string()).default([]),
  public: z.boolean().default(false),
});
export type ChannelRouting = z.infer<typeof ChannelRoutingSchema>;

const defaultRouting: ChannelRouting = { mode: "hybrid", allowlist: [], public: false };

export const TelegramIntegrationConfigSchema = z.object({
  kind: z.literal("telegram"),
  botUsername: z.string().optional(),
  routing: ChannelRoutingSchema.default(defaultRouting),
}).passthrough();

export const WhatsAppIntegrationConfigSchema = z.object({
  kind: z.literal("whatsapp"),
  mode: z.enum(["baileys", "cloud"]).default("baileys"),
  phoneNumberId: z.string().optional(),
  routing: ChannelRoutingSchema.default(defaultRouting),
}).passthrough();

export const ExternalChatIntegrationConfigSchema = z.object({
  kind: z.literal("external_chat"),
  routing: ChannelRoutingSchema.default(defaultRouting),
}).passthrough();

export const EmailAccountSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean().default(true),
  user: z.string().optional(),
  mailbox: z.string().optional(),
});

export const EmailIntegrationConfigSchema = z.object({
  kind: z.literal("email"),
  from: z.string().email(),
  smtp: EmailAccountSchema,
  imap: EmailAccountSchema.optional(),
  routing: ChannelRoutingSchema.optional(),
}).passthrough();

const networkDatabaseFields = {
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  user: z.string().min(1),
  ssl: z.boolean().optional(),
};

export const PostgresIntegrationConfigSchema = z.object({
  kind: z.literal("postgres"),
  ...networkDatabaseFields,
}).passthrough();

export const MysqlIntegrationConfigSchema = z.object({
  kind: z.literal("mysql"),
  ...networkDatabaseFields,
}).passthrough();

export const MssqlIntegrationConfigSchema = z.object({
  kind: z.literal("mssql"),
  ...networkDatabaseFields,
}).passthrough();

export const SqliteIntegrationConfigSchema = z.object({
  kind: z.literal("sqlite"),
  filename: z.string().min(1),
}).passthrough();

export const HttpIntegrationConfigSchema = z.object({
  kind: z.literal("http"),
  baseUrl: z.string().url(),
}).passthrough();

export const IntegrationConfigSchema = z.discriminatedUnion("kind", [
  TelegramIntegrationConfigSchema,
  WhatsAppIntegrationConfigSchema,
  ExternalChatIntegrationConfigSchema,
  EmailIntegrationConfigSchema,
  PostgresIntegrationConfigSchema,
  MysqlIntegrationConfigSchema,
  MssqlIntegrationConfigSchema,
  SqliteIntegrationConfigSchema,
  HttpIntegrationConfigSchema,
]);
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

const CHANNEL_CAPABILITIES: IntegrationCapability[] = ["inbound_message", "outbound_message"];
const DATABASE_CAPABILITIES: IntegrationCapability[] = ["query"];
const EMAIL_CAPABILITIES: IntegrationCapability[] = ["send_email", "read_email"];

export function defaultCapabilities(kind: IntegrationKind): IntegrationCapability[] {
  switch (kind) {
    case "telegram":
    case "whatsapp":
    case "external_chat":
      return [...CHANNEL_CAPABILITIES];
    case "email":
      return [...EMAIL_CAPABILITIES];
    case "postgres":
    case "mysql":
    case "mssql":
    case "sqlite":
      return [...DATABASE_CAPABILITIES];
    case "http":
      return [];
  }
}

export const IntegrationRecordSchema = z.object({
  id: z.string().min(1),
  scope: IntegrationScopeSchema,
  projectSlug: z.string().optional(),
  kind: IntegrationKindSchema,
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/),
  config: z.record(z.unknown()).default({}),
  secretRefs: z.record(z.string()).default({}),
  capabilities: z.array(IntegrationCapabilitySchema),
  status: IntegrationStatusSchema,
  keyHash: z.string().optional(),
  lastError: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IntegrationRecord = z.infer<typeof IntegrationRecordSchema>;

export const CreateIntegrationInputSchema = z.object({
  scope: IntegrationScopeSchema.default("project"),
  projectSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/).optional(),
  kind: IntegrationKindSchema,
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/),
  config: z.record(z.unknown()).default({}),
  secretRefs: z.record(z.string()).default({}),
  capabilities: z.array(IntegrationCapabilitySchema).optional(),
});
export type CreateIntegrationInput = z.infer<typeof CreateIntegrationInputSchema>;

export const UpdateIntegrationInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  config: z.record(z.unknown()).optional(),
  secretRefs: z.record(z.string()).optional(),
  capabilities: z.array(IntegrationCapabilitySchema).optional(),
  status: IntegrationStatusSchema.optional(),
  lastError: z.string().optional(),
});
export type UpdateIntegrationInput = z.infer<typeof UpdateIntegrationInputSchema>;

export function parseIntegrationConfig(kind: IntegrationKind, config: unknown) {
  const value =
    config && typeof config === "object" && !Array.isArray(config)
      ? { ...(config as Record<string, unknown>), kind }
      : { kind };
  return IntegrationConfigSchema.safeParse(value);
}

export function integrationHasCapability(
  integration: Pick<IntegrationRecord, "capabilities">,
  capability: IntegrationCapability,
): boolean {
  return integration.capabilities.includes(capability);
}
