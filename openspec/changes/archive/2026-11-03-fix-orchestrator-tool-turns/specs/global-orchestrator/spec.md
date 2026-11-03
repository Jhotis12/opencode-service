# Spec Delta

## ADDED Requirements

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
