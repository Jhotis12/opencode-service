# global-orchestrator Specification

## Purpose

Define el plano de control global: un agente separado de los proyectos, con canales propios, consulta transversal de solo lectura y alertas deterministas para reportar fallos, preguntas y estado de la plataforma.

## Requirements

### Requirement: Separate global orchestrator workspace and agent
The system SHALL provision a dedicated control workspace outside project workspaces, with its own agent profile, instructions, session history, and permissions, and SHALL NOT list it as a project.

#### Scenario: Orchestrator is not a project
- **WHEN** a user lists projects
- **THEN** the global orchestrator and its control workspace are absent from the project list

#### Scenario: Orchestrator has independent history
- **WHEN** an administrator chats with the global orchestrator from the web and then from a global channel
- **THEN** each conversation retains its own thread history and does not mix with any project chat

#### Scenario: Orchestrator cannot edit project files by default
- **WHEN** the global orchestrator attempts to edit, delete, or write files inside a project workspace
- **THEN** its permissions deny the operation and the attempt is audited

### Requirement: Global channels configured in platform settings
The system SHALL allow administrators to create, test, connect, disconnect, and remove global integrations for the orchestrator, with scope `global`, independent from project channels.

#### Scenario: Configuring a Telegram channel for the orchestrator
- **WHEN** an administrator creates a Telegram integration in the global channel settings
- **THEN** the integration is available only to the orchestrator, and project channel lists do not show it

#### Scenario: Testing a global channel
- **WHEN** an administrator sends a test message from the global channel settings
- **THEN** the message is delivered through the selected global integration and the result is reported in the UI

#### Scenario: Global channel access control
- **WHEN** a sender not present in the global channel allowlist messages the orchestrator
- **THEN** the system drops or rejects the message according to the configured policy and records the decision

### Requirement: Cross-project read-only tools
The system SHALL provide the global orchestrator with authenticated tools to list and inspect projects, workflows, runs, errors, health, and knowledge across projects without exposing project secrets or requiring direct filesystem access.

#### Scenario: Asking for a cross-project failure report
- **WHEN** an administrator asks the orchestrator which projects failed in the last 24 hours
- **THEN** the orchestrator queries runs and errors, groups them by project, and returns project, workflow, node, run identifier, and error summary

#### Scenario: Asking about a specific project
- **WHEN** an administrator asks about the status of project `ventas`
- **THEN** the orchestrator returns that project's workflow summary, recent runs, integration status, and knowledge source count without returning secret values

#### Scenario: Cross-project knowledge search
- **WHEN** the orchestrator searches knowledge with no project filter
- **THEN** results include the owning project and source citations, and the search remains read-only

#### Scenario: Project agent cannot use global tools
- **WHEN** a project-scoped agent attempts a global tool call or an unscoped cross-project request
- **THEN** the system rejects it with HTTP `403` and records the scope violation

### Requirement: Deterministic failure and health alerts
The system SHALL send configurable alerts to subscribed global channels when a workflow run fails, an integration goes down, or system health degrades, using deterministic templates that do not depend on an LLM.

#### Scenario: Failed run produces an alert
- **WHEN** a project workflow run reaches `failed` or `timed_out`
- **THEN** the system sends an alert containing project, workflow, node, run identifier, timestamp, and a safe error summary to every global channel subscribed to run failures

#### Scenario: Alert deduplication and throttling
- **WHEN** the same run failure is observed more than once or a project produces repeated identical failures within the throttle window
- **THEN** the system sends at most one alert for that run or window and records the suppressed count

#### Scenario: Alert content excludes secrets and PII
- **WHEN** an alert is generated from an error that contains credentials, tokens, message bodies, or personal data
- **THEN** the alert contains only redacted metadata and a safe error category

#### Scenario: No alert channel configured
- **WHEN** a failure occurs and no global channel subscribes to that event
- **THEN** the failure remains visible in health, logs, and the orchestrator dashboard without failing the workflow

### Requirement: On-demand global questions and reports
The system SHALL let an administrator ask the global orchestrator questions through the web control page or a global channel and receive an answer grounded in platform data, with project and run references where applicable.

#### Scenario: Asking what failed today
- **WHEN** an administrator asks "¿qué falló hoy?" from a global channel
- **THEN** the orchestrator queries the relevant runs and errors and replies with a concise report that cites project and run identifiers

#### Scenario: Asking for a specific run detail
- **WHEN** an administrator references a run identifier
- **THEN** the orchestrator returns the run status, failing node, error summary, and timing without exposing secrets

#### Scenario: Orchestrator lacks evidence
- **WHEN** the requested data is not available or the tool call fails
- **THEN** the orchestrator states what it could not verify and does not invent a result

### Requirement: Separation of authority between project and control planes
The system SHALL use distinct authorization scopes for project agents and the global orchestrator, so a project cannot escalate to global access and the orchestrator cannot silently mutate a project.

#### Scenario: Project scope cannot be omitted to gain global access
- **WHEN** a request originates from a project location without a valid project scope or with an invalid global credential
- **THEN** the system rejects it instead of treating it as an unscoped global request

#### Scenario: Orchestrator mutation requires explicit confirmation
- **WHEN** the orchestrator is asked to trigger a run, change a channel, or perform any mutating action
- **THEN** the action is either unavailable in the current scope or requires an explicit administrator confirmation and is audited

#### Scenario: Global audit trail
- **WHEN** the orchestrator reads cross-project data or sends an alert
- **THEN** the system records the entry point, project or projects accessed, action, and outcome without recording secrets or full message bodies
