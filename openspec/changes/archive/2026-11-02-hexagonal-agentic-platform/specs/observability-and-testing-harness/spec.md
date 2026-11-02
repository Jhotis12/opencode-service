# Spec Delta

## Purpose

Establece la infraestructura de pruebas automatizadas bajo TDD (unitarias, integración, contratos y E2E), la observabilidad estructurada con IDs de correlación y métricas RED/USE, la captura de errores en Sentry (nube o autoalojado donde el usuario inicia sesión para auditar fallos) y el panel interno de salud de la aplicación.

## ADDED Requirements

### Requirement: Structured JSON logging with correlation ID and entry-point attribution
The system SHALL emit structured JSON logs for every request, workflow run, and channel event containing `requestId`, `runId` (when applicable), and `entryPoint` (`web_ui`, `scheduler`, `webhook`, `telegram`, `whatsapp`, `external_chat`, or `replay`), redacting all secrets, tokens, and passwords.

#### Scenario: Workflow triggered by scheduler vs manual replay
- **WHEN** a workflow is started by a cron schedule or by a manual replay endpoint
- **THEN** every log line and child worker log carries both the `requestId`/`runId` and the originating `entryPoint` without leaking secret vault values

### Requirement: Error tracking integration with external login dashboard (Sentry / GlitchTip)
The system SHALL capture unhandled exceptions, failed workflow steps, and frontend React render errors via `@sentry/bun` and `@sentry/react` whenever a `SENTRY_DSN` is configured via environment or the Settings UI, attaching `requestId`, `projectSlug`, `workflowId`, and `entryPoint` tags.

#### Scenario: Capturing a backend or workflow error in Sentry
- **WHEN** a workflow step or API route throws an unhandled error and `SENTRY_DSN` is active
- **THEN** the system reports the scrubbed exception with stack trace and correlation tags to Sentry/GlitchTip so the administrator can log into their Sentry dashboard and inspect the incident

### Requirement: Built-in System Health and Error Inspector dashboard
The system SHALL provide an authenticated `/system/health` dashboard in the web UI and `GET /api/system/health` endpoint displaying service status (OpenCode V2 daemon, database, active channels, worker pool), RED metrics (Rate, Errors, Duration p50/p95/p99), and a filterable ledger of recent application and workflow errors.

#### Scenario: Administrator logs in to check if the application has been operating healthy
- **WHEN** an administrator opens the `/system/health` view in the web UI
- **THEN** the system displays real-time health indicators for OpenCode V2, DB, WhatsApp/Telegram connections, 24-hour success/error rates, p95 latencies, and recent error traces with one-click navigation to the failing workflow step

### Requirement: Automated TDD testing pyramid (Unit, Integration, Contract, and E2E)
The system SHALL provide an automated test suite comprising fast domain unit tests, adapter integration tests against an isolated SQLite database, API/Plugin schema contract tests, and Playwright E2E browser tests for critical user journeys.

#### Scenario: Running the full verification suite
- **WHEN** a developer or CI pipeline executes the repository test commands
- **THEN** Vitest executes all domain unit and adapter/contract integration tests and Playwright verifies first-boot login, password rotation, project creation, node drag, chat history persistence, run detail, settings channel modal and canvas rendering with zero console errors
