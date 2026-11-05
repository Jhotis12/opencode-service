# Spec Delta

## MODIFIED Requirements

### Requirement: Error tracking integration with external login dashboard (Sentry / GlitchTip)
The system SHALL capture unhandled exceptions, failed workflow steps, integration failures, and frontend React render errors via `@sentry/bun` and `@sentry/react` whenever a DSN is configured through the environment or the encrypted Settings UI, apply the persisted DSN at startup, and attach correlation tags.

#### Scenario: Capturing a backend or workflow error in Sentry
- **WHEN** a workflow step or API route throws an unhandled error and a DSN is active
- **THEN** the system reports the scrubbed exception with stack trace and correlation tags to Sentry/GlitchTip so the administrator can log into their Sentry dashboard and inspect the incident

#### Scenario: Integration failure is captured
- **WHEN** a project integration fails to connect, disconnects unexpectedly, or cannot send a message
- **THEN** the error is reported with its project, integration kind, and sanitized error category without credentials

#### Scenario: Orchestrator failure is captured
- **WHEN** the global orchestrator or its alert delivery fails
- **THEN** the error is reported with the global entry point and affected projects without exposing project secrets

#### Scenario: DSN saved in Settings is applied after restart
- **WHEN** an administrator saves a Sentry DSN from the Settings UI and restarts the platform without setting `SENTRY_DSN` in the environment
- **THEN** the system reads the encrypted persisted DSN and reports errors to that destination

#### Scenario: Invalid DSN is rejected before it is saved
- **WHEN** an administrator enters a malformed Sentry DSN
- **THEN** the system rejects it with a validation error and does not replace the previously working DSN

#### Scenario: Effective DSN source is visible
- **WHEN** an administrator opens the telemetry settings
- **THEN** the UI shows whether the active DSN comes from the environment, the encrypted platform settings, or is unset, without revealing the full DSN
