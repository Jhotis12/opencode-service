# Performance and limits

The resource model was exercised with an in-memory SQLite database to confirm that project-scoped queries do not introduce unbounded scans on the hot paths.

## Measured baseline

Command used: `bun -e` with `SqliteStore` and 500 project integrations plus 1,000 chat messages.

| Operation | Result |
|---|---|
| Insert 500 integrations | ~87 ms |
| List 500 project integrations | ~8 ms |
| Insert 1,000 chat messages | ~55 ms |
| List 200 messages for one thread | ~2 ms |

These are development baselines, not capacity guarantees. The important properties are:

- Integration listing is indexed by `(scope, project_slug)`.
- Integration lookup by slug is unique by `(scope, project_slug, slug)`.
- Chat history is indexed by `thread_id, created_at`.
- Channel routing resolves one integration and one project; it no longer scans every project on each message.
- Integration adapters are started per integration and stopped independently; a failure is isolated and does not stop the process.
- Alerts are deduplicated and throttled so a failure storm does not produce a message storm.

## Operational limits

- SQLite WAL remains the platform store; a single container is the deployment unit.
- Each active Telegram/WhatsApp integration holds a connection in the same Bun process.
- Email is not implemented yet; when it is, mailbox polling and attachment limits must be added as adapter-level constraints.
- The global orchestrator uses read-only queries and does not preload all project data into a prompt.

## Verification

The acceptance E2E covers project creation, canvas, manual launch, chat, project resources, external chat and the global orchestrator:

```bash
bun run test:e2e
```
