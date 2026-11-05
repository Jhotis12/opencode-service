import { z } from "zod";
import {
  AgentNodeConfigSchema,
  ApprovalNodeConfigSchema,
  CodeNodeConfigSchema,
  DatabaseNodeConfigSchema,
  DecisionNodeConfigSchema,
  DelayNodeConfigSchema,
  ForeachNodeConfigSchema,
  HttpNodeConfigSchema,
  NotifyNodeConfigSchema,
  SubworkflowNodeConfigSchema,
  TranscribeNodeConfigSchema,
  TransformNodeConfigSchema,
  TriggerConfigSchema,
  ValidateConfigSchema,
  type NodeType,
} from "./workflow.ts";
import {
  EmailIntegrationConfigSchema,
  ExternalChatIntegrationConfigSchema,
  HttpIntegrationConfigSchema,
  MssqlIntegrationConfigSchema,
  MysqlIntegrationConfigSchema,
  PostgresIntegrationConfigSchema,
  SqliteIntegrationConfigSchema,
  TelegramIntegrationConfigSchema,
  TranscriptionIntegrationConfigSchema,
  WhatsAppIntegrationConfigSchema,
  defaultCapabilities,
  type IntegrationCapability,
  type IntegrationKind,
} from "./integrations.ts";

export type ConfigFieldType =
  | "text"
  | "password"
  | "email"
  | "url"
  | "number"
  | "boolean"
  | "select"
  | "textarea"
  | "json"
  | "code"
  | "custom";

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  group?: string;
  required?: boolean;
  secret?: boolean;
  readOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  help?: string;
  widget?: string;
  resource?: "integration" | "agent" | "notebook" | "workflow-version" | "destination";
  integrationKinds?: IntegrationKind[];
  integrationCapability?: IntegrationCapability;
  visibleWhen?: { key: string; equals?: unknown; notEquals?: unknown };
}

export interface ConfigDefinition {
  schema: z.ZodTypeAny;
  defaults: Record<string, unknown>;
  fields: ConfigField[];
}

export interface IntegrationConfigDefinition extends ConfigDefinition {
  kind: IntegrationKind;
  capabilities: IntegrationCapability[];
  secretFields: string[];
  events: string[];
  requiredSecrets?: (config: Record<string, unknown>) => string[];
}

export interface NodeConfigDefinition extends ConfigDefinition {
  type: NodeType;
  label: string;
  description: string;
  category: string;
}

export const INTEGRATION_KIND_LABELS: Record<IntegrationKind, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  external_chat: "Chat externo / API",
  email: "Email (contrato futuro)",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  mssql: "SQL Server",
  sqlite: "SQLite",
  http: "HTTP API",
  transcription: "Transcripción (ASR)",
};

export const CHANNEL_EVENTS: Record<IntegrationKind, string[]> = {
  telegram: ["message.received"],
  whatsapp: ["message.received"],
  external_chat: ["message.received"],
  email: [],
  postgres: [],
  mysql: [],
  mssql: [],
  sqlite: [],
  http: [],
  transcription: [],
};

const routingFields: ConfigField[] = [
  {
    key: "routing",
    label: "Modo del canal",
    type: "select",
    group: "Comportamiento",
    options: [
      { value: "hybrid", label: "Híbrido: admin → agente, público → flujo" },
      { value: "agent", label: "Siempre al agente principal" },
      { value: "workflow", label: "Siempre al flujo" },
    ],
    help: "El modo se guarda dentro de routing.mode.",
  },
  {
    key: "allowlist",
    label: "Allowlist de administradores",
    type: "custom",
    group: "Comportamiento",
    widget: "destination-list",
    help: "IDs de Telegram/WhatsApp o destinos etiquetados; se guarda dentro de routing.allowlist.",
  },
  {
    key: "public",
    label: "Permitir remitentes públicos",
    type: "boolean",
    group: "Comportamiento",
    help: "Se guarda dentro de routing.public.",
  },
];

const alertFields: ConfigField[] = [
  {
    key: "alerts",
    label: "Alertas suscritas",
    type: "custom",
    group: "Alertas",
    widget: "alert-events",
    help: "run.failed, integration.down, health.degraded.",
  },
  {
    key: "alertRecipient",
    label: "Destinatario de alertas",
    type: "custom",
    group: "Alertas",
    widget: "destination-picker",
  },
  {
    key: "rateLimitPerMinute",
    label: "Máximo de mensajes por minuto",
    type: "number",
    group: "Alertas",
    placeholder: "60",
  },
];

