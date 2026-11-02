# Spec Delta

## Purpose

Define al proyecto como dueño y límite de sus integraciones, secretos, conexiones, canales y ajustes, de modo que cada caso de uso se configure y opere de forma autocontenida sin depender de recursos globales.

## ADDED Requirements

### Requirement: Project-owned integrations
The system SHALL assign every integration a stable identifier, a scope (`project` or `global`), an owning project when scoped to a project, a kind, capabilities, non-secret configuration, secret references, and a lifecycle status.

#### Scenario: Creating an integration inside a project
- **WHEN** a user creates a Telegram integration from project `ventas`
- **THEN** the integration is listed and usable only inside `ventas` and carries a stable identifier that does not change if its display name or slug changes

#### Scenario: Sibling project cannot use the integration
- **WHEN** project `soporte` attempts to read, test, or reference an integration owned by `ventas`
- **THEN** the system rejects the operation with HTTP `403` and records the rejected access

#### Scenario: Global integration is separate from project integrations
- **WHEN** an administrator creates a global integration for the orchestrator
- **THEN** it appears only in the global control settings and is never listed as a project resource

### Requirement: Typed integration kinds and capabilities
The system SHALL validate each integration's configuration according to its kind and SHALL expose the capabilities that kind supports, so channels, databases, and future integrations share one contract without a new storage model per kind.

#### Scenario: Invalid kind-specific configuration is rejected
- **WHEN** a user submits a Telegram integration without a bot token reference or a database integration with an unsupported driver
- **THEN** the system rejects the request with HTTP `422` and identifies the invalid field before persisting anything

#### Scenario: Capabilities drive available actions
- **WHEN** an integration exposes only outbound-message capability
- **THEN** the UI and API do not offer inbound triggers or connection actions that require inbound capability

#### Scenario: New integration kind reuses the contract
- **WHEN** an email integration kind is introduced with `send_email` and `read_email` capabilities
- **THEN** it is stored, listed, validated, and referenced through the same integration contract without creating a parallel resource model

### Requirement: Project channel routing modes
The system SHALL let a project channel declare a routing mode of `agent`, `workflow`, or `hybrid`, with an administrator allowlist and an explicit public-access policy, and SHALL route each incoming message deterministically to the owning project.

#### Scenario: Direct conversation with the project agent
- **WHEN** an allowed sender messages a channel whose mode is `agent`
- **THEN** the message starts or continues a conversation with that project's primary agent and never with the global orchestrator

#### Scenario: Workflow-triggered channel
- **WHEN** an allowed or public sender messages a channel whose mode is `workflow`
- **THEN** the system executes the matching trigger of that project's workflow and records the integration as the run origin

#### Scenario: Hybrid channel separates admins from public senders
- **WHEN** a channel uses `hybrid` mode and an allowlisted administrator messages it
- **THEN** the administrator reaches the project agent while a non-allowlisted sender can only reach the configured public workflow trigger

#### Scenario: Duplicate trigger binding is rejected
- **WHEN** two trigger nodes in the same project declare the same integration and event
- **THEN** saving the workflow fails with HTTP `422` before the ambiguity can reach runtime

### Requirement: Stable resource references and validation
Workflow nodes SHALL reference integrations, agents, and notebooks by stable identifiers, and the system SHALL validate that each referenced resource exists and belongs to the same project when a workflow is saved and before a run starts.

#### Scenario: Stale integration reference is rejected on save
- **WHEN** a user saves a workflow whose trigger references an integration that was deleted
- **THEN** the system rejects the save with HTTP `422` and names the missing resource

#### Scenario: Cross-project resource reference is rejected
- **WHEN** a workflow in project A references an integration, agent, or notebook owned by project B
- **THEN** the system rejects the save or run with HTTP `403` or `422` and does not execute any step

#### Scenario: Run fails before the first step when a resource is unavailable
- **WHEN** a workflow is launched with a referenced integration that is disconnected or no longer exists
- **THEN** the run fails with a clear user-facing message before executing the trigger or any downstream node

