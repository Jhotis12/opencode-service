# packages/shared — @platform/shared

## OVERVIEW

Zod schema/type pairs + UI config registries — the repo's single source of truth for wire contracts, consumed by `apps/server`, `apps/web`, and `packages/opencode-plugin` (86 import files under `apps/`).
Earned its file: score 12 (`src/index.ts` barrel, 100+ exports, `WorkflowGraph` at 28 import sites); distinct domain: pure contracts, no I/O.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Wire contract | `src/<domain>.ts` | api, workflow, agents, integrations, destinations, settings, chat, media, telemetry, events — flat, no subfolders |
| Node/integration config metadata | `src/configuration.ts` (843 LOC) | `INTEGRATION_CONFIG_REGISTRY` (L211), `NODE_CONFIG_REGISTRY` (L501) |
| Registry accessors | `src/configuration.ts` (L804+) | `nodeConfigDefinition()`, `defaultNodeConfig()`, `validateNodeConfig()`, `integrationConfigDefinition()`, `validateIntegrationConfig()`, `integrationEvents()` |
| Tool permission rules | `src/agents.ts` `evaluateToolPermission` | the only decision point repo-wide; `deny` beats `allow` |
| Graph contracts | `src/workflow.ts` (324 LOC) | `NodeSpec`/`Edge`/`WorkflowGraph`; kebab-case ids enforced by schema |
| Error/pagination envelopes | `src/api.ts` | `apiError(code, message, details?)`, `paginated()` |
| Secret field detection | `src/configuration.ts` `findSecretLikeFields()` | flags `token\|password\|secret\|api[_-]?key\|dsn\|credential`, exempts `*alias\|ref\|username` |

## CONVENTIONS

- Ships raw TypeScript: `main`/`exports` → `./src/index.ts`; no build step, no `dist/`.
- Every zod schema pairs with a same-file inferred type (`NodeSpecSchema` → `NodeSpec`); the barrel re-exports all 11 modules.
- Explicit `.ts` extensions on every specifier (`allowImportingTsExtensions` in tsconfig.base).
- Registries are read only through accessors, never directly.
- `defaultNodeConfig()` returns `structuredClone` copies — registry defaults are never mutated (asserted in tests).
- Integration configs parse with `.passthrough()`; parsers re-attach `kind` before validating.
- Label/help/option strings in `configuration.ts` are Spanish; identifiers and JSDoc are English.
- Tests run on `bun:test` (`test/contracts.test.ts`, `test/config-registry.test.ts`) — a different runner than apps/web's Vitest.

## ANTI-PATTERNS

- Packages never import `apps/*`; the direction is apps → packages (`workspace:*`).
- No custom error classes: the `apiError()` envelope only; `.safeParse` for contract validation, `.parse` (throws) for plugin tool inputs.
- Secret-like config keys must land in registry `secretFields` — `findSecretLikeFields()` drives the UI redaction.
- The 13 platform tool names are dual-declared: `PlatformToolNameSchema` (`src/agents.ts`) AND `rawTools` in `packages/opencode-plugin/src/tools.ts` — keep them in sync.
- Slugs and node ids must be kebab-case; schemas reject `../evil` and `Node_1`.

## COMMANDS

```bash
bun test --cwd packages/shared        # 26 tests, 2 files
bun run --cwd packages/shared typecheck
```
