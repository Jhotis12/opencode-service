# Spec Delta

## ADDED Requirements

### Requirement: Transcription integration kind

The system SHALL support a project-scoped `transcription` integration that stores an API base URL, a default model, an optional language, and an optional encrypted API key, and exposes a `transcribe_audio` capability.

#### Scenario: Create a local transcription connection

- **WHEN** a user creates a transcription integration pointing to a local speaches base URL with the model `Systran/faster-whisper-small`
- **THEN** the system stores the non-secret configuration and returns the integration with the `transcribe_audio` capability

#### Scenario: Create a third-party transcription connection

- **WHEN** a user creates a transcription integration with a third-party OpenAI-compatible base URL and an API key
- **THEN** the key is stored in the project vault and is never returned in plaintext

#### Scenario: Test the connection and list models

- **WHEN** the user tests the transcription integration
- **THEN** the system calls the provider's models endpoint and returns the available model identifiers with latency

#### Scenario: Test fails with a sanitized error

- **WHEN** the provider is unreachable or rejects the credential
- **THEN** the test returns a sanitized error without the key and the integration status reflects the failure

#### Scenario: Local provider does not require an API key

- **WHEN** the provider does not require authentication
- **THEN** the integration can be saved without an API key

#### Scenario: Invalid configuration is rejected

- **WHEN** the base URL is invalid or the default model is empty
- **THEN** the system rejects the create or update with a validation error identifying the field

#### Scenario: Cross-project access is rejected

- **WHEN** project A tries to test, update, or reference a transcription integration owned by project B
- **THEN** the system rejects the operation and records the rejected access

### Requirement: Project default transcription connection

The system SHALL let a project select a default transcription integration used by agent-mode audio and by transcribe nodes that do not specify one.

#### Scenario: Set the project default

- **WHEN** a user selects a project transcription integration as the default
- **THEN** agent-mode audio and inheriting transcribe nodes use that connection

#### Scenario: Clear the project default

- **WHEN** the user clears the default transcription connection
- **THEN** agent-mode audio is rejected with an actionable message until a connection is selected again

#### Scenario: Wrong integration is rejected

- **WHEN** the selected integration is not a transcription integration owned by the project
- **THEN** the settings update is rejected

#### Scenario: Readiness exposes a missing connection

- **WHEN** a workflow has a transcribe node without its own connection and the project has no default
- **THEN** the project readiness checklist marks transcription as a missing configuration

### Requirement: Guided transcription configuration

The system SHALL let a user configure a transcription integration from structured fields (base URL, model, language, API key) without requiring raw JSON for the common case.

#### Scenario: Structured transcription form

- **WHEN** a user creates a transcription integration from the resources panel
- **THEN** the form asks for base URL, model, language, and API key without requiring a JSON editor

#### Scenario: Test and choose a model

- **WHEN** the user activates the connection test
- **THEN** the panel shows the provider models and lets the user choose the default model

#### Scenario: Advanced JSON remains available

- **WHEN** a user needs provider-specific fields
- **THEN** an optional advanced JSON section remains available without hiding the guided fields

#### Scenario: Secret is masked

- **WHEN** the transcription integration is listed
- **THEN** the API key is shown only as saved or not saved, never in plaintext
