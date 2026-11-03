# Spec Delta

## ADDED Requirements

### Requirement: Durable orchestrator turns

Every global orchestrator message from the web control page or a global channel SHALL create a durable turn in the global control scope, with its own thread, session, status, history, and attachable SSE view. Long orchestrator turns SHALL survive client disconnects and platform restarts without losing the final answer.

#### Scenario: Long cross-project report
- **WHEN** an administrator asks for a report that takes longer than the transport idle timeout
- **THEN** the orchestrator turn remains running, the UI can reattach, and the final report is persisted without a transport error

#### Scenario: Orchestrator turn survives reload
- **WHEN** the administrator reloads the control page while a turn is running
- **THEN** the page restores the active turn and attaches to its events or completed answer

#### Scenario: Global channel turn
- **WHEN** a global channel message starts an orchestrator turn
- **THEN** the turn is scoped to the global control plane, delivered through the same global integration, and never appears in project chat history

#### Scenario: Orchestrator timeout or cancel
- **WHEN** a global turn exceeds its configured maximum or the administrator cancels it
- **THEN** the system interrupts the session, persists the outcome, and does not leave the orchestrator working invisibly

### Requirement: Read-only empty-reply policy for orchestrator turns

The orchestrator SHALL treat a completed turn with no assistant text as a failed empty reply and MAY retry it once on a new session because its tools are read-only. The retry SHALL preserve one user message and SHALL NOT create an empty agent message.

#### Scenario: Empty first reply is retried
- **WHEN** the orchestrator returns no assistant text on its first attempt
- **THEN** the system creates a replacement session, retries the prompt once, and persists the successful answer

#### Scenario: Empty retry also fails
- **WHEN** the retry also returns no assistant text
- **THEN** the turn fails with an empty-reply status, one user message remains, and no empty agent message is stored

#### Scenario: Project chat does not inherit read-only retry
- **WHEN** a project chat turn completes empty after potentially mutating tools
- **THEN** the system does not automatically resend the prompt and instead reports the empty reply to the user
