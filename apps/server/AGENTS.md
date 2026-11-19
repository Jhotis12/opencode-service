# apps/server — backend service (agentic-platform)

Score 13. Subtree root of the backend; every server AGENTS.md below nests under this file.
Stack: Bun + Hono 4 + bun:sqlite/drizzle + zod (`@platform/shared`). No build step — Bun runs the TS directly.

## STRUCTURE
```
apps/server/
├── scripts/migrate-legacy.ts  # one-time legacy DB CLI: requires backup + explicit mapping.json
├── src/index.ts               # entry: createApplication() -> Bun.serve (idleTimeout 120); SIGINT/SIGTERM shutdown chain
├── src/app.ts                 # composition root: 1,912 lines, single createApplication(), 94 inline route handlers (god node #1)
├── src/domain/                # pure core — own AGENTS.md
├── src/application/          # ports + use cases — own AGENTS.md
├── src/infrastructure/       # in/out adapters — own AGENTS.md
└── test/                      # 46 bun:test files, ~10.3k LOC — covered here (score 7)
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Add/change an HTTP route | src/app.ts inline handlers; sub-apps mount via app.route() (pattern: createAuthRoutes, createExternalChatRoutes) |
| Error envelope | `apiError()` from @platform/shared -> `{ error: { code, message } }`, 113 call sites; status mapping in destinationError()/integrationError() (FORBIDDEN 403 / NOT_FOUND 404 / CONFLICT 409 / else 422) |
| Fallback handler | app.onError: logs, tracks, persists, returns 500 INTERNAL_ERROR + requestId only — internals never reach clients |
| Add env var | src/index.ts (bootstrap env) + src/app.ts `config.env ?? process.env` (runtime env) |
| DB schema | src/infrastructure/out/persistence/{schema.ts,migrate.ts} — both must change; see out/ AGENTS.md |
| Add a test | test/<subject>.test.ts mirroring the src import path |

## CONVENTIONS
- Relative imports keep the explicit `.ts` extension (allowImportingTsExtensions).
- Scope/auth: signed session cookie (`platform_session`) OR `x-platform-token` + `x-platform-scope`/`x-platform-project`. Global scope is read-only on project data; project scope cannot reach /api/control/*, /api/vault/*, /api/settings, /api/providers/*.
- User-facing strings Spanish; log event names / API codes English.
- Secrets persist only as vault aliases; mechanism in out/ AGENTS.md.

## ANTI-PATTERNS
- `.catch(() => undefined)` fire-and-forget ~15x in app.ts — only chatTurns.recover() logs its failure.
- `c: any` / `stream: any` in streamLegacyTurn/streamTurn (app.ts ~557-597) — known typing escape in the SSE handlers.
- Application.close() fires `void integrationManager.stopAll()` without awaiting.

## COMMANDS
```bash
bun run --cwd apps/server dev          # bun --watch src/index.ts
bun run --cwd apps/server test         # bun test
bun run --cwd apps/server typecheck    # tsc --noEmit -p tsconfig.json
bun run --cwd apps/server migrate:legacy <db.sqlite> <mapping.json> [backup.sqlite]
```

## NOTES — test/ (score 7, below threshold, covered here)
- Runner: bun:test, NOT Vitest (apps/web uses Vitest; server does not). `{ describe, expect, it }`; no `.only`/`.todo`; zero `as any` — sanctioned partial-port cast is `as never`.
- Standard harness: `new SqliteStore(":memory:")` + `store.close()`; hand-written Fake<Port>/Recording<Port> doubles at file top; production doubles: FakeAgentRuntime, InMemoryMetrics, NoopErrorTracker, HashEmbeddingAdapter.
- app.http.test.ts: one `beforeAll` createApplication (OPENCODE_MODE: "fake"), 32 cases share the instance + a mutable cookie — case ordering is significant.
- Env-gated skips (not failures): SPEECH_E2E_URL, ffmpeg on PATH.
- Verified suite shape: 343 tests / 342 pass / 1 skip / 0 fail, ~17s.
