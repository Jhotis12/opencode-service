import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const vaultSecrets = sqliteTable("vault_secrets", {
  id: text("id").primaryKey(),
  alias: text("alias").notNull().unique(),
  kind: text("kind").notNull(),
  ciphertext: text("ciphertext").notNull(),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

export const externalDatabases = sqliteTable("external_databases", {
  id: text("id").primaryKey(),
  alias: text("alias").notNull().unique(),
  driver: text("driver").notNull(),
  ciphertext: text("ciphertext").notNull(),
  createdAt: text("created_at").notNull(),
});

export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const systemErrorEvents = sqliteTable("system_error_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id"),
  entryPoint: text("entry_point").notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  context: text("context"),
  createdAt: text("created_at").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  chatSessionId: text("chat_session_id"),
  createdAt: text("created_at").notNull(),
});

export const workflowRuns = sqliteTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    workflowId: text("workflow_id").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key"),
    payloadHash: text("payload_hash").notNull(),
    input: text("input").notNull(),
    output: text("output"),
    error: text("error"),
    entryPoint: text("entry_point").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (table) => ({
    idempotency: uniqueIndex("workflow_runs_idempotency").on(
      table.projectSlug,
      table.workflowId,
      table.idempotencyKey,
    ),
  }),
);

export const workflowStepRuns = sqliteTable("workflow_step_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  status: text("status").notNull(),
  input: text("input"),
  output: text("output"),
  model: text("model"),
  agentId: text("agent_id"),
  logs: text("logs"),
  durationMs: integer("duration_ms").notNull().default(0),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  error: text("error"),
});

export const workflowApprovals = sqliteTable("workflow_approvals", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  nodeId: text("node_id").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  decidedAt: text("decided_at"),
  decidedBy: text("decided_by"),
});

export const conversationThreads = sqliteTable(
  "conversation_threads",
  {
    id: text("id").primaryKey(),
    channelSlug: text("channel_slug").notNull(),
    externalThreadId: text("external_thread_id").notNull(),
    opencodeSessionId: text("opencode_session_id"),
    projectSlug: text("project_slug"),
    workflowId: text("workflow_id"),
    createdAt: text("created_at").notNull(),
    lastActiveAt: text("last_active_at").notNull(),
  },
  (table) => ({
    thread: uniqueIndex("conversation_threads_unique").on(table.channelSlug, table.externalThreadId),
  }),
);

export const channels = sqliteTable("channels", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  configCiphertext: text("config_ciphertext"),
  keyHash: text("key_hash"),
  adminAllowlist: text("admin_allowlist").notNull().default("[]"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("disconnected"),
  webhookUrl: text("webhook_url"),
  createdAt: text("created_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  projectSlug: text("project_slug").notNull(),
  sessionId: text("session_id"),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const notebooks = sqliteTable("notebooks", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const kbSources = sqliteTable("kb_sources", {
  id: text("id").primaryKey(),
  notebookId: text("notebook_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  uri: text("uri"),
  markdownPath: text("markdown_path"),
  summary: text("summary").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const kbChunks = sqliteTable("kb_chunks", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  notebookId: text("notebook_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  section: text("section").notNull().default(""),
  content: text("content").notNull(),
  embedding: text("embedding"),
  createdAt: text("created_at").notNull(),
});

export const schema = {
  users,
  vaultSecrets,
  externalDatabases,
  systemSettings,
  systemErrorEvents,
  projects,
  workflowRuns,
  workflowStepRuns,
  workflowApprovals,
  conversationThreads,
  channels,
  chatMessages,
  notebooks,
  kbSources,
  kbChunks,
};
