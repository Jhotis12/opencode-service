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

### Requirement: Explicit orchestrator model resolution
The system SHALL resolve an explicit model for every global orchestrator session: `ORCHESTRATOR_MODEL` when configured, otherwise the platform default model. It SHALL fail with an actionable configuration error when neither is available and SHALL NOT use an implicit OpenCode default.

#### Scenario: Explicit override is used
- **WHEN** `ORCHESTRATOR_MODEL` is set
- **THEN** the orchestrator session is created with that model and the platform default is not used

#### Scenario: Platform default is used
- **WHEN** `ORCHESTRATOR_MODEL` is absent and a platform default model is configured
- **THEN** the orchestrator session is created with the platform default model

#### Scenario: Missing model is rejected
- **WHEN** neither `ORCHESTRATOR_MODEL` nor a platform default model is configured
- **THEN** the turn fails before prompting with an error that names the missing configuration setting

### Requirement: Empty orchestrator reply is a failed turn
When the final assistant message of an orchestrator turn has no non-whitespace text, the system SHALL treat the turn as failed, SHALL NOT persist an empty agent message, SHALL persist a system error, and SHALL return an SSE `error` event or HTTP `502`.

#### Scenario: Empty reply is not successful
- **WHEN** the assistant returns an empty final reply
- **THEN** the request completes with an error and the chat stores a system message instead of an agent message

#### Scenario: Whitespace-only reply is empty
- **WHEN** the assistant returns only spaces, tabs, or newlines
- **THEN** the turn is treated as empty and fails

#### Scenario: Failure remains visible after reload
- **WHEN** the control chat history is loaded after an empty reply
- **THEN** the system error is present and no blank agent bubble is rendered

### Requirement: Blank orchestrator history is omitted
The control chat SHALL omit agent messages with empty or whitespace-only content from history responses and rendered conversations, including messages persisted before this change.

#### Scenario: Existing empty agent rows are hidden
- **WHEN** a global thread contains empty agent messages from earlier failed turns
- **THEN** the history response and the chat surface contain only non-empty messages

#### Scenario: New empty messages are never appended
- **WHEN** a turn fails with an empty reply
- **THEN** no agent message is appended to the thread

### Requirement: Stuck orchestrator session recovery
When an orchestrator turn produces an empty reply or the stored session cannot produce a new assistant response, the system SHALL replace the OpenCode session on the same global thread and retry the prompt once. It SHALL preserve exactly one user message and persist the replacement session identifier.

#### Scenario: Empty reply triggers replacement
- **WHEN** the first attempt returns an empty reply
- **THEN** the system creates a new session on the same thread and retries the prompt once

#### Scenario: Retry succeeds with one answer
- **WHEN** the replacement session returns non-empty text
- **THEN** the thread contains one user message and one agent response, and the replacement session id is persisted

#### Scenario: Retry failure is reported
- **WHEN** the replacement attempt also returns an empty reply or fails
- **THEN** the turn ends with a system error and no empty agent message, and recovery stops after one retry

#### Scenario: Recovery does not duplicate the user message
- **WHEN** a stuck-session recovery occurs
- **THEN** the platform history contains one user message for the turn, not a duplicate

#### Scenario: Next turn uses the replacement session
- **WHEN** the user sends another message after a successful recovery
- **THEN** the thread uses the replacement session rather than the session that returned empty

### Requirement: Read-only orchestrator tool inventory
The global orchestrator SHALL be offered only read-only platform tools for projects, workflows, runs, errors, health, and knowledge. Mutation or side-effect tools SHALL NOT be part of the global tool inventory.

#### Scenario: Global tool inventory is read-only
- **WHEN** the platform registers tools for the global scope
- **THEN** the inventory includes the read-only inspection tools and excludes `workflow_upsert`, `workflow_trigger`, `subagent_upsert`, `db_query`, and `notify`

#### Scenario: Mutation remains unavailable
- **WHEN** a global scoped caller attempts a mutating project operation
- **THEN** the operation is unavailable in the tool inventory and the server still rejects it with HTTP `403` and records the rejection

#### Scenario: Project scope keeps its existing tools
- **WHEN** the platform registers tools for a project scope
- **THEN** its existing read and mutation tools remain available subject to the agent's permissions

### Requirement: Control chat progress
The control chat SHALL stream progress while an orchestrator turn is running, including text deltas, activity that identifies the operation, and elapsed time. A failed or empty turn SHALL be shown as an error rather than a blank response.

#### Scenario: Tool activity is visible
- **WHEN** the orchestrator calls a platform tool
- **THEN** the control chat receives an activity event identifying the operation, including namespaced `platform_*` tools

#### Scenario: Long turn stays observable
- **WHEN** an orchestrator turn runs for several seconds
- **THEN** the chat shows elapsed time and keeps the SSE connection alive with heartbeats

#### Scenario: Failure is visible
- **WHEN** an orchestrator turn fails or returns an empty reply
- **THEN** the control chat shows the error and does not append an empty agent bubble
