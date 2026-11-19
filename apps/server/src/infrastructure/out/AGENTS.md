# src/infrastructure/out — driven adapters (persistence, vendors)

Score 14 (23 files, 14 subdirs, 5,420 LOC). Earned file: SqliteStore is god node #2 (78 edges) and the migration discipline lives here.

## WHERE TO LOOK
| Concern | Location |
|---------|----------|
| All persistence | persistence/sqlite-store.ts (1,670) — Store impl as 19 grouped sub-repositories + deleteProjectData cascade + versions rollback |
| Schema | persistence/schema.ts — 22 drizzle sqliteTable exports. AND migrate.ts SQLITE_DDL — two sources, both must change |
| Migrations | persistence/migrate.ts — warnings below |
| Legacy migration | persistence/legacy-migration.ts + scripts/migrate-legacy.ts |
| Agent runtime | opencode/opencode-adapter.ts — OpenCodeV2Adapter, lazy cached client; transport-shaped error -> reset + retry once |
| Fake runtime | opencode/fake-runtime.ts — OPENCODE_MODE=fake; mirrors the full AgentRuntimePort = de-facto reference contract |
| External DB | external-db/dynamic-adapter.ts — sqlite/postgres/mysql/mssql, one flow each; sanitizeDatabaseError |
| Workspace FS | workspace-fs/safe-workspace.ts (459) — atomic `.tmp-<uuid>`+rename writes, realpath symlink guard, `../**` denied, node code must be `nodes/*.ts` |
| Media store | media/fs-media-store.ts — magic-byte sniff, sha256 filenames, mode 0o600, flag wx |
| Vault | vault/aes-vault.ts — AES-256-GCM, `v1:<iv>:<tag>:<ciphertext>`, loadOrCreateMasterKey(dataDir/master.key) |
| Worker sandbox | worker-sandbox/ — one Bun Worker per execution; db/notify RPC proxied to parent so secrets never enter the thread; node module must export a default async function |
| Knowledge | knowledge/ — DocumentExtractor (.md .txt .csv .pdf .docx, 20 MB); HashEmbeddingAdapter = fallback when EMBEDDINGS_URL unset |
| Speech / transcription | openai-compatible services, injectable fetchImpl |
| Telemetry | telemetry/logger.ts (pino + redact), telemetry/sentry.ts (sanitizeSentryEvent; NoopErrorTracker default) |

## MIGRATION WARNINGS
- migrate.ts DROPs channels, external_databases, conversation_threads and discards chat_messages_old/notebooks_old — destructive by design; a legacy DB must run runLegacyMigration with an explicit mapping BEFORE migrate, after a backup.
- Rebuilds fire only when the newest required column is absent, so startup never drops current data; addColumnIfMissing is the additive path.
- Schema changes touch BOTH schema.ts (drizzle) and SQLITE_DDL (migrate.ts).

## DATABASE SETUP
openDatabase: WAL (skipped for `:memory:`), foreign_keys=ON, busy_timeout=5000. bun:sqlite + drizzle-orm/bun-sqlite only.

## GOTCHAS
- sqlite-store.ts is a documented perf-sensitive baseline (docs/performance.md) — measure before changing hot paths.
- Vendor drivers (pg, mysql2, mssql, unpdf, mammoth, @whiskeysockets/baileys) load via dynamic import only — never add a static import.
- createAgentRuntime sets OPENCODE_DB / XDG_STATE_HOME under `<dataDir>/opencode` — per-service isolation of the OpenCode runtime.
- Worker timeouts raise WorkerTimeoutError; KnowledgeFileStore writes `<workspaces>/<project>/knowledge/<notebook>/sources/<sourceId>.md`.
