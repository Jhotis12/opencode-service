# openspec/ — Spec-driven planning store

**Earned:** score 15 — 128 files / 10.5k LOC of Markdown+YAML, own `config.yaml`, 94 requirements, reference hub of the opsx workflow. Distinct domain: planning artifacts and delivery contracts; no compiled code lives here.

## OVERVIEW
Review-gated spec-driven development store: current capability truth (`specs/`), in-flight change deltas (`changes/`), and the delivery workflow contract (`schemas/`), driven by the `openspec` CLI and the `/opsx-*` slash commands in `.opencode/commands/`.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| What the system does today | `specs/<capability>/spec.md` | 11 capabilities, flat kebab-case; format rules in `specs/AGENTS.md` |
| In-flight work | `changes/<name>/` | 7 active; delta and lifecycle rules in `changes/AGENTS.md` |
| Merged history | `changes/archive/` | Read-only past; never earns its own file |
| Workflow and artifact rules | `schemas/review-gated-delivery/` | Contract details in `schemas/AGENTS.md` |
| Agent constraint channel | `config.yaml` (`context:`) | Graphify-first exploration; never copied into artifacts |
| CLI surface | `openspec list/status/instructions/validate` | JSON modes throughout; `list --specs` for the capability inventory |

## CONVENTIONS
- No compiled source here; every file is spec, delta, schema, or config Markdown/YAML.
- The `openspec` CLI is required by every opsx command and skill but is NOT on PATH in this environment.
- Lifecycle: `/opsx-propose` (plan only, then stop) -> separate user request -> `/opsx-apply` -> `/opsx-sync` -> `/opsx-archive`; explore never implements.
- Every active change dir was scaffolded by `openspec new change` and declares `schema: review-gated-delivery` in `.openspec.yaml`.
- Capabilities: kebab-case, named for durable behavior, flat under `specs/` — do not add a domain level.
- Paths resolve from `openspec status --json` (`planningHome.root`, `changeRoot`, `artifactPaths`), never hardcoded repo-relative paths.
- `--store "<id>"` is sticky: once selected it applies to the rest of the workflow's CLI calls.
- Prose default is Spanish (10 of 11 spec Purposes); `interface-design-system` is the English exception.

## ANTI-PATTERNS
- NEVER run `openspec init` or hand-create a change directory — `openspec new change` only (a missing `.openspec.yaml` breaks every opsx command).
- NEVER copy `context`, `rules`, or `operationGuidance` into artifacts, specs, code, or summaries.
- NEVER implement code from propose/explore modes or edit `config.yaml`, schemas, or templates there.
- Zero-delta changes must set `skip_specs: true` in `.openspec.yaml`.
- `chat-turn-lifecycle` and `configuration-registry` are referenced by active changes but absent from `specs/` — they exist only as deltas until their change is synced.