const databasePolicyFields: ConfigField[] = [
  {
    key: "access",
    label: "Acceso",
    type: "select",
    group: "Política",
    options: [
      { value: "read", label: "Solo lectura" },
      { value: "write", label: "Lectura y escritura" },
    ],
  },
  { key: "maxRows", label: "Máximo de filas", type: "number", group: "Política", placeholder: "1000" },
  { key: "allowDdl", label: "Permitir DDL", type: "boolean", group: "Política" },
];

const databaseFields: ConfigField[] = [
  { key: "host", label: "Host", type: "text", group: "Conexión", required: true },
  { key: "port", label: "Puerto", type: "number", group: "Conexión", required: true },
  { key: "database", label: "Base de datos", type: "text", group: "Conexión", required: true },
  { key: "user", label: "Usuario", type: "text", group: "Conexión", required: true },
  { key: "password", label: "Contraseña", type: "password", group: "Conexión", secret: true, required: true },
  { key: "ssl", label: "SSL", type: "boolean", group: "Conexión" },
  ...databasePolicyFields,
];

const defaultRouting = { mode: "hybrid", allowlist: [], public: false };

export const INTEGRATION_CONFIG_REGISTRY: Record<IntegrationKind, IntegrationConfigDefinition> = {
  telegram: {
    kind: "telegram",
    schema: TelegramIntegrationConfigSchema,
    defaults: {
      routing: defaultRouting,
      alerts: ["run.failed"],
      alertRecipient: "",
      rateLimitPerMinute: 60,
    },
    fields: [
      {
        key: "token",
        label: "Token del bot (@BotFather)",
        type: "password",
        group: "Conexión",
        secret: true,
        required: true,
        placeholder: "123456:ABC...",
      },
      { key: "botUsername", label: "Usuario del bot", type: "text", group: "Conexión", readOnly: true },
      ...routingFields,
      ...alertFields,
    ],
    capabilities: defaultCapabilities("telegram"),
    secretFields: ["token"],
    events: CHANNEL_EVENTS.telegram,
    requiredSecrets: () => ["token"],
  },
  whatsapp: {
    kind: "whatsapp",
    schema: WhatsAppIntegrationConfigSchema,
    defaults: {
      mode: "baileys",
      routing: defaultRouting,
      alerts: ["run.failed"],
      alertRecipient: "",
      rateLimitPerMinute: 60,
    },
    fields: [
      {
        key: "mode",
        label: "Modo de WhatsApp",
        type: "select",
        group: "Conexión",
        options: [
          { value: "baileys", label: "Baileys (QR personal)" },
          { value: "cloud", label: "Cloud API (Meta)" },
        ],
      },
      {
        key: "token",
        label: "Token de Meta",
        type: "password",
        group: "Conexión",
        secret: true,
        visibleWhen: { key: "mode", equals: "cloud" },
      },
      {
        key: "phoneNumberId",
        label: "Phone number ID",
        type: "text",
        group: "Conexión",
        visibleWhen: { key: "mode", equals: "cloud" },
      },
      ...routingFields,
      ...alertFields,
    ],
    capabilities: defaultCapabilities("whatsapp"),
    secretFields: ["token"],
    events: CHANNEL_EVENTS.whatsapp,
    requiredSecrets: (config) => (config.mode === "cloud" ? ["token"] : []),
  },
  external_chat: {
    kind: "external_chat",
    schema: ExternalChatIntegrationConfigSchema,
    defaults: { routing: defaultRouting, alerts: ["run.failed"], rateLimitPerMinute: 60 },
    fields: [
      { key: "webhookUrl", label: "Webhook de la app externa", type: "url", group: "Conexión" },
      ...routingFields,
      ...alertFields,
    ],
    capabilities: defaultCapabilities("external_chat"),
    secretFields: ["apiKey", "webhookSecret"],
    events: CHANNEL_EVENTS.external_chat,
    requiredSecrets: () => [],
  },
  email: {
    kind: "email",
    schema: EmailIntegrationConfigSchema,
    defaults: {
      from: "alertas@example.com",
      smtp: { host: "smtp.example.com", port: 587, secure: false },
      routing: defaultRouting,
      alerts: ["run.failed"],
    },
    fields: [
      { key: "from", label: "Remitente", type: "email", group: "Conexión", required: true },
      { key: "smtp.host", label: "Host SMTP", type: "text", group: "SMTP", required: true },
      { key: "smtp.port", label: "Puerto SMTP", type: "number", group: "SMTP", required: true },
      { key: "smtp.secure", label: "SMTP seguro", type: "boolean", group: "SMTP" },
      { key: "smtp.user", label: "Usuario SMTP", type: "text", group: "SMTP" },
      { key: "smtpPassword", label: "Contraseña SMTP", type: "password", group: "SMTP", secret: true, required: true },
      { key: "imap.host", label: "Host IMAP", type: "text", group: "IMAP" },
      { key: "imap.port", label: "Puerto IMAP", type: "number", group: "IMAP" },
      { key: "imap.secure", label: "IMAP seguro", type: "boolean", group: "IMAP" },
      { key: "imap.user", label: "Usuario IMAP", type: "text", group: "IMAP" },
      { key: "imap.mailbox", label: "Buzón IMAP", type: "text", group: "IMAP" },
      { key: "imapPassword", label: "Contraseña IMAP", type: "password", group: "IMAP", secret: true },
      ...routingFields,
      ...alertFields,
    ],
    capabilities: defaultCapabilities("email"),
    secretFields: ["smtpPassword", "imapPassword"],
    events: CHANNEL_EVENTS.email,
    requiredSecrets: (config) => ["smtpPassword", ...(config.imap ? ["imapPassword"] : [])],
  },
  postgres: {
    kind: "postgres",
    schema: PostgresIntegrationConfigSchema,
    defaults: {
      host: "localhost",
      port: 5432,
      database: "crm",
      user: "app",
      ssl: false,
      access: "read",
      maxRows: 1000,
      allowDdl: false,
    },
    fields: databaseFields,
    capabilities: defaultCapabilities("postgres"),
    secretFields: ["password"],
    events: [],
    requiredSecrets: () => ["password"],
  },
  mysql: {
    kind: "mysql",
    schema: MysqlIntegrationConfigSchema,
    defaults: {
      host: "localhost",
      port: 3306,
      database: "crm",
      user: "app",
      ssl: false,
      access: "read",
      maxRows: 1000,
      allowDdl: false,
    },
    fields: databaseFields,
    capabilities: defaultCapabilities("mysql"),
    secretFields: ["password"],
    events: [],
    requiredSecrets: () => ["password"],
  },
  mssql: {
    kind: "mssql",
    schema: MssqlIntegrationConfigSchema,
    defaults: {
      host: "localhost",
      port: 1433,
      database: "crm",
      user: "app",
      ssl: false,
      access: "read",
      maxRows: 1000,
      allowDdl: false,
    },
    fields: databaseFields,
    capabilities: defaultCapabilities("mssql"),
    secretFields: ["password"],
    events: [],
    requiredSecrets: () => ["password"],
  },
  sqlite: {
    kind: "sqlite",
    schema: SqliteIntegrationConfigSchema,
    defaults: { filename: "./data/client.sqlite", access: "read", maxRows: 1000, allowDdl: false },
    fields: [
      { key: "filename", label: "Archivo SQLite", type: "text", group: "Conexión", required: true },
      ...databasePolicyFields,
    ],
    capabilities: defaultCapabilities("sqlite"),
    secretFields: [],
    events: [],
    requiredSecrets: () => [],
  },
  http: {
    kind: "http",
    schema: HttpIntegrationConfigSchema,
    defaults: { baseUrl: "https://api.example.com" },
    fields: [{ key: "baseUrl", label: "URL base", type: "url", group: "Conexión", required: true }],
    capabilities: defaultCapabilities("http"),
    secretFields: [],
    events: [],
    requiredSecrets: () => [],
  },
  transcription: {
    kind: "transcription",
    schema: TranscriptionIntegrationConfigSchema,
    defaults: {
      baseUrl: "http://transcription:8000/v1",
      model: "Systran/faster-whisper-small",
      language: "es",
    },
    fields: [
      { key: "baseUrl", label: "URL base del proveedor", type: "url", group: "Conexión", required: true },
      { key: "apiKey", label: "API key del ASR", type: "password", group: "Conexión", secret: true },
      { key: "model", label: "Modelo por defecto", type: "text", group: "Transcripción", required: true },
      { key: "language", label: "Idioma", type: "text", group: "Transcripción", placeholder: "es" },
      { key: "models", label: "Modelos disponibles", type: "json", group: "Transcripción" },
    ],
    capabilities: defaultCapabilities("transcription"),
    secretFields: ["apiKey"],
    events: [],
    requiredSecrets: () => [],
  },
};

