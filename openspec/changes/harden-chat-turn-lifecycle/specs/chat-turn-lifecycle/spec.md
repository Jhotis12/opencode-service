# Spec Delta

## Purpose

Define el ciclo de vida durable de un turno de chat: propiedad, estados, idempotencia, detección de fin, recuperación, timeout, cancelación y reconexión de la vista, para que el trabajo del agente sobreviva a cortes de transporte, recargas y reinicios sin perder la respuesta ni duplicar efectos.

## ADDED Requirements

### Requirement: Durable turn ownership

Every chat message SHALL create a durable turn with an identifier, thread, project or control scope, OpenCode session, status, timestamps, and linked user, agent, and system messages. The HTTP request and its SSE connection SHALL be views of the turn, not its owner; disconnecting either SHALL NOT cancel the turn.

#### Scenario: Client disconnects during a turn
- **WHEN** the browser closes, reloads, or loses the SSE connection while a turn is running
- **THEN** the turn continues, its status remains queryable, and the final answer is persisted when the agent completes

#### Scenario: Platform restarts during a turn
- **WHEN** the platform starts with a turn recorded as queued or running
- **THEN** startup recovery reconciles the turn with the OpenCode session and either persists the completed answer or marks the turn as unknown or interrupted with an actionable message

#### Scenario: Messages are linked exactly once
- **WHEN** a turn completes successfully
- **THEN** the thread contains exactly one user message and one agent message for that turn, with no empty agent bubble and no duplicated user message

#### Scenario: Active turn appears in history
- **WHEN** the user reopens a chat that has an active turn
- **THEN** the history includes the turn status and start time so the UI can show it as in progress and reattach

### Requirement: Authoritative completion and final answer recovery

The system SHALL determine turn completion from durable OpenCode session events and session state, using a persisted event cursor and status polling as a fallback. It SHALL persist the assistant message exactly once and SHALL NOT treat a transport interruption as an agent failure while the session is still running.

#### Scenario: Turn exceeds five minutes
- **WHEN** an agent turn runs longer than five minutes
- **THEN** the turn remains running, the UI can keep or restore its connection, and the final answer is persisted without a transport error

#### Scenario: Event stream drops
- **WHEN** the durable event stream or live event subscription disconnects
- **THEN** the system reconnects from its last cursor or reconciles with session state, without duplicating messages or side effects

#### Scenario: Transport fails while the session is active
- **WHEN** a transport timeout occurs but OpenCode reports the session as active
- **THEN** the turn is marked running or recovering, not failed, and the user sees a reconnection state instead of a terminal error

#### Scenario: Final answer is recovered after a lost response
- **WHEN** the agent completed but the platform did not read the response before the transport ended
- **THEN** the system retrieves the assistant message for that turn and persists it as the agent reply

#### Scenario: Outcome cannot be determined
- **WHEN** the session disappeared and no final message or execution outcome can be retrieved
- **THEN** the turn is marked unknown, the user is warned that changes may have occurred, and the prompt is not automatically resent

### Requirement: Idempotent turn creation and per-thread single-flight

The system SHALL serialize turns per thread and SHALL deduplicate retries using a client message key. A second message sent while a turn is active SHALL be queued or rejected with a typed error and MUST NOT send a concurrent prompt to a busy OpenCode session.

#### Scenario: Duplicate send with the same key
- **WHEN** the client retries a send with the same client message key
- **THEN** the server returns the existing turn and does not send another prompt

#### Scenario: Second message while a turn is active
- **WHEN** a user sends another message before the active turn finishes
- **THEN** the server returns a typed turn-in-progress response or queues the message according to policy, without launching a concurrent prompt

#### Scenario: Recovery preserves one user message
- **WHEN** a stale session or transport recovery occurs
- **THEN** the thread still contains one user message for the turn and at most one agent response

#### Scenario: Retry after unknown outcome warns about side effects
- **WHEN** a previous turn is unknown or used tools that can mutate the project
- **THEN** the UI warns the user and does not automatically resend the prompt

### Requirement: Turn timeout, cancellation, and interruption

The system SHALL apply configurable maximum and inactivity timeouts to a turn, SHALL request an OpenCode interruption when a timeout or user cancellation occurs, and SHALL persist the resulting status with an actionable message. A timeout SHALL NOT leave the agent running invisibly.

#### Scenario: Maximum duration is exceeded
- **WHEN** a turn reaches its configured maximum duration
- **THEN** the system interrupts the OpenCode session, marks the turn timed out, and stores a system message explaining what happened

#### Scenario: User cancels a running turn
- **WHEN** the user cancels an active turn
- **THEN** the system interrupts the session, marks the turn cancelled, and warns that partial changes may remain

