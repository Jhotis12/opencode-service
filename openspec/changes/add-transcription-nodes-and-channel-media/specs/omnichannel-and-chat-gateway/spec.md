# Spec Delta

## ADDED Requirements

### Requirement: Inbound channel media capture

The system SHALL capture supported media from inbound project channels, validate its real type and size, and persist it inside the owning project's workspace before routing the message.

#### Scenario: Telegram photo is captured

- **WHEN** a project Telegram integration receives a photo with or without a caption
- **THEN** the system downloads the largest available photo, validates it as a supported image, stores it under the project's media area, and routes the message with an image attachment

#### Scenario: Telegram voice note or audio file is captured

- **WHEN** a project Telegram integration receives a voice note or an audio file
- **THEN** the system downloads it, validates the audio type and size, stores it under the project's media area, and routes the message with an audio attachment

#### Scenario: Image document is captured

- **WHEN** a Telegram integration receives a document whose detected content is a supported image type
- **THEN** the system stores it as an image attachment and routes the message

#### Scenario: Unsupported document is rejected

- **WHEN** a Telegram integration receives a document that is not a supported image
- **THEN** the system does not route it to an agent or workflow, replies with a clear unsupported-format message, and records the rejection without logging the file contents

#### Scenario: Oversized or invalid media is rejected

- **WHEN** a media file exceeds the configured size limit, fails content validation, or has an unsupported type
- **THEN** the system does not route it to an agent or workflow and records a sanitized rejection reason

#### Scenario: Stored media stays inside the project

- **WHEN** media arrives through a project integration
- **THEN** the stored file is addressable only under that project's workspace and cannot be read through a sibling project

### Requirement: Automatic audio transcription for agent-mode channels

The system SHALL transcribe inbound audio before starting an agent-mode chat turn using the project's configured transcription connection, and SHALL reject the turn with an actionable message when no connection is available or transcription fails.

#### Scenario: Telegram voice note in agent mode

- **WHEN** an allowlisted sender sends a voice note to a Telegram integration in agent mode and the project has a transcription connection configured
- **THEN** the system transcribes the audio and starts the chat turn with the transcript as the user message

#### Scenario: Audio with a caption

- **WHEN** an audio message includes a caption
- **THEN** the system preserves the caption and adds the transcript before sending the turn

#### Scenario: No transcription connection configured

- **WHEN** audio arrives in agent mode and the project has no transcription connection configured
- **THEN** the system replies that transcription is not configured and does not start the agent turn

#### Scenario: Transcription provider failure

- **WHEN** the transcription provider fails, times out, or returns an empty transcript
- **THEN** the system replies with a sanitized error and does not start the agent with an empty or invented message

#### Scenario: Workflow mode does not auto-transcribe

- **WHEN** a channel message is routed to a workflow
- **THEN** the system does not transcribe it automatically; the workflow decides whether to use a transcribe node

### Requirement: Media attachments in channel chat turns

The system SHALL pass supported image attachments from a channel message to the agent as OpenCode file attachments and SHALL persist attachment references with the user message so retries can reuse them.

#### Scenario: Image reaches the agent

- **WHEN** an image message is routed to an agent-mode turn
- **THEN** the agent prompt includes a `file://` reference to the stored image plus the user text or caption

#### Scenario: Image without a caption

- **WHEN** an image message has no caption
- **THEN** the system supplies a neutral instruction to analyze the attached image

#### Scenario: Retry preserves attachments

- **WHEN** a failed turn with attachments is retried from the chat API
- **THEN** the new turn reuses the original attachment references instead of losing the media

#### Scenario: Attachment path outside the project is rejected

- **WHEN** an attachment path resolves outside the project's media area
- **THEN** the system rejects the turn and records the blocked path without reading the file