### Requirement: Project-scoped secret resolution
The system SHALL store integration credentials in the encrypted vault with project scope and SHALL expose only secret aliases and masked metadata to the UI, workflow files, logs, and LLM context.

#### Scenario: Saving an integration credential
- **WHEN** a user saves a bot token for a project integration
- **THEN** the API returns only the alias, kind, and masked metadata, never the plaintext value

#### Scenario: Resolving a secret during execution
- **WHEN** a project node or integration adapter needs a credential
- **THEN** the runtime resolves the project-scoped alias in memory and never injects the raw secret into the workflow, worker payload, or model prompt

#### Scenario: Cross-project alias is denied
- **WHEN** project A attempts to resolve a secret alias that belongs to project B
- **THEN** the system rejects the resolution and logs the attempted alias and project without logging the secret value

### Requirement: Integration lifecycle and health
The system SHALL expose connect, disconnect, test, status, and where applicable QR-code actions for each project integration, and SHALL isolate a failing integration so it does not degrade other projects.

#### Scenario: Telegram integration needs configuration
- **WHEN** a Telegram integration is started without a valid token reference
- **THEN** its status becomes `needs_config` and the project UI explains the missing credential

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
The system SHALL expose all configuration needed by a project in that project's own settings, including its primary agent, default model, integrations, notebooks, MCP servers, and secrets, and SHALL show a readiness state for missing required resources.

#### Scenario: New project readiness checklist
- **WHEN** a user opens a newly created project
- **THEN** the project shows the required configuration steps and marks which ones are complete, such as primary agent, at least one trigger, and any integration required by the trigger

#### Scenario: Missing channel is visible before execution
- **WHEN** a workflow requires a project channel that has not been configured
- **THEN** the project settings show the missing resource and the run action explains what must be configured instead of failing mid-flow

#### Scenario: Project settings are scoped
- **WHEN** a user changes the project's default model, primary agent, or integrations
- **THEN** only that project's configuration changes and sibling projects remain unchanged

### Requirement: Project creation and destructive deletion
The system SHALL create projects with a name, a stable slug, and an optional description, and SHALL allow an authenticated administrator to delete a project only after explicit confirmation; deletion SHALL remove the project's workspace and all project-owned data.

#### Scenario: Guided project creation
- **WHEN** an administrator creates a project with a name, an automatically derived slug, and a description
- **THEN** the system creates the workspace, initial workflow, primary agent scaffold, knowledge directory, and project record with that description

#### Scenario: Delete requires typed confirmation
- **WHEN** an administrator requests deletion of a project
- **THEN** the system requires the administrator to type the exact project slug before executing the destructive action

#### Scenario: Deletion cascades owned data
- **WHEN** a project deletion is confirmed
- **THEN** the system stops its integrations and removes its workspace, workflow, nodes, agents, notebooks, sources, chunks, chat threads, messages, runs, approvals, secrets, and project record

#### Scenario: Project service token cannot delete a project
- **WHEN** a project-scoped service token requests project deletion
- **THEN** the system rejects the request with HTTP `403`

### Requirement: Guided project integration configuration
The system SHALL let a user configure common channel integrations from structured fields for routing mode, administrator allowlist, public access, and credentials, while keeping advanced JSON configuration optional.

#### Scenario: Configure a Telegram channel without raw JSON
- **WHEN** a user creates a Telegram integration with a name, slug, routing mode, allowlist, public flag, and bot token
- **THEN** the system stores the routing and encrypted token without requiring the user to write JSON

#### Scenario: Configure WhatsApp mode
- **WHEN** a user selects WhatsApp with QR or Cloud API mode
- **THEN** the form requests only the credentials required by that mode and the integration status reflects the connection state

#### Scenario: External chat key is shown once
- **WHEN** a user creates an external-chat integration
- **THEN** the system shows the generated integration ID and one-time API key with the endpoint path

#### Scenario: Advanced configuration remains available
- **WHEN** a user needs an additional integration-specific field
- **THEN** the system provides an optional advanced JSON section without hiding or duplicating the guided fields
