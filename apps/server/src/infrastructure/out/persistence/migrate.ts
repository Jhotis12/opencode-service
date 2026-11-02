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
  alias TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS external_databases (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  driver TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL
);
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
  chat_session_id TEXT,
  created_at TEXT NOT NULL
);
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
  started_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS workflow_runs_idempotency
  ON workflow_runs(project_slug, workflow_id, idempotency_key);
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
CREATE TABLE IF NOT EXISTS conversation_threads (
  id TEXT PRIMARY KEY,
  channel_slug TEXT NOT NULL,
  external_thread_id TEXT NOT NULL,
  opencode_session_id TEXT,
  project_slug TEXT,
  workflow_id TEXT,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_threads_unique
  ON conversation_threads(channel_slug, external_thread_id);
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config_ciphertext TEXT,
  key_hash TEXT,
  admin_allowlist TEXT NOT NULL DEFAULT '[]',
  is_public INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'disconnected',
  webhook_url TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  project_slug TEXT NOT NULL,
  session_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_messages_project ON chat_messages(project_slug, created_at);
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
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

export function migrate(sqlite: Database): void {
  sqlite.exec("BEGIN");
  try {
    sqlite.exec(SQLITE_DDL);
    const columns = sqlite.query("PRAGMA table_info(workflow_step_runs)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "agent_id")) {
      sqlite.exec("ALTER TABLE workflow_step_runs ADD COLUMN agent_id TEXT");
    }
    if (!columns.some((column) => column.name === "logs")) {
      sqlite.exec("ALTER TABLE workflow_step_runs ADD COLUMN logs TEXT");
    }
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}
