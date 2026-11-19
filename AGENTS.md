# PROJECT KNOWLEDGE BASE

**Generated:** 2026-11-19
**Commit:** 9e27f91e
**Branch:** main

## OVERVIEW

Agentic workflow platform on Bun workspaces: a Bun+Hono hexagonal server (bun:sqlite + drizzle, OpenCode-orchestrated agents, claim-based concurrency) plus a React 19/Vite SPA with a React Flow workflow canvas, zod-contracted through @platform/shared. Spec-driven planning lives in openspec/; user-facing copy is Spanish repo-wide.

## STRUCTURE

```
opencode-service/
├── apps/server/                        # Bun+Hono backend; NO build step (Bun runs TS); hexagonal src/{domain,application,infrastructure}
│   ├── src/app.ts                      # createApplication() composition root; 1,912 lines, 94 inline handlers
│   ├── src/application/use-cases/      # execute-workflow (1,408 lines), chat-turns (919); claim-based atomicity
│   └── src/infrastructure/out/         # SqliteStore (1,670 lines, 19 repos), opencode adapter, AES-GCM vault
├── apps/web/                           # React 19 + Vite 6 SPA; React Flow canvas; dark theme only
├── packages/shared/                    # @platform/shared: 11 zod modules barrel-exported from src/index.ts; raw TS, no build
├── packages/opencode-plugin/           # OpenCode CLI plugin; NOT covered by root `bun run test`
├── openspec/                           # specs/ = capability truth (11); changes/ = review-gated deltas + archive/
├── e2e/                                # Playwright; start-server.ts boots the real server (OPENCODE_MODE=fake)
├── docs/                               # no index; design-standard.md -> ui-motion.md; prose Spanish
├── .opencode/commands/, .opencode/skills/   # opsx-* slash commands + 7 skills drive the openspec lifecycle
├── docker-compose.yml, Dockerfile, entrypoint.sh  # platform + speaches transcription + one-shot model init
├── .github/workflows/ci.yml            # the single CI workflow (PR + push to main, 15-min cap)
└── playwright.config.ts                # workers 1; 127.0.0.1:3100
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify an API handler | apps/server/src/app.ts | composition root; scope/auth model inline; single wiring point |
| New use case (workflow/chat/queue) | apps/server/src/application/use-cases/ | claim-based atomicity; maxConcurrentRuns 2/project, overflow queued |
| DB schema change | apps/server/src/infrastructure/out/persistence/ (schema.ts + migrate.ts) | two sources must change together; migrate() is destructive |
| New workflow node type | packages/shared/src/configuration.ts + apps/web/src/components/ | NODE_CONFIG_REGISTRY; catalog nodes/node-catalog.ts, rules canvas/graph-edits.ts |
| New integration config | packages/shared/src/configuration.ts | INTEGRATION_CONFIG_REGISTRY; validate via shared validateIntegrationConfig only |
| UI route/page | apps/web/src/App.tsx + src/pages/ | 7 screens; cache keys via `qk` factory in src/query.ts |
| Chat streaming | apps/web/src/useChatTurn.ts + readTurnStream in src/api.ts | hand-parsed SSE turn state machine |
| Server push events | SSE `/api/events` -> pages/ProjectPage.tsx | |
| Secrets | apps/server/src/infrastructure/out (vault) | AES-256-GCM; `secretRefs` aliases only; master.key under DATA_DIR |
| Spec proposal/delivery | openspec/changes/ via opsx-* commands | propose stops at plan; apply = separate request, branch change/<name>, never auto-merge |
| Effective config resolution | entity -> project -> platform -> env -> default | GET /api/config/effective |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| createApplication() | fn | apps/server/src/app.ts | single composition root wiring all adapters |
| SqliteStore | class | apps/server/src/infrastructure/out | 19 grouped repos; WAL; busy_timeout 5000 |
| runLegacyMigration | fn | apps/server/src/infrastructure/out/persistence/migrate.ts | explicit legacy mapping + backup; must precede migrate() |
| execute-workflow / chat-turns | use-case | apps/server/src/application/use-cases/ | engine files (1,408 / 919 lines); claim-based atomicity |
| apiError() | fn | packages/shared | `{ error: { code, message } }` envelope; app.onError hides internals (500 + requestId) |
| NODE_CONFIG_REGISTRY / INTEGRATION_CONFIG_REGISTRY | const | packages/shared/src/configuration.ts | node + integration config contracts (L501 / L211) |
| PlatformToolNameSchema | zod | packages/shared/src/agents.ts | 13 tool names; must stay in sync with rawTools |
| rawTools / GLOBAL_READ_ONLY_TOOLS | const | packages/opencode-plugin/src/tools.ts | plugin tool defs; global scope read-only (L152) |
| readTurnStream / useChatTurn | fn/hook | apps/web/src/api.ts / src/useChatTurn.ts | hand-parsed SSE stream + turn state machine |
| WorkflowCanvas / graph-edits | component | apps/web/src/components/ | single `platform` node/edge type; canvas graph rules |

## CONVENTIONS

- Every relative import keeps its `.ts`/`.tsx` extension (`allowImportingTsExtensions`); named exports only repo-wide (sole default export: the opencode plugin's `Plugin.define`).
- bun.lock is authoritative; root pnpm-lock.yaml / pnpm-workspace.yaml are vestigial; Bun only.
- Dependency direction: apps -> packages; packages are pure schemas/functions (only I/O: the plugin's HttpPlatformClient) and never import `apps/*`.
- infrastructure naming: `*Adapter` (driven), `*Service`, `*Transport`, `create*` factories; network access injectable via `fetchImpl`.
- Test runners: apps/server + packages/* = bun:test (server: in-memory SqliteStore, `as never` sanctioned for partial-port injection); apps/web = Vitest/jsdom, specs render via test/render.tsx `renderWithProviders`.
- API errors always via `apiError()`; user-facing strings Spanish, log events/API codes English.

## ANTI-PATTERNS (THIS PROJECT)

- NEVER run `migrate()` without `runLegacyMigration` first; destructive to legacy tables.
- NEVER change schema.ts without the matching migrate.ts DDL; two schema sources.
- No raw secrets in configs/artifacts; `secretRefs` aliases (`secret:<alias>`, `{{secret.<alias>}}`) only; the LLM never sees values.
- Render LLM output via ReactMarkdown only; no innerHTML/eval.
- Nodes route by `integrationId`, never slugs; one project per integration/event; project isolation is absolute.
- No multi-instance deployments: queue/timers/scheduler live in ONE process.
- Don't add `.catch(() => undefined)` or `c:any` SSE handlers; the ~15x in app.ts is acknowledged debt, don't extend it.
- Don't hardcode openspec artifact ids/paths; read `openspec status/instructions --json`.
- Don't flag graphify-out/graph.json whole-file rewrites as churn, and don't skip graphify because its output is dirty.
- Don't assume root `bun run test` covers everything; it omits packages/opencode-plugin (CI gap).

## UNIQUE STYLES

- Design system: class-string constants in apps/web/src/ui.ts (27 importers) + CSS-var tokens in one Tailwind `@theme` block (apps/web/src/index.css); dark theme only; desktop-first 1280x800 / 1440x900.
- docs/design-standard.md is the UI source of truth; docs/ui-motion.md owns motion (<300 ms, transform/opacity only, `--motion-*` tokens).
- Extension pattern = registries: new node/integration types enter via shared registries + web node catalog, not bespoke code paths.

## COMMANDS

```bash
bun install --frozen-lockfile    # CI/Docker entry point
bun run dev                      # API :3000 (first boot: DATA_DIR=./data OPENCODE_MODE=fake bun run dev)
bun run dev:web                  # Vite :5173, proxies /api -> :3000
bun run typecheck                # shared -> opencode-plugin -> server -> web
bun run test                     # shared -> server -> web (opencode-plugin NOT included)
bun run build                    # apps/web only; server has no build step
bun run test:e2e                 # Playwright; run `bun run build` FIRST (e2e serves built apps/web/dist)
bun run --cwd apps/server migrate:legacy
docker compose up --build -d     # platform + speaches transcription + one-shot model init
```

## NOTES

- SQLite is the documented perf baseline (docs/performance.md); vendor drivers (pg/mysql2/mssql/unpdf/mammoth/baileys) are dynamic-import only.
- Concurrency: maxConcurrentRuns 2 per project, overflow queued; idempotency via order-independent SHA-256 payloadHash; DB writes are at-least-once -> idempotent SQL.
- DB guardrails: `access: "read"` rejects writes+DDL; DDL needs `allowDdl: true`; maxRows ceiling 10,000 (default 1,000); SSRF checks (loopback/private/redirects/size) on ingestion + webhooks.
- Env knobs: DATA_DIR, PORT, OPENCODE_MODE (fake|auto), CHAT_TURN_ENGINE (v2|legacy), ORCHESTRATOR_MODEL, EMBEDDINGS_*, SESSION_TTL_HOURS, SENTRY_DSN.
- Sync trap: the 13 platform tool names are declared twice; PlatformToolNameSchema (packages/shared/src/agents.ts) vs rawTools (packages/opencode-plugin/src/tools.ts).
- openspec: `chat-turn-lifecycle` + `configuration-registry` are referenced by active changes but absent from specs/; the openspec CLI is required but NOT on PATH in this environment.
- Two planes under DATA_DIR: project `/data/workspaces/<slug>` and control `/data/control` (global orchestrator, GET-only with global credential).
- entrypoint.sh backs up platform.sqlite (keeps 10 newest) pre-migration and generates PLATFORM_SERVICE_TOKEN / PLATFORM_GLOBAL_TOKEN when unset; README's `master.key` listing is stale; entrypoint never creates it.
- Known debt: 5 application files import infrastructure; `c:any` in SSE handlers; ports/runtime.ts is a grab-bag.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
