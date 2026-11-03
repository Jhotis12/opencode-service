import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const vaultSecrets = sqliteTable(
  "vault_secrets",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull().default("project"),
    projectSlug: text("project_slug").notNull().default(""),
    alias: text("alias").notNull(),
    kind: text("kind").notNull(),
    ciphertext: text("ciphertext").notNull(),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    scopedAlias: uniqueIndex("vault_secrets_scoped_alias").on(table.scope, table.projectSlug, table.alias),
  }),
);

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
  defaultModel: text("default_model"),
  primaryAgent: text("primary_agent"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at"),
});

export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    projectSlug: text("project_slug").notNull().default(""),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    config: text("config").notNull().default("{}"),
    secretRefs: text("secret_refs").notNull().default("{}"),
    capabilities: text("capabilities").notNull().default("[]"),
    status: text("status").notNull().default("disconnected"),
    keyHash: text("key_hash"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    scopedSlug: uniqueIndex("integrations_scoped_slug").on(table.scope, table.projectSlug, table.slug),
  }),
);

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
    launchedBy: text("launched_by"),
    graphHash: text("graph_hash"),
    versionId: text("version_id"),
    integrationId: text("integration_id"),
    sourceDetail: text("source_detail"),
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

export const workflowVersions = sqliteTable(
  "workflow_versions",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    version: integer("version").notNull(),
    graphHash: text("graph_hash").notNull(),
    graphJson: text("graph_json").notNull(),
    codeBundle: text("code_bundle").notNull().default("{}"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    projectVersion: uniqueIndex("workflow_versions_project_version").on(table.projectSlug, table.version),
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

export const workflowDeliveries = sqliteTable(
  "workflow_deliveries",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    runId: text("run_id"),
    nodeId: text("node_id"),
    integrationId: text("integration_id").notNull(),
    actionKey: text("action_key").notNull(),
    recipient: text("recipient"),
    status: text("status").notNull(),
    providerMessageId: text("provider_message_id"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    action: uniqueIndex("workflow_deliveries_action").on(table.actionKey, table.integrationId),
    project: index("workflow_deliveries_project").on(table.projectSlug),
    run: index("workflow_deliveries_run").on(table.runId),
  }),
);

export const workflowScheduleState = sqliteTable(
  "workflow_schedule_state",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    workflowId: text("workflow_id").notNull(),
    nodeId: text("node_id").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    overlapPolicy: text("overlap_policy").notNull().default("skip"),
    catchUp: integer("catch_up", { mode: "boolean" }).notNull().default(false),
    catchUpWindowMinutes: integer("catch_up_window_minutes").notNull().default(60),
    lastWindowAt: text("last_window_at"),
    nextWindowAt: text("next_window_at"),
    lastRunId: text("last_run_id"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    schedule: uniqueIndex("workflow_schedule_state_key").on(table.projectSlug, table.workflowId, table.nodeId),
    workflow: index("workflow_schedule_state_workflow").on(table.workflowId),
  }),
);

export const chatThreads = sqliteTable(
  "chat_threads",
  {
    id: text("id").primaryKey(),
    scope: text("scope").notNull(),
    projectSlug: text("project_slug").notNull().default(""),
    integrationId: text("integration_id").notNull().default(""),
    externalThreadId: text("external_thread_id").notNull().default(""),
    opencodeSessionId: text("opencode_session_id"),
    title: text("title"),
    createdAt: text("created_at").notNull(),
    lastActiveAt: text("last_active_at").notNull(),
  },
  (table) => ({
    thread: uniqueIndex("chat_threads_unique").on(
      table.scope,
      table.projectSlug,
      table.integrationId,
      table.externalThreadId,
    ),
  }),
);

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").notNull(),
});

export const notebooks = sqliteTable(
  "notebooks",
  {
    id: text("id").primaryKey(),
    projectSlug: text("project_slug").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    projectSlug: uniqueIndex("notebooks_project_slug").on(table.projectSlug, table.slug),
  }),
);

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
  systemSettings,
  systemErrorEvents,
  projects,
  integrations,
  workflowRuns,
  workflowVersions,
  workflowStepRuns,
  workflowApprovals,
  workflowDeliveries,
  workflowScheduleState,
  chatThreads,
  chatMessages,
  notebooks,
  kbSources,
  kbChunks,
};
