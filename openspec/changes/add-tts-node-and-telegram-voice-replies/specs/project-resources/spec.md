# Spec Delta

## ADDED Requirements

### Requirement: Speech integration kind

The system SHALL support a project-scoped `speech` integration that stores an API base URL, a default model, a default voice, an optional speed and response format, and an optional encrypted API key, and exposes a `synthesize_speech` capability.

#### Scenario: Create a local speech connection

- **WHEN** a user creates a speech integration pointing to the local speaches base URL with a Kokoro model and a Spanish voice
- **THEN** the system stores the non-secret configuration and returns the integration with the `synthesize_speech` capability

#### Scenario: Create a third-party speech connection

- **WHEN** a user creates a speech integration with a third-party OpenAI-compatible base URL and an API key
- **THEN** the key is stored in the project vault and is never returned in plaintext

#### Scenario: Test the connection

- **WHEN** the user tests the speech integration
- **THEN** the system synthesizes a short sample, returns the latency and available models, and confirms that the provider produced audio

#### Scenario: Test fails with a sanitized error

- **WHEN** the provider is unreachable, rejects the credential, or returns empty audio
- **THEN** the test returns a sanitized error without the key and the integration status reflects the failure

#### Scenario: Local provider does not require an API key

- **WHEN** the provider does not require authentication
- **THEN** the integration can be saved and used without an API key

#### Scenario: Voice and model defaults are configurable

- **WHEN** a user edits the speech integration
- **THEN** the stored model, voice, speed, and response format become the defaults for nodes and automatic replies that do not override them

#### Scenario: Invalid configuration is rejected

- **WHEN** the base URL is invalid, the model is empty, the voice is empty, or the speed is outside the supported range
- **THEN** the system rejects the create or update with a validation error identifying the field

#### Scenario: Cross-project access is rejected

- **WHEN** project A tries to test, update, or reference a speech integration owned by project B
- **THEN** the system rejects the operation and records the rejected access

### Requirement: Project default speech connection

The system SHALL let a project select a default speech integration used by automatic voice replies and by `speak` nodes that do not specify one.

#### Scenario: Set the project default

- **WHEN** a user selects a project speech integration as the default
- **THEN** automatic voice replies and inheriting `speak` nodes use that connection

#### Scenario: Clear the project default

- **WHEN** the user clears the default speech connection
- **THEN** automatic voice replies fall back to text and inheriting `speak` nodes fail with an actionable message until a connection is selected again

#### Scenario: Wrong integration is rejected

- **WHEN** the selected integration is not a speech integration owned by the project or lacks `synthesize_speech`
- **THEN** the settings update is rejected

#### Scenario: Readiness exposes a missing connection

- **WHEN** a channel has automatic voice replies enabled or a workflow has a `speak` node without its own connection and the project has no default speech connection
- **THEN** the project readiness checklist marks speech as a missing configuration

### Requirement: Guided speech configuration

The system SHALL let a user configure a speech integration from structured fields for base URL, model, voice, speed, response format, and API key without requiring raw JSON for the common case.

#### Scenario: Structured speech form

- **WHEN** a user creates a speech integration from the resources panel
- **THEN** the form asks for base URL, model, voice, speed, response format, and API key without requiring a JSON editor

#### Scenario: Test and choose a model

- **WHEN** the user activates the connection test
- **THEN** the panel shows the provider models and lets the user choose the default model

#### Scenario: Local voice suggestions

- **WHEN** the user configures a local Kokoro model
- **THEN** the form offers the known Spanish voices as suggestions and still accepts a custom voice identifier

#### Scenario: Advanced JSON remains available

- **WHEN** a user needs provider-specific fields
- **THEN** an optional advanced JSON section remains available without hiding the guided fields

#### Scenario: Secret is masked

- **WHEN** the speech integration is listed
- **THEN** the API key is shown only as saved or not saved, never in plaintext
