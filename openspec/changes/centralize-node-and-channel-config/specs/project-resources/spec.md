# Spec Delta

## MODIFIED Requirements

### Requirement: Integration lifecycle and health
The system SHALL expose create, edit, connect, disconnect, test, status, last error, and where applicable QR-code actions for each project integration, and SHALL isolate a failing integration so it does not degrade other projects.

#### Scenario: Telegram integration needs configuration
- **WHEN** a Telegram integration is started without a valid token reference
- **THEN** its status becomes `needs_config` and the project UI explains the missing credential

#### Scenario: Telegram connection test returns a real provider result
- **WHEN** a user tests a Telegram integration with a token
- **THEN** the system verifies the bot with the provider and reports success with its bot identity or a sanitized failure, never a false success based only on token presence

#### Scenario: Editing an existing integration preserves references
- **WHEN** a user changes a channel's token, routing mode, allowlist, public flag, or recipients
- **THEN** the integration keeps its identifier and every workflow trigger, notification, and approval reference continues to work without being recreated

#### Scenario: Connection failure is visible
- **WHEN** an integration cannot connect or loses its connection
- **THEN** its status becomes `error` or `needs_config`, its sanitized last error is stored, and the project UI shows the failure and the next action

#### Scenario: WhatsApp QR flow
- **WHEN** a WhatsApp integration using QR authentication is started
- **THEN** the project UI receives the QR event, shows it to the user, and updates the integration status when the session connects

#### Scenario: Database connection test
- **WHEN** a user tests a project database integration
- **THEN** the system performs a bounded health query and returns latency or a sanitized error without exposing credentials

#### Scenario: One failing integration does not stop others
- **WHEN** a project integration fails to start or disconnects
- **THEN** other project integrations and other projects remain operational and the failure is reported in health and logs

### Requirement: Project configuration surface and readiness
The system SHALL expose all configuration needed by a project in one project configuration surface with sections for general settings, connections, channels, destinations, security, and readiness, including effective values and their platform or environment source.

#### Scenario: New project readiness checklist
- **WHEN** a user opens a newly created project
- **THEN** the project shows the required configuration steps and marks which ones are complete, such as primary agent, at least one trigger, and any integration required by the trigger

#### Scenario: Missing channel is visible before execution
- **WHEN** a workflow requires a project channel that has not been configured
- **THEN** the project settings show the missing resource and the run action explains what must be configured instead of failing mid-flow

#### Scenario: Project settings are scoped
- **WHEN** a user changes the project's default model, primary agent, integrations, channels, or destinations
- **THEN** only that project's configuration changes and sibling projects remain unchanged

#### Scenario: Single configuration surface
- **WHEN** a user needs to configure a project's agent, model, channels, destinations, connections, secrets, or approvals
- **THEN** all of them are reachable from one project configuration surface without duplicating the same editor in separate tabs

#### Scenario: Inherited setting shows its source
- **WHEN** a project does not define its own default model or orchestrator model
- **THEN** the project configuration shows the effective inherited value and whether it comes from platform settings, environment, or the system default

### Requirement: Guided project integration configuration
The system SHALL let a user create and edit common channel integrations from structured fields for routing mode, administrator allowlist, public access, credentials, alerts, and recipients, using the same editor for project and global scope, while keeping advanced JSON optional and validated.

#### Scenario: Configure a Telegram channel without raw JSON
- **WHEN** a user creates a Telegram integration with a name, slug, routing mode, allowlist, public flag, and bot token
- **THEN** the system stores the routing and encrypted token without requiring the user to write JSON

#### Scenario: Edit a Telegram channel without recreating it
- **WHEN** a user opens an existing Telegram integration and changes its routing, allowlist, public flag, alerts, or token
- **THEN** the editor saves the changes on the same integration and does not require deleting it or rewiring its triggers

#### Scenario: Configure WhatsApp mode
- **WHEN** a user selects WhatsApp with QR or Cloud API mode
- **THEN** the form requests only the credentials required by that mode and the integration status reflects the connection state

#### Scenario: External chat key is shown once
- **WHEN** a user creates an external-chat integration
- **THEN** the system shows the generated integration ID and one-time API key with the endpoint path

#### Scenario: Advanced configuration remains available
- **WHEN** a user needs an additional integration-specific field
- **THEN** the system provides an optional advanced JSON section that is validated against the same contract and does not duplicate or override the guided fields silently

#### Scenario: Advanced JSON cannot store secrets
- **WHEN** a user includes a token, password, or DSN in the advanced JSON section instead of a declared secret field
- **THEN** the system rejects the configuration and identifies the correct secret field

## ADDED Requirements

### Requirement: Project destination registry
The system SHALL maintain a project-scoped registry of labeled destinations for chat identifiers, email addresses, and webhooks, and SHALL let channel allowlists, alert recipients, approval recipients, and notify nodes reference a destination instead of duplicating raw values.

#### Scenario: Create and reuse a destination
- **WHEN** a user creates a labeled Telegram destination for an administrator chat
- **THEN** the same destination can be selected in a channel allowlist, an alert recipient, an approval recipient, and a notify node without retyping the identifier

#### Scenario: Existing raw values remain valid
- **WHEN** a channel, project setting, or notify node already stores a raw chat identifier or email address
- **THEN** the system keeps accepting it and offers to adopt it as a labeled destination without breaking the existing configuration

#### Scenario: Cross-project destination is rejected
- **WHEN** a project workflow, channel, or setting references a destination owned by another project
- **THEN** the system rejects the reference with HTTP `403` or `422` and does not resolve the value

#### Scenario: Referenced destination cannot be deleted silently
- **WHEN** a user deletes a destination that is referenced by a channel, project setting, or workflow node
- **THEN** the system rejects the deletion or lists the references and requires the user to replace them first
