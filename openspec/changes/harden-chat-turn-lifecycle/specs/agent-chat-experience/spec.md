# Spec Delta

## MODIFIED Requirements

### Requirement: Chat progress, timeout, and error states
The chat SHALL show that the agent is working, preserve timeout and failure messages in history, allow reconnecting to a running turn, and allow retrying without losing prior messages. A recoverable transport interruption SHALL NOT be presented as a terminal agent failure.

#### Scenario: Long-running agent turn
- **WHEN** the agent takes several minutes to build nodes or run tools
- **THEN** the chat shows an elapsed-time indicator, the current activity, and a connection state that can reattach to the durable turn

#### Scenario: Timeout is persisted
- **WHEN** the agent exceeds the configured turn timeout
- **THEN** the turn is interrupted, stored as timed out with a system message, and the user can retry or continue from the same conversation

#### Scenario: Chat request fails before a reply
- **WHEN** the chat transport fails or the browser connection drops
- **THEN** the chat shows a reconnecting state while the turn is still running instead of a terminal error, and restores the final answer when the turn completes

#### Scenario: Recovered turn is not shown as failed
- **WHEN** a turn marked as recovering completes successfully
- **THEN** the final answer is shown and the transient transport interruption is not left in the history as a terminal failure

## ADDED Requirements

### Requirement: Turn status and recovery controls

The chat SHALL display the active turn's status and elapsed time, restore that state when the drawer is reopened, and offer cancel and retry actions appropriate to the turn outcome without duplicating local messages.

#### Scenario: Reopening the chat during a turn
- **WHEN** the user closes or reloads the chat while a turn is running
- **THEN** reopening the chat shows the turn as in progress with its original start time and attaches to its current events

#### Scenario: Cancelling a running turn
- **WHEN** the user activates cancel on an active turn
- **THEN** the chat asks for confirmation if the turn may have changed files, shows the cancelled status, and keeps the partial conversation

#### Scenario: Retrying a failed turn
- **WHEN** a turn ends in failed or timed out state
- **THEN** the chat offers a retry action that creates a new turn with a clear warning when prior tools may have had side effects

#### Scenario: No duplicate messages after recovery
- **WHEN** the chat restores a running or completed turn from the server
- **THEN** the local message list is reconciled by turn identifier and does not show the user message or the final answer twice
