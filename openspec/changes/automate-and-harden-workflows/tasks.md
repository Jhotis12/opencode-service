# Tasks

## 1. Shared Contracts & Persistence for Workflow Snapshots

- [x] 1.1 Extend `packages/shared/src/workflow.ts`, `packages/shared/src/agents.ts`, and `packages/shared/src/api.ts` with `WorkflowVersionSchema`, `secretAlias` on `TriggerConfigSchema`, `outputSchema` on `agent` node config, project `template` option (`"blank" | "triaje-operativo"`), and tool permission context types; verify `bun run --cwd packages/shared test` and `bun run --cwd packages/shared typecheck` pass.
- [x] 1.2 Add `workflow_versions` table and `version_id` column on `workflow_runs` in `apps/server/src/infrastructure/out/persistence/{schema,migrate,sqlite-store}.ts` and `apps/server/src/application/ports/store.ts`; verify persistence unit tests in `apps/server/test/persistence.test.ts` pass for creating, listing, and resolving workflow version snapshots.

## 2. Workflow Graph Snapshots, Version History, Rollback & Startup Run Recovery

- [x] 2.1 Update `SaveWorkflowUseCase` (`apps/server/src/application/use-cases/projects.ts`) and `ExecuteWorkflowRunUseCase` (`apps/server/src/application/use-cases/execute-workflow.ts`) to capture immutable snapshots (`workflow.json` + `nodes/*.ts` code bundle), bind runs to `versionId`, execute `replay()` and `resumeWithApproval()` from the stored snapshot, and recover interrupted `running` runs on startup from their last succeeded checkpoint; verify with tests in `apps/server/test/execute-workflow.test.ts`.
- [x] 2.2 Expose `GET /api/projects/:slug/workflow/versions` and `POST /api/projects/:slug/workflow/versions/:version/rollback` in `apps/server/src/app.ts` and verify snapshot listing and rollback behavior in `apps/server/test/app.http.test.ts`.

## 3. Structured Agent Node Output (`outputSchema`)

- [x] 3.1 Implement structured JSON prompt instructions, Markdown fence stripping, schema validation (`validateInputPayload`), and single-turn auto-repair retry for `agent` nodes with `config.outputSchema` in `apps/server/src/application/use-cases/execute-workflow.ts` (and support deterministic structured responses in `fake-runtime.ts`); verify valid JSON pass-through, 1-retry repair success, and schema failure halting in `apps/server/test/execute-workflow.test.ts`.

## 4. Cron (`schedule`) & Webhook Triggers

- [x] 4.1 Implement the 5-field cron evaluator (`apps/server/src/domain/workflow/cron.ts`), enable `schedule` and `webhook` validation in `apps/server/src/domain/workflow/graph.ts`, add `WorkflowScheduler` for periodic cron execution with per-minute idempotency keys, and expose `POST /api/v1/webhooks/:projectSlug/:nodeId` with secret/HMAC verification in `apps/server/src/app.ts`; verify with unit and HTTP tests in `apps/server/test/workflow-domain.test.ts` and `apps/server/test/app.http.test.ts`.

## 5. Agent Tool Permissions Enforcement (`platform_*`)

- [x] 5.1 Enforce per-agent `permissions` rules (`allow`/`deny`) and execution context (`chat`, `workflow`, `external_channel`) in `packages/opencode-plugin/src/tools.ts` and `apps/server/src/app.ts` so workflow steps and untrusted external channels cannot call `workflow_upsert` or `subagent_upsert` by default and respect `deny` rules on `db_query`, `notify`, and `workflow_trigger`; verify in `packages/opencode-plugin/test/tools.test.ts` and `apps/server/test/app.http.test.ts`.

## 6. Reference Vertical Project Template (`triaje-operativo`) & Web UI Modals

- [x] 6.1 Add the `triaje-operativo` vertical project template to `SafeFsWorkspaceAdapter` (`apps/server/src/infrastructure/out/workspace-fs/safe-workspace.ts`) and `CreateProjectUseCase`, scaffolding the 6-node triage workflow, `nodes/resumen-accion.ts`, and `.opencode/agents/operaciones/clasificador.md`; verify in `apps/server/test/workspace.test.ts`.
- [x] 6.2 Update `apps/web/src/components/{NodeInspector,NodeInspectorModal,ProjectTopBar}.tsx` and `apps/web/src/pages/{ProjectsPage,ProjectPage}.tsx` to enable `schedule`/`webhook` trigger configuration, `agent` node `outputSchema` editing, agent tool permission controls, version history/rollback modal, and template selection on project creation; verify component tests in `apps/web/test/` pass.

## 7. End-to-End Verification, Documentation & GitHub Actions CI

- [x] 7.1 Add `.github/workflows/ci.yml` to run `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e` on pull requests and pushes to `main`, update `README.md` with documentation for cron/webhook triggers, snapshots/rollback, structured agent outputs, tool permissions, and the vertical template, and extend `e2e/` Playwright tests; verify `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e` all pass locally.

## Workflow follow-up

- Create `change/automate-and-harden-workflows` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan automate-and-harden-workflows`.
- Create one atomic commit per numbered group: `<type>(automate-and-harden-workflows): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge.
- Wait for human review and merge; archive only after the PR is merged.
