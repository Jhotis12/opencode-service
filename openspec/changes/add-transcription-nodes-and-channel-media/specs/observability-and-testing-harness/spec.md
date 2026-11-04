# Spec Delta

## ADDED Requirements

### Requirement: Media and transcription telemetry

The system SHALL emit structured telemetry for media capture and transcription with project, integration, kind, size, duration, outcome, and latency, excluding file contents, transcripts, and secrets.

#### Scenario: Media is captured

- **WHEN** a channel stores an image or audio attachment
- **THEN** a log and metric record the kind, size, integration, and outcome without the file content

#### Scenario: Media is rejected

- **WHEN** media fails type or size validation
- **THEN** a sanitized rejection event records the reason and source without logging the payload

#### Scenario: Transcription completes or fails

- **WHEN** a transcription succeeds or fails
- **THEN** the system records the provider model, duration, outcome, and latency without the transcript text

#### Scenario: Health shows the transcription connection

- **WHEN** an administrator opens the health dashboard
- **THEN** the configured transcription connections appear with their last test status and sanitized error when applicable

#### Scenario: Retry and timeout are observable

- **WHEN** a transcription times out or is retried
- **THEN** the telemetry records each attempt and the terminal outcome without the audio content

### Requirement: Media and transcription regression coverage

The automated suite SHALL cover media capture, attachment persistence, retries, transcription success and failure, trigger media filtering, and cross-project media isolation.

#### Scenario: Capture and adapter tests

- **WHEN** the test suite runs
- **THEN** it verifies Telegram photo and voice capture, media validation, storage, transcription provider requests, and transcribe node execution

#### Scenario: Chat retry preserves attachments

- **WHEN** the test suite runs
- **THEN** it verifies attachments survive a failed turn and a retry sends the same files

#### Scenario: Trigger filtering tests

- **WHEN** the test suite runs
- **THEN** it verifies text-only, image-only, audio-only, and mixed messages route according to `accepts`

#### Scenario: Cross-project isolation tests

- **WHEN** the test suite runs
- **THEN** it verifies a project cannot reference another project's media or transcription connection

#### Scenario: Local OGG/Opus integration test

- **WHEN** the local transcription service is available in the test environment
- **THEN** an integration test transcribes a real OGG/Opus voice note and verifies the transcript reaches an agent turn or transcribe node
