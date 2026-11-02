import { Database } from "bun:sqlite";
import { runLegacyMigration } from "../src/infrastructure/out/persistence/legacy-migration.ts";
import { migrate } from "../src/infrastructure/out/persistence/migrate.ts";

const [databasePath, mappingPath, backupPath] = Bun.argv.slice(2);
if (!databasePath || !mappingPath) {
  console.error("usage: bun scripts/migrate-legacy.ts <database.sqlite> <mapping.json> [backup.sqlite]");
  process.exit(2);
}

const mapping = (await Bun.file(mappingPath).json()) as Parameters<typeof runLegacyMigration>[1];
const sqlite = new Database(databasePath, { create: true });
try {
  const result = runLegacyMigration(sqlite, mapping, { backupPath });
  migrate(sqlite);
  console.log(JSON.stringify(result, null, 2));
} finally {
  sqlite.close();
}
