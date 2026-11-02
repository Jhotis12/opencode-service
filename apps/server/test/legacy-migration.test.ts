import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../src/infrastructure/out/persistence/db.ts";
import { runLegacyMigration } from "../src/infrastructure/out/persistence/legacy-migration.ts";
import { migrate } from "../src/infrastructure/out/persistence/migrate.ts";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function seedLegacy(sqlite: ReturnType<typeof openDatabase>["sqlite"]) {
  sqlite.exec(`
    CREATE TABLE channels (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL, name TEXT NOT NULL,
      config_ciphertext TEXT, key_hash TEXT, admin_allowlist TEXT NOT NULL DEFAULT '[]',
      is_public INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'disconnected',
      webhook_url TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE external_databases (
      id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE, driver TEXT NOT NULL,
      ciphertext TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE notebooks (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE kb_sources (
      id TEXT PRIMARY KEY, notebook_id TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
      uri TEXT, markdown_path TEXT, summary TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
    );
    CREATE TABLE kb_chunks (
      id TEXT PRIMARY KEY, source_id TEXT NOT NULL, notebook_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
      section TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, embedding TEXT, created_at TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE kb_chunks_fts USING fts5(chunk_id UNINDEXED, notebook_id UNINDEXED, content);
  `);
  const now = new Date().toISOString();
  sqlite
    .query("INSERT INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("c1", "ventas-bot", "telegram", "Ventas", "cipher", null, '["123"]', 1, "connected", null, now);
  sqlite
    .query("INSERT INTO channels VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run("c2", "orphan-bot", "telegram", "Orphan", "cipher", null, '[]', 0, "connected", null, now);
  sqlite.query("INSERT INTO external_databases VALUES (?,?,?,?,?)").run("d1", "crm", "postgres", "cipher", now);
  sqlite.query("INSERT INTO notebooks VALUES (?,?,?,?,?)").run("n1", "manual", "Manual", "", now);
  sqlite.query("INSERT INTO kb_sources VALUES (?,?,?,?,?,?,?,?)").run("s1", "n1", "doc", "markdown", null, null, "", now);
  sqlite.query("INSERT INTO kb_chunks VALUES (?,?,?,?,?,?,?,?)").run("k1", "s1", "n1", 0, "", "contenido", null, now);
}

describe("legacy resource migration", () => {
  it("maps resources explicitly, reports orphans and creates a backup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-legacy-"));
    dirs.push(dir);
    const handle = openDatabase(":memory:");
    seedLegacy(handle.sqlite);
    const backupPath = join(dir, "backup.sqlite");
    const result = runLegacyMigration(
      handle.sqlite,
      {
        channels: { "ventas-bot": { scope: "project", projectSlug: "ventas" } },
        databases: { crm: { scope: "project", projectSlug: "ventas" } },
        notebooks: { manual: "ventas" },
      },
      { backupPath },
    );
    expect((await stat(backupPath)).size).toBeGreaterThan(0);
    const backup = new Database(backupPath, { readonly: true });
    expect(backup.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'channels'").get()).toBeDefined();
    backup.close();
    expect(result.migratedChannels).toBe(1);
    expect(result.migratedDatabases).toBe(1);
    expect(result.migratedNotebooks).toBe(1);
    expect(result.skipped.some((item) => item.id === "orphan-bot")).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);

    migrate(handle.sqlite);
    const store = new SqliteStore(":memory:");
    // Use the same handle's database through a fresh store is not possible;
    // validate the migrated rows directly through SQL.
    const channels = handle.sqlite.query("SELECT * FROM integrations WHERE scope = 'project'").all() as Array<{
      project_slug: string;
      kind: string;
    }>;
    expect(channels.some((row) => row.project_slug === "ventas" && row.kind === "telegram")).toBe(true);
    expect(channels.some((row) => row.project_slug === "ventas" && row.kind === "postgres")).toBe(true);
    const notebook = handle.sqlite.query("SELECT project_slug FROM notebooks WHERE slug = 'manual'").get() as {
      project_slug: string;
    };
    expect(notebook.project_slug).toBe("ventas");
    const source = handle.sqlite.query("SELECT * FROM kb_sources WHERE id = 's1'").get();
    expect(source).toBeDefined();
    store.close();
    handle.close();
  });
});
