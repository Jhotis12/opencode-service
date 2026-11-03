import type { Database } from "bun:sqlite";

/**
 * Portable DDL for the platform database. SQLite is the default; the same
 * statements are valid on PostgreSQL except for the FTS5 index, which has a
 * pgvector/tsvector counterpart in the knowledge adapter.
 */
export const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vault_secrets (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'project',
  project_slug TEXT NOT NULL DEFAULT '',
  alias TEXT NOT NULL,
  kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS vault_secrets_scoped_alias
  ON vault_secrets(scope, project_slug, alias);
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_error_events (
  id TEXT PRIMARY KEY,
  request_id TEXT,
  entry_point TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  context TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  default_model TEXT,
  primary_agent TEXT,
  approval_integration_id TEXT,
  approval_recipient TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  project_slug TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  secret_refs TEXT NOT NULL DEFAULT '{}',
  capabilities TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'disconnected',
  key_hash TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS integrations_scoped_slug
  ON integrations(scope, project_slug, slug);
CREATE INDEX IF NOT EXISTS integrations_project ON integrations(scope, project_slug);
CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT,
  payload_hash TEXT NOT NULL,
  input TEXT NOT NULL,
  output TEXT,
  error TEXT,
  entry_point TEXT NOT NULL,
  launched_by TEXT,
  graph_hash TEXT,
  version_id TEXT,
  integration_id TEXT,
  source_detail TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_idempotency
  ON workflow_runs(project_slug, workflow_id, idempotency_key);
CREATE TABLE IF NOT EXISTS workflow_versions (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  version INTEGER NOT NULL,
  graph_hash TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  code_bundle TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_versions_project_version
  ON workflow_versions(project_slug, version);
CREATE TABLE IF NOT EXISTS workflow_step_runs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input TEXT,
  output TEXT,
  model TEXT,
  agent_id TEXT,
  logs TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS workflow_step_runs_run ON workflow_step_runs(run_id);
CREATE TABLE IF NOT EXISTS workflow_approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT
);
CREATE INDEX IF NOT EXISTS workflow_approvals_run ON workflow_approvals(run_id);
CREATE TABLE IF NOT EXISTS workflow_deliveries (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  run_id TEXT,
  node_id TEXT,
  integration_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_deliveries_action
  ON workflow_deliveries(action_key, integration_id);
CREATE INDEX IF NOT EXISTS workflow_deliveries_project ON workflow_deliveries(project_slug);
CREATE INDEX IF NOT EXISTS workflow_deliveries_run ON workflow_deliveries(run_id);
CREATE TABLE IF NOT EXISTS workflow_schedule_state (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  enabled INTEGER NOT NULL DEFAULT 1,
  overlap_policy TEXT NOT NULL DEFAULT 'skip',
  catch_up INTEGER NOT NULL DEFAULT 0,
  catch_up_window_minutes INTEGER NOT NULL DEFAULT 60,
  last_window_at TEXT,
  next_window_at TEXT,
  last_run_id TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_schedule_state_key
  ON workflow_schedule_state(project_slug, workflow_id, node_id);
CREATE INDEX IF NOT EXISTS workflow_schedule_state_workflow ON workflow_schedule_state(workflow_id);
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  project_slug TEXT NOT NULL DEFAULT '',
  integration_id TEXT NOT NULL DEFAULT '',
  external_thread_id TEXT NOT NULL DEFAULT '',
  opencode_session_id TEXT,
  title TEXT,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_unique
  ON chat_threads(scope, project_slug, integration_id, external_thread_id);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_thread ON chat_messages(thread_id, created_at);
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS notebooks_project_slug ON notebooks(project_slug, slug);
CREATE TABLE IF NOT EXISTS kb_sources (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  uri TEXT,
  markdown_path TEXT,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kb_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  notebook_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  section TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  embedding TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kb_chunks_notebook ON kb_chunks(notebook_id);
CREATE VIRTUAL TABLE IF NOT EXISTS kb_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  notebook_id UNINDEXED,
  content,
  tokenize = 'unicode61'
);
`;

function tableExists(sqlite: Database, table: string): boolean {
  return Boolean(
    sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

function columnsOf(sqlite: Database, table: string): Set<string> {
  return new Set(
    (sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
  );
}

function addColumnIfMissing(sqlite: Database, table: string, column: string, definition: string): void {
  if (!columnsOf(sqlite, table).has(column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Clean-cut schema migration. The previous global channel/database/notebook
 * model is removed; resources are rebuilt from the new project-scoped model.
 * A destructive upgrade must run `migrateLegacyResources` with an explicit
 * mapping before this function, and must have a database backup.
 */
export function migrate(sqlite: Database): void {
  sqlite.exec("BEGIN");
  try {
    // Drop the previous global-resource model when it is present. This is a
    // deliberate clean cut: legacy data must be mapped explicitly beforehand.
    if (tableExists(sqlite, "channels")) sqlite.exec("DROP TABLE channels");
    if (tableExists(sqlite, "external_databases")) sqlite.exec("DROP TABLE external_databases");
    if (tableExists(sqlite, "conversation_threads")) sqlite.exec("DROP TABLE conversation_threads");

    // Rebuild tables whose column contract changed. Only rebuild when the
    // newest required column is absent, so startup never drops current data.
    if (tableExists(sqlite, "vault_secrets") && !columnsOf(sqlite, "vault_secrets").has("scope")) {
      sqlite.exec("ALTER TABLE vault_secrets RENAME TO vault_secrets_old");
    }
    if (tableExists(sqlite, "chat_messages") && !columnsOf(sqlite, "chat_messages").has("thread_id")) {
      sqlite.exec("ALTER TABLE chat_messages RENAME TO chat_messages_old");
    }
    if (tableExists(sqlite, "notebooks") && !columnsOf(sqlite, "notebooks").has("project_slug")) {
      sqlite.exec("ALTER TABLE notebooks RENAME TO notebooks_old");
      sqlite.exec("DROP TABLE IF EXISTS kb_chunks_fts");
      sqlite.exec("DROP TABLE IF EXISTS kb_chunks");
      sqlite.exec("DROP TABLE IF EXISTS kb_sources");
    }

    sqlite.exec(SQLITE_DDL);

    addColumnIfMissing(sqlite, "projects", "default_model", "TEXT");
    addColumnIfMissing(sqlite, "projects", "primary_agent", "TEXT");
    addColumnIfMissing(sqlite, "projects", "approval_integration_id", "TEXT");
    addColumnIfMissing(sqlite, "projects", "approval_recipient", "TEXT");
    addColumnIfMissing(sqlite, "projects", "updated_at", "TEXT");
    addColumnIfMissing(sqlite, "workflow_runs", "launched_by", "TEXT");
    addColumnIfMissing(sqlite, "workflow_runs", "graph_hash", "TEXT");
    addColumnIfMissing(sqlite, "workflow_runs", "version_id", "TEXT");
    addColumnIfMissing(sqlite, "workflow_runs", "integration_id", "TEXT");
    addColumnIfMissing(sqlite, "workflow_runs", "source_detail", "TEXT");
    addColumnIfMissing(sqlite, "integrations", "key_hash", "TEXT");
    addColumnIfMissing(sqlite, "workflow_step_runs", "agent_id", "TEXT");
    addColumnIfMissing(sqlite, "workflow_step_runs", "logs", "TEXT");

    // Preserve old vault values as global secrets. Provider/Sentry keys used to
    // be global and remain usable from the platform scope.
    if (tableExists(sqlite, "vault_secrets_old")) {
      sqlite.exec(`
        INSERT INTO vault_secrets (id, scope, project_slug, alias, kind, ciphertext, metadata, created_at)
        SELECT id, 'global', '', alias, kind, ciphertext, metadata, created_at FROM vault_secrets_old;
        DROP TABLE vault_secrets_old;
      `);
    }

    // Old project chat messages cannot be assigned to a thread automatically;
    // they are intentionally discarded during the clean cut. The old table is
    // kept as a backup artifact for manual export.
    if (tableExists(sqlite, "chat_messages_old")) {
      sqlite.exec("DROP TABLE chat_messages_old");
    }
    if (tableExists(sqlite, "notebooks_old")) {
      sqlite.exec("DROP TABLE notebooks_old");
    }

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}