#### Scenario: Provider retry is not a timeout
- **WHEN** OpenCode reports a provider retry or the session remains active without new text
- **THEN** the turn reflects the retrying or working state and is not falsely marked timed out while progress or activity is possible

#### Scenario: Timeout budget is coherent
- **WHEN** provider and tool timeouts are configured
- **THEN** the turn maximum covers them or the system reports the mismatch instead of failing at a shorter hidden timeout

### Requirement: Turn attach, status, and replay

The system SHALL expose a turn's status and history and SHALL let an SSE subscriber attach, detach, and reattach to a turn, receiving heartbeats, progress, status changes, and a terminal done or error event. It SHALL replay buffered progress from a cursor or explicitly signal a gap.

#### Scenario: Reattach after reload
- **WHEN** the user reloads the page while a turn is running
- **THEN** the UI reads the active turn, attaches to its events, and shows the elapsed time and current status

#### Scenario: SSE connection drops and reconnects
- **WHEN** the browser's SSE connection drops during a turn
- **THEN** the client reconnects with a cursor or status query and does not create a second turn or duplicate the final answer

#### Scenario: Attach to a completed turn
- **WHEN** a client attaches to a turn that already finished
- **THEN** the server returns the terminal status and stored answer without sending a new prompt

#### Scenario: Heartbeats keep a silent turn alive
- **WHEN** the agent produces no text for a period during a running turn
- **THEN** the SSE view receives periodic heartbeats and remains connected

### Requirement: Typed turn outcomes and recoverable errors

The system SHALL classify turn outcomes and errors, including succeeded, failed, timed out, interrupted, cancelled, and unknown, with codes for transport interruption, OpenCode unavailability, missing session, execution failure, empty reply, missing model or agent, and channel delivery failure. Recoverable transport interruptions SHALL NOT be rendered as terminal failures.

#### Scenario: Transport interruption is recoverable
- **WHEN** a transport timeout occurs while the agent may still be working
- **THEN** the turn enters a recovering state and the user sees a reconnection message rather than a terminal error

#### Scenario: Execution fails
- **WHEN** OpenCode reports an execution failure
- **THEN** the turn is marked failed with a sanitized error code and message, and the user can retry with an explicit action

#### Scenario: Agent returns no text
- **WHEN** the agent completes without a textual answer
- **THEN** the turn is marked failed with an empty-reply code and no empty agent message is persisted

#### Scenario: Terminal failure is visible
- **WHEN** a turn reaches a terminal failure
- **THEN** the system message, error ledger, and health view include the turn identifier and error code without secrets or full prompt content

### Requirement: Cross-surface turn reuse and scope

Project web chat, global orchestrator chat, Telegram and WhatsApp agent chat, and the external chat gateway SHALL use the same turn lifecycle while preserving each surface's authorization scope, session context, and delivery semantics.

#### Scenario: Project turn is scoped
- **WHEN** a turn belongs to project A
- **THEN** only project A can read or attach to it, and a cross-project request is rejected with HTTP 403

#### Scenario: Orchestrator empty reply policy
- **WHEN** a read-only orchestrator turn completes without text
- **THEN** it may retry once on a new session, while a project chat turn that may have mutated the project does not auto-retry

#### Scenario: Channel reply is delivered after completion
- **WHEN** an agent-mode channel turn completes
- **THEN** the reply is delivered through the same integration, retried idempotently if delivery fails, and the turn remains succeeded

#### Scenario: External chat stream disconnects
- **WHEN** an external chat client disconnects during SSE streaming
- **THEN** the turn continues and the final reply is available through the thread mapping or configured webhook

### Requirement: Turn lifecycle observability

The system SHALL log and measure turn creation, delivery, progress, completion, failure, timeout, cancellation, recovery, and retry with turn, thread, project, session, and entry-point identifiers, duration, status, and usage. Terminal turn failures SHALL appear in the error ledger and health view.

#### Scenario: Long turn succeeds after a transport interruption
- **WHEN** a turn takes more than five minutes and succeeds after a transport interruption
- **THEN** metrics record the duration and recovery and the health view does not report it as a terminal error

#### Scenario: Terminal turn failure is counted
- **WHEN** a turn fails, times out, or is cancelled
- **THEN** the error ledger and health metrics show the outcome, entry point, and sanitized error code

#### Scenario: Active turns are visible
- **WHEN** one or more turns are running
- **THEN** health reports the active count and the age of the oldest active turn instead of only HTTP request status

#### Scenario: Turn telemetry excludes sensitive content
- **WHEN** turn telemetry is emitted
- **THEN** it contains no secrets, tokens, full prompts, or message bodies
