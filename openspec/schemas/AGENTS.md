# openspec/schemas/ — Delivery workflow contract

**Earned:** score 8 — 5 files / 402 LOC, but the single source of every artifact instruction; declared by `openspec/config.yaml` and by every active change's `.openspec.yaml`. Distinct domain: process contract, not product specs.

## OVERVIEW
Defines `review-gated-delivery`, the only schema in use: artifact ids, dependency edges, output paths, and apply/archive guidance.

## WHERE TO LOOK
| File | Role |
|------|------|
| `review-gated-delivery/schema.yaml` | 315 lines: artifact ids, `requires` edges, guidance |
| `review-gated-delivery/templates/proposal.md` | Proposal template |
| `review-gated-delivery/templates/spec.md` | Delta-spec template |
| `review-gated-delivery/templates/design.md` | Design template |
| `review-gated-delivery/templates/tasks.md` | Tasks template |

## CONVENTIONS
- Artifact ids: `proposal`, `specs`, `design`, `tasks`; outputs `proposal.md`, `specs/**/*.md`, `design.md`, `tasks.md`.
- Dependency edges: `specs` and `design` require `[proposal]`; `tasks` requires `[specs, design]`; apply requires `[tasks]`.
- The edges set the build frontier: proposal first, then specs and design, then tasks; `/opsx-apply` is gated on tasks.
- `openspec/config.yaml` mirrors this contract: `operations.apply.guidance` (5 entries) and `operations.archive.guidance` (3 entries).
- Schema choice happens at `openspec new change --schema` and is pinned in each `.openspec.yaml`; `spec-driven` survives only in 4 archived changes.
- Artifact statuses and `applyRequires` arrive via `openspec status --change <name> --json` (`artifacts[].status`, `artifacts[].requires`).
- Inventory: `openspec schemas --json`.
- opsx commands consume `openspec instructions <artifact-id> --json` (template, rules, `resolvedOutputPath`) rather than parsing `schema.yaml`.

## ANTI-PATTERNS
- NEVER branch on hardcoded artifact ids — read ids and paths from `openspec status --json`.
- NEVER write to a glob `resolvedOutputPath` — only concrete files in `artifactPaths.<id>.existingOutputPaths`.
- NEVER infer delta specs from other artifacts — `artifactPaths.specs.existingOutputPaths` is authoritative.
- NEVER expect `openspec-update` to create missing artifacts — it is revision-only and never advances the build frontier.