const DATABASE_KINDS: IntegrationKind[] = ["postgres", "mysql", "mssql", "sqlite"];
const CHANNEL_KINDS: IntegrationKind[] = ["telegram", "whatsapp", "external_chat"];

const integrationField = (
  key: string,
  label: string,
  kinds: IntegrationKind[],
  capability?: IntegrationCapability,
): ConfigField => ({
  key,
  label,
  type: "custom",
  widget: "integration-picker",
  resource: "integration",
  integrationKinds: kinds,
  integrationCapability: capability,
});

const destinationField = (key: string, label: string, help?: string): ConfigField => ({
  key,
  label,
  type: "custom",
  widget: "destination-picker",
  resource: "destination",
  help,
});

export const NODE_CONFIG_REGISTRY: Record<NodeType, NodeConfigDefinition> = {
  trigger: {
    type: "trigger",
    label: "Trigger",
    description: "Entrada manual o por canal",
    category: "Entrada",
    schema: TriggerConfigSchema,
    defaults: { kind: "manual", inputSchema: { fields: [] }, accepts: ["text"] },
    fields: [
      {
        key: "kind",
        label: "Entrada del flujo",
        type: "select",
        options: [
          { value: "manual", label: "Manual (canvas / formulario)" },
          { value: "integration", label: "Integración (Telegram, WhatsApp, API)" },
          { value: "schedule", label: "Programado (cron)" },
          { value: "webhook", label: "Webhook HTTP" },
        ],
      },
      {
        key: "mode",
        label: "Modo del schedule",
        type: "select",
        options: [
          { value: "cron", label: "Cron recurrente" },
          { value: "once", label: "Ejecución única" },
        ],
        visibleWhen: { key: "kind", equals: "schedule" },
      },
      { key: "cron", label: "Expresión Cron (5 campos)", type: "text", visibleWhen: { key: "kind", equals: "schedule" } },
      { key: "runAt", label: "Fecha y hora (ISO)", type: "text", visibleWhen: { key: "kind", equals: "schedule" } },
      { key: "timezone", label: "Zona horaria (IANA)", type: "text", placeholder: "America/Mexico_City" },
      { key: "enabled", label: "Schedule activo", type: "boolean", visibleWhen: { key: "kind", equals: "schedule" } },
      {
        key: "overlapPolicy",
        label: "Solapamiento",
        type: "select",
        options: [
          { value: "skip", label: "Omitir si hay un run en curso" },
          { value: "allow", label: "Permitir solapamiento" },
        ],
        visibleWhen: { key: "kind", equals: "schedule" },
      },
      { key: "catchUp", label: "Recuperar ventanas perdidas", type: "boolean", visibleWhen: { key: "kind", equals: "schedule" } },
      {
        key: "catchUpWindowMinutes",
        label: "Ventana de recuperación (min)",
        type: "number",
        visibleWhen: { key: "kind", equals: "schedule" },
      },
      { key: "secretAlias", label: "Alias de secreto del webhook", type: "text", visibleWhen: { key: "kind", equals: "webhook" } },
      integrationField("integrationId", "Integración del proyecto", CHANNEL_KINDS, "inbound_message"),
      {
        key: "event",
        label: "Evento",
        type: "custom",
        widget: "channel-event",
        visibleWhen: { key: "kind", equals: "integration" },
      },
      {
        key: "accepts",
        label: "Tipos de mensaje aceptados",
        type: "custom",
        widget: "media-kinds",
        visibleWhen: { key: "kind", equals: "integration" },
      },
      { key: "inputSchema", label: "Datos de entrada", type: "custom", widget: "input-schema" },
    ],
  },
  code: {
    type: "code",
    label: "Código",
    description: "TypeScript en worker aislado",
    category: "Acciones",
    schema: CodeNodeConfigSchema,
    defaults: {},
    fields: [],
  },
  agent: {
    type: "agent",
    label: "Agente",
    description: "Sub-agente con modelo y Notebooks",
    category: "IA",
    schema: AgentNodeConfigSchema,
    defaults: { instruction: "" },
    fields: [
      { key: "instruction", label: "Instrucción adicional", type: "textarea" },
      { key: "mediaPath", label: "Adjuntar imágenes desde", type: "text", placeholder: "attachments" },
      { key: "strictGrounding", label: "Respuestas fundamentadas solo en Notebooks", type: "boolean" },
      { key: "outputSchema", label: "Esquema de salida estructurada", type: "custom", widget: "input-schema" },
    ],
  },
  transcribe: {
    type: "transcribe",
    label: "Transcribir audio",
    description: "Convierte audio en texto con una conexión ASR",
    category: "IA",
    schema: TranscribeNodeConfigSchema,
    defaults: { mediaPath: "attachments" },
    fields: [
      integrationField("integrationId", "Conexión de transcripción", ["transcription"]),
      { key: "model", label: "Modelo (override)", type: "text" },
      { key: "language", label: "Idioma (override)", type: "text" },
      { key: "prompt", label: "Prompt de contexto", type: "textarea" },
      { key: "mediaPath", label: "Ruta de los audios en el input", type: "text", placeholder: "attachments" },
    ],
  },
  decision: {
    type: "decision",
    label: "Condición",
    description: "Bifurca en sí / no",
    category: "Lógica",
    schema: DecisionNodeConfigSchema,
    defaults: { mode: "condition", condition: { field: "status", operator: "equals", value: "ok" } },
    fields: [
      {
        key: "mode",
        label: "Modo",
        type: "select",
        options: [
          { value: "condition", label: "Condición visual" },
          { value: "code", label: "Código TypeScript" },
        ],
      },
      { key: "condition", label: "Condición", type: "custom", widget: "condition", visibleWhen: { key: "mode", equals: "condition" } },
    ],
  },
  approval: {
    type: "approval",
    label: "Aprobación",
    description: "Pausa hasta aprobación humana",
    category: "Humano",
    schema: ApprovalNodeConfigSchema,
    defaults: { message: "Revisar antes de continuar", autoApprove: false },
    fields: [
      { key: "message", label: "Mensaje de aprobación", type: "textarea" },
      { key: "autoApprove", label: "Aprobar automáticamente (solo pruebas)", type: "boolean" },
    ],
  },
  http: {
    type: "http",
    label: "HTTP Request",
    description: "Llama una API externa",
    category: "Acciones",
    schema: HttpNodeConfigSchema,
    defaults: { method: "GET", url: "https://api.example.com", headers: "{}", body: "" },
    fields: [
      {
        key: "method",
        label: "Método",
        type: "select",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => ({ value: method, label: method })),
      },
      { key: "url", label: "URL", type: "text", required: true },
      integrationField("integrationId", "Integración HTTP (opcional)", ["http"]),
      {
        key: "headers",
        label: "Headers (JSON)",
        type: "json",
        help: "Secretos: usa secret:alias en headers y {{secret.alias}} en el body.",
      },
      { key: "body", label: "Body (JSON o texto)", type: "json" },
    ],
  },
  delay: {
    type: "delay",
    label: "Esperar",
    description: "Pausa el flujo N milisegundos",
    category: "Acciones",
    schema: DelayNodeConfigSchema,
    defaults: { ms: 1000 },
    fields: [
      { key: "ms", label: "Espera (ms, máx. 60000)", type: "number" },
      { key: "waitUntil", label: "Esperar hasta (ISO, durable)", type: "text" },
    ],
  },
  transform: {
    type: "transform",
    label: "Transformar",
    description: "Mapea o plantilla JSON",
    category: "Acciones",
    schema: TransformNodeConfigSchema,
    defaults: { template: '{"result":"{{input}}"}' },
    fields: [{ key: "template", label: "Plantilla / mapeo JSON", type: "textarea" }],
  },
  validate: {
    type: "validate",
    label: "Validar",
    description: "Verifica campos requeridos",
    category: "Lógica",
    schema: ValidateConfigSchema,
    defaults: { rules: [{ name: "tema", type: "string", required: true, message: "Falta el campo tema." }] },
    fields: [{ key: "rules", label: "Reglas de validación", type: "custom", widget: "validate-rules" }],
  },
  database: {
    type: "database",
    label: "Base de datos",
    description: "Consulta o escribe en una integración SQL",
    category: "Acciones",
    schema: DatabaseNodeConfigSchema,
    defaults: {
      integrationId: "__pending__",
      mode: "read",
      statements: [{ sql: "select 1", params: [] }],
      transaction: true,
      maxRows: 1000,
    },
    fields: [
      integrationField("integrationId", "Integración de base de datos", DATABASE_KINDS),
      {
        key: "mode",
        label: "Modo",
        type: "select",
        options: [
          { value: "read", label: "Lectura" },
          { value: "write", label: "Escritura" },
        ],
      },
      { key: "statements", label: "Sentencias SQL (JSON)", type: "custom", widget: "database-statements" },
      { key: "transaction", label: "Transacción", type: "boolean" },
      { key: "maxRows", label: "Máximo de filas", type: "number" },
    ],
  },
  notify: {
    type: "notify",
    label: "Notificar",
    description: "Envía un mensaje por un canal del proyecto",
    category: "Acciones",
    schema: NotifyNodeConfigSchema,
    defaults: { integrationId: "__pending__", text: "Hola {{input.nombre}}" },
    fields: [
      integrationField("integrationId", "Canal de salida", CHANNEL_KINDS, "outbound_message"),
      destinationField("recipient", "Destinatario", "Telegram y WhatsApp requieren un destinatario."),
      { key: "text", label: "Mensaje", type: "textarea", required: true },
      { key: "actionKey", label: "Clave de idempotencia", type: "text" },
    ],
  },
  foreach: {
    type: "foreach",
    label: "Por cada",
    description: "Ejecuta un subflujo por cada elemento",
    category: "Lógica",
    schema: ForeachNodeConfigSchema,
    defaults: { versionId: "__pending__", itemsPath: "input.items", maxConcurrency: 1, onItemError: "stop" },
    fields: [
      {
        key: "versionId",
        label: "Versión del subflujo",
        type: "custom",
        widget: "workflow-version",
        resource: "workflow-version",
      },
      { key: "itemsPath", label: "Ruta de la lista", type: "text", required: true },
      { key: "maxConcurrency", label: "Concurrencia máxima", type: "number" },
      {
        key: "onItemError",
        label: "Si falla un elemento",
        type: "select",
        options: [
          { value: "stop", label: "Detener el lote" },
          { value: "continue", label: "Continuar con los demás" },
        ],
      },
    ],
  },
  subworkflow: {
    type: "subworkflow",
    label: "Subflujo",
    description: "Ejecuta una versión inmutable de otro flujo",
    category: "Acciones",
    schema: SubworkflowNodeConfigSchema,
    defaults: { versionId: "__pending__" },
    fields: [
      {
        key: "versionId",
        label: "Versión del subflujo",
        type: "custom",
        widget: "workflow-version",
        resource: "workflow-version",
      },
      { key: "payloadPath", label: "Ruta del payload (opcional)", type: "text" },
    ],
  },
};

