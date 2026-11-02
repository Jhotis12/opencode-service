# Spec Delta

## ADDED Requirements

### Requirement: Pull request continuous integration pipeline
The repository SHALL define a GitHub Actions workflow under `.github/workflows/ci.yml` that automatically runs `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e` on every pull request and push to the main branch.

#### Scenario: Pull request triggers full verification in GitHub Actions
- **WHEN** a pull request is opened or updated on GitHub
- **THEN** GitHub Actions installs dependencies and Playwright browsers, runs `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e`, and fails the check if any step exits non-zero

## MODIFIED Requirements

### Requirement: Automated TDD testing pyramid (Unit, Integration, Contract, and E2E)
The system SHALL provide an automated test suite comprising fast domain unit tests, adapter integration tests against an isolated SQLite database, API/Plugin schema contract tests, and Playwright E2E browser tests covering project resource isolation, deterministic routing, input validation, chat rendering, orchestrator tools, alerts, migration, triggers, version snapshots, structured agent outputs, and tool permissions.

#### Scenario: Running the full verification suite
- **WHEN** a developer or CI pipeline executes the repository test commands
- **THEN** the test runners execute all domain unit, adapter/contract integration, and web component tests, and Playwright verifies first-boot login, password rotation, project creation (including the vertical template), project resource configuration, manual run validation, workflow version rollback, chat rendering, node drag, run detail, orchestrator chat, and canvas rendering with zero console errors

#### Scenario: Isolation regression is caught
- **WHEN** a change allows a project to read a sibling integration, secret, notebook, chat thread, or run, or allows a disallowed agent tool call
- **THEN** the isolation and permission test suite fails before release

#### Scenario: Migration is verified
- **WHEN** the migration runs against a database containing the previous model
- **THEN** the migration test verifies resource ownership, chat threads, run provenance, and that no old global resource remains accessible

### Requirement: Resilience regression coverage
The automated suite SHALL cover recovery from stale OpenCode sessions, restoration of provider credentials at startup, recovery of interrupted `running` workflow runs at startup, immutable snapshot replay, cascading project deletion, and workflow trigger validation rules.

#### Scenario: Session recovery is covered
- **WHEN** the test suite runs
- **THEN** it verifies project, global, channel, and external-chat threads recover from `Session not found` without losing history

#### Scenario: Provider restoration is covered
- **WHEN** the test suite starts the application with a saved provider key
- **THEN** it verifies the key is registered with the OpenCode runtime

#### Scenario: Interrupted run recovery and snapshot replay are covered
- **WHEN** the test suite starts the application with an in-flight `running` run or replays a run after its disk workflow changed
- **THEN** it verifies the run resumes from its last succeeded checkpoint using the original workflow snapshot

#### Scenario: Project deletion is covered
- **WHEN** the test suite deletes a project
- **THEN** it verifies the workspace and owned database rows are gone and that project-scoped callers cannot delete projects

#### Scenario: Trigger validation is covered
- **WHEN** the test suite validates workflows with duplicate triggers or invalid schedule/webhook/integration trigger configurations
- **THEN** validation fails with an actionable message
