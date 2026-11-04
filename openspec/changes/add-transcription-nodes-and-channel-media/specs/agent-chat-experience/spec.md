# Spec Delta

## ADDED Requirements

### Requirement: Chat turns preserve message attachments

The system SHALL persist attachment references with user chat messages and SHALL reuse them when a failed turn is retried.

#### Scenario: Attachment is stored with the user message

- **WHEN** a channel turn includes images or audio references
- **THEN** the stored user message includes the attachment metadata and the chat history returns it

#### Scenario: Retry reuses the original attachments

- **WHEN** a turn with attachments fails and the user retries
- **THEN** the new turn sends the same attachment references to the agent

#### Scenario: Retried images reach the model

- **WHEN** a turn is retried with image attachments
- **THEN** the agent prompt includes the same `file://` references

#### Scenario: Missing attachment fails clearly

- **WHEN** a stored attachment no longer exists at retry time
- **THEN** the turn fails with a clear error and does not send a partial prompt
