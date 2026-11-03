# Spec Delta

## MODIFIED Requirements

### Requirement: Long-running project chat with SSE heartbeats
The system SHALL back project chat with durable turns, stream their views over SSE with periodic heartbeats, and apply a configurable turn timeout that interrupts the agent and persists the outcome instead of treating the HTTP request as the turn.

#### Scenario: Long agent construction keeps the connection alive
- **WHEN** the agent takes several minutes to build nodes or run tools
- **THEN** the server sends heartbeat events while the turn runs, and the turn continues if the SSE connection is lost

#### Scenario: Chat timeout is persisted
- **WHEN** the agent exceeds the configured turn timeout
- **THEN** the system interrupts the session, marks the turn timed out, stores a system message, and lets the user retry or continue without losing prior messages

#### Scenario: Page reload during a project turn
- **WHEN** the user reloads or leaves the project page while its turn is running
- **THEN** returning to the project shows the active turn and attaches to its events or completed answer without creating a second turn

## ADDED Requirements

### Requirement: Project-scoped chat turn access

Each chat turn SHALL belong to exactly one project or to the global control scope, and the system SHALL reject reads, attachments, retries, or cancellations from a different project scope.

#### Scenario: Sibling project cannot attach to a turn
- **WHEN** a request scoped to project B tries to read or attach to a turn owned by project A
- **THEN** the system responds with HTTP 403 and does not reveal the turn's messages or status

#### Scenario: Global and project turns remain separate
- **WHEN** a user lists project chat history
- **THEN** it contains only turns owned by that project and never global orchestrator turns or sibling project turns

#### Scenario: Channel turn maps to its owning project
- **WHEN** a project channel turn is created from an integration message
- **THEN** its turn record and attachments are scoped to the integration's project and external thread

#### Scenario: Cross-project retry is rejected
- **WHEN** a caller attempts to retry or cancel a turn from another project scope
- **THEN** the system rejects the action with HTTP 403 and records the scope mismatch without message content
