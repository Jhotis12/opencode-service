import type { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defaultCapabilities, type IntegrationKind } from "@platform/shared";

export interface LegacyMigrationMapping {
  channels: Record<string, { scope: "project" | "global"; projectSlug?: string }>;
  databases: Record<string, { scope: "project" | "global"; projectSlug?: string }>;
  notebooks: Record<string, string>;
  defaultProjectSlug?: string;
}

export interface LegacyMigrationResult {
  migratedChannels: number;
  migratedDatabases: number;
  migratedNotebooks: number;
  skipped: Array<{ kind: "channel" | "database" | "notebook"; id: string; reason: string }>;
  warnings: string[];
  backupPath?: string;
}

interface LegacyChannelRow {
  id: string;
  slug: string;
  type: string;
  name: string;
  key_hash: string | null;
  admin_allowlist: string;
  is_public: number;
  status: string;
  webhook_url: string | null;
  created_at: string;
}

interface LegacyDatabaseRow {
  id: string;
  alias: string;
  driver: string;
  created_at: string;
}

interface LegacyNotebookRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_at: string;
}

function tableExists(sqlite: Database, table: string): boolean {
  return Boolean(sqlite.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function hasColumn(sqlite: Database, table: string, column: string): boolean {
  return (sqlite.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((item) => item.name === column);
}

export function createMigrationBackup(sqlite: Database, backupPath: string): string {
  mkdirSync(dirname(backupPath), { recursive: true });
  sqlite.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`);
  return backupPath;
}

function ensureIntegrationsTable(sqlite: Database): void {
  sqlite.exec(`
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
  `);
}

function channelKind(type: string): IntegrationKind | undefined {
  return ["telegram", "whatsapp", "external_chat"].includes(type)
    ? (type as IntegrationKind)
    : undefined;
}

function databaseKind(driver: string): IntegrationKind | undefined {
  return ["postgres", "mysql", "mssql", "sqlite"].includes(driver) ? (driver as IntegrationKind) : undefined;
}

/**
 * One-time legacy mapping. It must run before `migrate` and after an external
 * backup. Unassignable resources are reported and never silently attached to a
 * different project.
 */
export function runLegacyMigration(
  sqlite: Database,
  mapping: LegacyMigrationMapping,
  options: { backupPath?: string } = {},
): LegacyMigrationResult {
  const result: LegacyMigrationResult = {
    migratedChannels: 0,
    migratedDatabases: 0,
    migratedNotebooks: 0,
    skipped: [],
    warnings: [],
    backupPath: options.backupPath ? createMigrationBackup(sqlite, options.backupPath) : undefined,
  };

  sqlite.exec("BEGIN");
  try {
    ensureIntegrationsTable(sqlite);
    const now = new Date().toISOString();

    if (tableExists(sqlite, "channels")) {
      const rows = sqlite.query("SELECT * FROM channels").all() as LegacyChannelRow[];
      for (const row of rows) {
        const target = mapping.channels[row.slug] ?? (mapping.defaultProjectSlug
          ? { scope: "project" as const, projectSlug: mapping.defaultProjectSlug }
          : undefined);
        const kind = channelKind(row.type);
        if (!target || !kind) {
          result.skipped.push({ kind: "channel", id: row.slug, reason: target ? "unsupported channel type" : "no project mapping" });
          continue;
        }
        const routing = {
          mode: "hybrid",
          allowlist: JSON.parse(row.admin_allowlist || "[]") as string[],
          public: row.is_public === 1,
        };
        sqlite
          .query(
            `INSERT INTO integrations
             (id, scope, project_slug, kind, name, slug, config, secret_refs, capabilities, status, key_hash, last_error, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, 'needs_config', ?, 'legacy migration: re-enter credentials', ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            target.scope,
            target.scope === "project" ? target.projectSlug ?? "" : "",
            kind,
            row.name,
            row.slug,
            JSON.stringify({ routing, ...(row.webhook_url ? { webhookUrl: row.webhook_url } : {}) }),
            JSON.stringify(defaultCapabilities(kind)),
            row.key_hash,
            row.created_at || now,
            now,
          );
        result.migratedChannels += 1;
        result.warnings.push(`channel ${row.slug}: credentials must be re-entered because the legacy value was encrypted per channel`);
      }
      sqlite.exec("DROP TABLE channels");
    }

    if (tableExists(sqlite, "external_databases")) {
      const rows = sqlite.query("SELECT * FROM external_databases").all() as LegacyDatabaseRow[];
      for (const row of rows) {
        const target = mapping.databases[row.alias] ?? (mapping.defaultProjectSlug
          ? { scope: "project" as const, projectSlug: mapping.defaultProjectSlug }
          : undefined);
        const kind = databaseKind(row.driver);
        if (!target || !kind) {
          result.skipped.push({ kind: "database", id: row.alias, reason: target ? "unsupported driver" : "no project mapping" });
          continue;
        }
        sqlite
          .query(
            `INSERT INTO integrations
             (id, scope, project_slug, kind, name, slug, config, secret_refs, capabilities, status, key_hash, last_error, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, '{}', '{}', ?, 'needs_config', NULL, 'legacy migration: re-enter connection credentials', ?, ?)`,
          )
          .run(
            crypto.randomUUID(),
            target.scope,
            target.scope === "project" ? target.projectSlug ?? "" : "",
            kind,
            row.alias,
            row.alias,
            JSON.stringify(defaultCapabilities(kind)),
            row.created_at || now,
            now,
          );
        result.migratedDatabases += 1;
        result.warnings.push(`database ${row.alias}: connection credentials must be re-entered after migration`);
      }
      sqlite.exec("DROP TABLE external_databases");
    }

    if (tableExists(sqlite, "notebooks")) {
      if (!hasColumn(sqlite, "notebooks", "project_slug")) {
        sqlite.exec("ALTER TABLE notebooks ADD COLUMN project_slug TEXT NOT NULL DEFAULT ''");
      }
      const rows = sqlite.query("SELECT * FROM notebooks").all() as LegacyNotebookRow[];
      for (const row of rows) {
        const projectSlug = mapping.notebooks[row.slug] ?? mapping.defaultProjectSlug;
        if (!projectSlug) {
          result.skipped.push({ kind: "notebook", id: row.slug, reason: "no project mapping" });
          continue;
        }
        sqlite.query("UPDATE notebooks SET project_slug = ? WHERE id = ?").run(projectSlug, row.id);
        result.migratedNotebooks += 1;
      }
      sqlite.exec("DELETE FROM notebooks WHERE project_slug = ''");
    }

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
  return result;
}
