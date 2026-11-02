# observability-and-testing-harness Specification

## Purpose

Establece la infraestructura de pruebas automatizadas bajo TDD (unitarias, integración, contratos y E2E), la observabilidad estructurada con IDs de correlación y métricas RED/USE, la captura de errores en Sentry (nube o autoalojado donde el usuario inicia sesión para auditar fallos) y el panel interno de salud de la aplicación.

## Requirements

### Requirement: Structured JSON logging with correlation ID and entry-point attribution
The system SHALL emit structured JSON logs for every request, workflow run, integration event, and orchestrator action containing `requestId`, `runId` when applicable, `projectSlug` when applicable, `integrationId` when applicable, and `entryPoint`, redacting secrets, tokens, passwords, message bodies, and personal data.

#### Scenario: Workflow triggered by scheduler vs manual replay
- **WHEN** a workflow is started by a cron schedule or by a manual replay endpoint
- **THEN** every log line and child worker log carries both the `requestId`/`runId` and the originating `entryPoint` without leaking secret vault values

#### Scenario: Integration event carries its scope
- **WHEN** a Telegram, WhatsApp, email, or external application message starts or continues a workflow
- **THEN** the logs include the owning `projectSlug`, `integrationId`, entry point, and thread identifier without logging the message body

#### Scenario: Global orchestrator action is attributable
- **WHEN** the global orchestrator reads cross-project data or sends an alert
- **THEN** the logs record the global entry point, the projects accessed, the action, and the outcome

#### Scenario: Sensitive values are redacted
- **WHEN** a log event would include a token, password, connection string, secret value, or full personal message
- **THEN** the logger redacts the value before serialization

### Requirement: Error tracking integration with external login dashboard (Sentry / GlitchTip)
The system SHALL capture unhandled exceptions, failed workflow steps, integration failures, and frontend React render errors via `@sentry/bun` and `@sentry/react` whenever a `SENTRY_DSN` is configured via environment or the Settings UI, attaching `requestId`, `projectSlug`, `workflowId`, `integrationId`, and `entryPoint` tags.

#### Scenario: Capturing a backend or workflow error in Sentry
- **WHEN** a workflow step or API route throws an unhandled error and `SENTRY_DSN` is active
- **THEN** the system reports the scrubbed exception with stack trace and correlation tags to Sentry/GlitchTip so the administrator can log into their Sentry dashboard and inspect the incident

#### Scenario: Integration failure is captured
- **WHEN** a project integration fails to connect, disconnects unexpectedly, or cannot send a message
- **THEN** the error is reported with its project, integration kind, and sanitized error category without credentials

#### Scenario: Orchestrator failure is captured
- **WHEN** the global orchestrator or its alert delivery fails
- **THEN** the error is reported with the global entry point and affected projects without exposing project secrets

### Requirement: Built-in System Health and Error Inspector dashboard
The system SHALL provide an authenticated `/system/health` dashboard in the web UI and `GET /api/system/health` endpoint displaying service status (OpenCode V2 daemon, database, project integrations, worker pool, global orchestrator), RED metrics (Rate, Errors, Duration p50/p95/p99), alert delivery status, and a filterable ledger of recent application and workflow errors.

#### Scenario: Administrator logs in to check if the application has been operating healthy
- **WHEN** an administrator opens the `/system/health` view in the web UI
- **THEN** the system displays real-time health indicators for OpenCode V2, DB, integrations, global orchestrator, 24-hour success/error rates, p95 latencies, and recent error traces with one-click navigation to the failing workflow step

#### Scenario: Integration is down
- **WHEN** a project integration is disconnected or in `needs_config`
- **THEN** the health dashboard shows its project, kind, status, and last error without exposing credentials

#### Scenario: Alert delivery is failing
- **WHEN** the system cannot deliver an alert to a global channel
- **THEN** the health dashboard and logs show the failed delivery and the alert remains available for later inspection

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

### Requirement: Pull request continuous integration pipeline
The repository SHALL define a GitHub Actions workflow under `.github/workflows/ci.yml` that automatically runs `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e` on every pull request and push to the main branch.

#### Scenario: Pull request triggers full verification in GitHub Actions
- **WHEN** a pull request is opened or updated on GitHub
- **THEN** GitHub Actions installs dependencies and Playwright browsers, runs `bun run typecheck`, `bun run test`, `bun run build`, and `bun run test:e2e`, and fails the check if any step exits non-zero

### Requirement: Integration and alert telemetry
The system SHALL emit structured lifecycle events for integration connect, disconnect, test, QR, and failure, and for alert sent, suppressed, and failed, with bounded labels and latency or count metrics that exclude secrets and message content.

#### Scenario: Integration lifecycle event
- **WHEN** a project integration changes status
- **THEN** the system emits an event with project, integration kind, status, and sanitized reason, and updates the health counters

#### Scenario: Alert is sent
- **WHEN** an alert is delivered to a global channel
- **THEN** the system records the event type, project or projects involved, channel scope, latency, and outcome

#### Scenario: Alert is suppressed
- **WHEN** an alert is deduplicated or throttled
- **THEN** the system records the suppressed count and reason without sending a duplicate message

#### Scenario: Telemetry excludes sensitive content
- **WHEN** integration or alert telemetry is emitted
- **THEN** it contains no tokens, credentials, full message bodies, or personal data

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