export function integrationConfigDefinition(kind: IntegrationKind): IntegrationConfigDefinition {
  return INTEGRATION_CONFIG_REGISTRY[kind];
}

export function nodeConfigDefinition(type: NodeType): NodeConfigDefinition {
  return NODE_CONFIG_REGISTRY[type];
}

export function defaultNodeConfig(type: NodeType): Record<string, unknown> {
  return structuredClone(NODE_CONFIG_REGISTRY[type].defaults);
}

export function validateIntegrationConfig(kind: IntegrationKind, config: unknown) {
  const definition = INTEGRATION_CONFIG_REGISTRY[kind];
  const value = config && typeof config === "object" && !Array.isArray(config) ? { ...(config as Record<string, unknown>), kind } : { kind };
  return definition.schema.safeParse(value);
}

export function validateNodeConfig(type: NodeType, config: unknown) {
  return NODE_CONFIG_REGISTRY[type].schema.safeParse(config ?? {});
}

export function integrationEvents(kind: IntegrationKind): string[] {
  return CHANNEL_EVENTS[kind];
}

export function findSecretLikeFields(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const found: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    const secretKey = /(token|password|secret|api[_-]?key|dsn|credential)/i.test(key);
    const safeKey = /(alias|ref|username)$/i.test(key);
    if (secretKey && !safeKey && typeof item === "string" && item.trim()) {
      found.push(next);
    } else if (item && typeof item === "object") {
      found.push(...findSecretLikeFields(item, next));
    }
  }
  return found;
}
