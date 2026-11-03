import { afterEach, describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteStore } from "../src/infrastructure/out/persistence/sqlite-store.ts";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("chat turn migration", () => {
  it("adds turn columns and tables without losing historical chat messages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "platform-chat-migration-"));
    dirs.push(dir);
    const path = join(dir, "platform.sqlite");
    const db = new Database(path);
    db.exec(`
      CREATE TABLE chat_threads (
        id TEXT PRIMARY KEY, scope TEXT NOT NULL, project_slug TEXT NOT NULL DEFAULT '',
        integration_id TEXT NOT NULL DEFAULT '', external_thread_id TEXT NOT NULL DEFAULT '',
        opencode_session_id TEXT, title TEXT, created_at TEXT NOT NULL, last_active_at TEXT NOT NULL
      );
      CREATE TABLE chat_messages (
        id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO chat_threads VALUES ('t1','project','p1','','web',NULL,'old', '2026-01-01', '2026-01-01');
      INSERT INTO chat_messages VALUES ('m1','t1','user','hola','2026-01-01');
    `);
    db.close();

    const store = new SqliteStore(path);
    const messages = store.chat.listByThread("t1", 10);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe("hola");
    expect(messages[0]?.turnId).toBeUndefined();
    expect(store.chatTurns.listActive()).toEqual([]);
    store.close();
  });
});
