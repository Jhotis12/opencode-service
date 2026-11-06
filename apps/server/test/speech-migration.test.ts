import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("speech settings migration", () => {
  it("adds the speech setting column without backfilling existing projects", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-speech-migration-"));
    dirs.push(dir);
    const path = join(dir, "platform.sqlite");
    const db = new Database(path);
    db.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      INSERT INTO projects VALUES ('p1','ventas','Ventas','', '2026-01-01');
    `);
    db.close();

    const store = new SqliteStore(path);
    const project = store.projects.findBySlug("ventas");
    expect(project?.name).toBe("Ventas");
    expect(project?.speechIntegrationId).toBeUndefined();
    store.close();

    const check = new Database(path);
    const columns = check.query("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "speech_integration_id")).toBe(true);
    check.close();
  });
});
