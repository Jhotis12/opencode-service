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

## Design guidance

- Before any HTML/CSS/client-side JS UI decision, run `npx modern-web-guidance search "<topic>"` and follow the returned guide; consult the `frontend-design` skill for aesthetic direction. Both skills are pinned in `skills-lock.json`; see `docs/design-standard.md` ("Guia externa") for when to use each and the exact commands.

## Web shell

- `apps/web/src/App.tsx` is the route source of truth. The rail has five global pages (`/projects`, `/runs`, `/orchestrator`, `/settings`, `/system/health`) and each project section is a route under `/projects/:slug/`: `overview`, `flow`, `runs`, `agents`, `knowledge`, `integrations`, `settings`. `/projects/:slug` redirects to `overview`. Keep the README route table 1:1 with this file.
- The project shell lives in `pages/ProjectLayout.tsx` with shared state in `pages/project-workspace.tsx`; `components/ProjectTopBar.tsx` renders the section tabs and the overflow menu (Versiones del flujo, Biblioteca del flujo, Ajustes del flujo).
- Workflow import/export uses `WorkflowDefinitionSchema` in `apps/web/src/workflow-transfer.ts`: `{ version: 1, exportedAt, graph }`, where `graph` is `WorkflowGraphSchema`. The plan calls this envelope `WorkflowExportEnvelopeSchema`; it's the same contract under the real symbol.
- Visual rules: `docs/design-standard.md`. Motion: `docs/ui-motion.md`. Both are binding for new UI work.

## Default model

- The platform and the global orchestrator default to DeepSeek V4.1 Flash (`opencode/deepseek-v4.1-flash-free`, `PLATFORM_DEFAULT_MODEL` in `packages/shared`).
- `BootstrapSystemUseCase` seeds `default_model` from `options.defaultModel ?? PLATFORM_DEFAULT_MODEL` (`apps/server/src/index.ts` folds `DEFAULT_MODEL` into `options.defaultModel`) only when the key is unset. It seeds `orchestrator_model` only when the key is unset and no explicit `orchestratorModel` (`ORCHESTRATOR_MODEL`) is supplied, which preserves env precedence. Startup never overwrites a saved setting, and a project, flow or node can override the platform value.
- `.env.example` and `docker-compose.yml` ship `DEFAULT_MODEL` so fresh installs land on DeepSeek; see the README variables table for precedence.

## Installed skills

Vendored under `.agents/skills/` and pinned by commit in `skills-lock.json`:

- `modern-web-guidance` (`GoogleChrome/modern-web-guidance`): platform patterns, accessibility and performance for HTML/CSS/client JS.
- `frontend-design` (`anthropics/skills`): aesthetic direction, palette, typography and layout.
- `emil-design-eng`, `animate`, `animation-performance`, `review-animations` (`emilkowalski/skills`): UI polish, motion design and motion review.
- `find-skills` (`vercel-labs/skills`): discovery for adding more skills.

Project skills live in `.opencode/skills/`: `graphify` plus the `openspec-*` workflow. Add skills with the vercel-labs CLI and keep `skills-lock.json` updated; see `docs/design-standard.md` for the design commands.

## Docs map

- `README.md`: product behavior, routes, environment variables, APIs and development commands.
- `docs/design-standard.md`: identity, tokens, typography, components, accessibility and copy.
- `docs/ui-motion.md`: timing, easing, rail, modal and status motion.
- `docs/graphify.md`, `docs/performance.md`, `docs/security-checklist.md`: graph usage, performance budget and security review.
