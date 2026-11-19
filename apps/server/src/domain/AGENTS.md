# src/domain — pure business core

Score 11 (7 subdirs, high symbol centrality). Earned file: innermost layer with its own rules — inert data plus throwing validators, no framework imports.

## STRUCTURE
```
domain/
├── entities.ts   # flat bag: 22 *Record interfaces + EntityScope — shared vocabulary of every layer
├── media.ts      # attachment resolution (does node:fs I/O — see GOTCHAS)
├── agents/  channels/  identity/  integrations/  knowledge/  telemetry/  workflow/
```

## WHERE TO LOOK
| Concern | Location |
|---------|----------|
| Persisted record shape | entities.ts — inert interfaces, string ids, ISO string timestamps |
| Workflow invariants | workflow/graph.ts — validateWorkflowGraph: single trigger, no cycles, decision nodes exactly 2 edges (true/false), reachability from trigger |
| Cron / scheduler | workflow/cron.ts — stateful WorkflowScheduler (30s ticks) + 5-field cron, IANA timezone support |
| Input / template rules | workflow/input.ts; workflow/template.ts (`{{ input.a.b }}` syntax, JSON.parse fallback) |
| Channel message routing | channels/router.ts — approval commands, sender allowlists, decision agent/workflow/approval/dropped |
| Metrics / logging / redaction | telemetry/ — InMemoryMetrics (ring buffer 2,000, p50/p95/p99), SECRET_KEY_PATTERN redact |
| SSRF guard | knowledge/url-safety.ts assertSafeUrl — rejects localhost/*.local/*.internal, private/ULA/link-local IPs |
| Password policy | identity/password-policy.ts — min 12 chars, must differ from shipped default |
| SQL classification | integrations/sql.ts (read/write/ddl) |
| Integration validation | integrations/validation.ts — secret-like fields rejected ("use the secret store") |

## CONVENTIONS
- Invariant violations throw, never return: `validate*`/`assert*` carrying `issues: string[]` or a string-union `code`; error classes set `this.name`.
- Files kebab-case; no barrel — full relative paths everywhere.
- Hashes are key-sorted, order-independent SHA-256: computeGraphHash (strips updatedAt), computePayloadHash.

## GOTCHAS (layer is not perfectly pure)
- workflow/cron.ts imports application ports/use-cases (type-only) and holds the stateful WorkflowScheduler — the scheduler lives in domain, not application.
- media.ts (node:fs) and knowledge/url-safety.ts (node:dns) do direct I/O inside domain.
- EntityScope in entities.ts duplicates IntegrationScope from @platform/shared.
- validateWorkflowGraph is one ~140-line function accumulating every invariant — edit carefully.
- Largest files: cron.ts 493, entities.ts 304 (25 exports), graph.ts 265.
