# openspec/specs/ — Authoritative capability specs (current truth)

**Earned:** score 13 — 11 capability dirs, 94 requirements / 314 scenarios, 11 exports; sync target of `/opsx-sync`, read source for apply/explore. Distinct domain: what the system IS, not deltas or workflow.

## OVERVIEW
Synced main specs; every merged change delta lands here via `/opsx-sync`.

## WHERE TO LOOK
| Capability | Density / focus |
|------------|-----------------|
| `workflow-and-workspace-engine` | 26 req / 91 scen — largest, most referenced |
| `agent-chat-experience` | 9 req / 32 scen |
| `project-resources` | 9 req / 31 scen |
| `multi-agent-catalog` | 8 req / 25 scen |
| `identity-and-bootstrap` | 7 req / 21 scen |
| `interface-design-system` | 7 req / 23 scen — the only English spec |
| `observability-and-testing-harness` | 7 req / 23 scen |
| `global-orchestrator` | 6 req / 20 scen |
| `project-isolation` | 6 req / 20 scen |
| `knowledge-base-notebooks` | 5 req / 15 scen |
| `omnichannel-and-chat-gateway` | 4 req / 13 scen |

## CONVENTIONS
- Format: `# <capability> Specification` -> `## Purpose` -> `## Requirements`.
- `### Requirement: <name>` with SHALL/MUST wording; `#### Scenario:` (exactly four hashtags) with `- **WHEN**` / `- **THEN**` bullets.
- Every requirement carries at least one scenario; requirement text stays <= 500 chars (plain `openspec validate` warns, `--strict` fails).
- Delta operation headers (ADDED / MODIFIED / REMOVED / RENAMED) must never survive into a main spec.
- A new main spec copies the delta's `## Purpose` verbatim; write TBD only if the delta had none.
- Capability inventory lives in `openspec list --specs`, not in plain `openspec list`.

## ANTI-PATTERNS
- NEVER invent a missing requirement for a MODIFIED/RENAMED delta whose main spec does not exist — report it instead.
- NEVER rewrite an existing authored `## Purpose` to satisfy a delta that lacks one.
- Only ADDED requirements may create a new main spec; a sync-blocked capability halts the whole sync.
- Capability retirement requires all six conditions, including `retire_capabilities: true` and a `spec.md` resolving inside the real specs root.
