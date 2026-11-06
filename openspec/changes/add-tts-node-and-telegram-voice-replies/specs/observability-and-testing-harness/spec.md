# Spec Delta

## ADDED Requirements

### Requirement: Speech synthesis and voice delivery telemetry

The system SHALL emit structured telemetry for speech synthesis, audio conversion, and voice delivery with project, integration, node or turn, model, voice, character count, duration, size, outcome, and latency, excluding the synthesized text, audio content, and secrets.

#### Scenario: Synthesis completes or fails

- **WHEN** a speech synthesis succeeds or fails
- **THEN** the system records the provider model, voice, character count, outcome, and latency without the text or audio content

#### Scenario: Voice delivery falls back to text

- **WHEN** automatic voice replies fall back because speech is missing, synthesis fails, or the text exceeds the limit
- **THEN** the system records a sanitized reason and the delivered fallback without marking the turn as failed

#### Scenario: Audio conversion is observed

- **WHEN** generated audio is converted to OGG/Opus or delivered as an audio-file fallback
- **THEN** the system records the target format, duration, size, outcome, and latency without the audio content

#### Scenario: Health shows the speech connection

- **WHEN** an administrator opens the health dashboard
- **THEN** the configured speech connections appear with their last test status and sanitized error when applicable

#### Scenario: No sensitive content is logged

- **WHEN** speech synthesis or voice delivery is recorded
- **THEN** logs and metrics exclude the reply text, generated audio bytes, API keys, and raw provider payloads

### Requirement: Speech regression coverage

The automated suite SHALL cover speech provider requests, the `speak` node, default connection resolution, automatic voice replies, text fallback, OGG/Opus conversion, and cross-project isolation.

#### Scenario: Provider contract tests

- **WHEN** the test suite runs
- **THEN** it verifies the speech request shape, authentication behavior, response validation, timeouts, and sanitized provider errors for local and API-key connections

#### Scenario: Speak node tests

- **WHEN** the test suite runs
- **THEN** it verifies text extraction, voice/model/speed overrides, media storage, missing text, long text, provider failure, and project isolation

#### Scenario: Automatic voice reply tests

- **WHEN** the test suite runs
- **THEN** it verifies that `never` stays text-only, `auto` voices only audio-originated turns, missing speech and provider failures fall back to text, and text-originated turns never call speech

#### Scenario: Audio delivery tests

- **WHEN** the test suite runs
- **THEN** it verifies native OGG/Opus voice notes, caption limits, audio longer than 60 seconds, converter failure fallback, and unsupported-channel errors

#### Scenario: Local speech integration test

- **WHEN** the local speech service is available in the test environment
- **THEN** an integration test synthesizes a short Spanish phrase and verifies that the audio reaches a Telegram voice delivery or `speak` node result
