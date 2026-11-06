# Spec Delta

## ADDED Requirements

### Requirement: Opt-in voice replies for audio messages

The system SHALL let a project Telegram channel opt into automatic voice replies with a `voiceReplies` setting of `never` (default) or `auto`, and SHALL synthesize the agent's final reply only when the incoming message contained audio.

#### Scenario: Default remains text-only

- **WHEN** a channel has no `voiceReplies` configuration and receives an audio message
- **THEN** the agent reply is delivered as text and no speech provider is called

#### Scenario: Audio message receives a voice reply

- **WHEN** an allowlisted sender sends a voice note to a channel with `voiceReplies: auto` and the agent turn succeeds
- **THEN** the system synthesizes the final reply and delivers it as a Telegram voice note with the reply text as caption

#### Scenario: Text message receives a text reply

- **WHEN** a channel has `voiceReplies: auto` and receives a text message
- **THEN** the reply is delivered as text and no speech provider is called

#### Scenario: Audio with a caption

- **WHEN** an audio message includes a caption and the turn succeeds
- **THEN** the system delivers the voice reply and keeps the agent's text reply available as the caption

#### Scenario: No speech connection configured

- **WHEN** automatic voice replies are enabled but the project has no default speech connection
- **THEN** the system delivers the reply as text, records a warning, and does not fail the turn

#### Scenario: Speech synthesis fails

- **WHEN** the speech provider fails, times out, or returns empty audio
- **THEN** the system delivers the agent reply as text and records a sanitized failure without failing the turn

#### Scenario: Reply exceeds the synthesis limit

- **WHEN** the agent reply exceeds the configured synthesis length
- **THEN** the system delivers the reply as text and records that the voice reply was skipped

#### Scenario: Workflow mode does not auto-synthesize

- **WHEN** a channel message is routed to a workflow
- **THEN** the system does not synthesize the workflow result automatically; the workflow decides whether to use a `speak` node

### Requirement: Outbound audio delivery

The system SHALL expose audio delivery through the channel egress contract and SHALL deliver Telegram audio as a native voice note when the generated audio is between 1 and 60 seconds, with a documented fallback for unsupported durations or unavailable conversion.

#### Scenario: Telegram voice note

- **WHEN** the system sends audio between 1 and 60 seconds to a Telegram recipient
- **THEN** it converts the audio to OGG/Opus and sends a native voice note with the available text as caption

#### Scenario: Caption within the Telegram limit

- **WHEN** the reply text fits within Telegram's caption limit
- **THEN** the voice note carries the reply text as its caption

#### Scenario: Caption exceeds the Telegram limit

- **WHEN** the reply text exceeds Telegram's caption limit
- **THEN** the system sends the voice note without a truncated caption and delivers the full text as a separate message

#### Scenario: Audio longer than the voice-note limit

- **WHEN** the generated audio exceeds 60 seconds
- **THEN** the system delivers it as a Telegram audio file instead of a voice note and keeps the text caption when it fits

#### Scenario: Audio conversion is unavailable

- **WHEN** OGG/Opus conversion fails or the converter is not installed
- **THEN** the system delivers the audio as a supported audio file, records a warning, and does not lose the reply

#### Scenario: Channel without audio support

- **WHEN** a workflow requests audio delivery through a channel that does not support audio in this change
- **THEN** the delivery fails with an explicit error and the run records it without dropping the failure silently

### Requirement: Workflow audio output delivery

The system SHALL deliver the audio produced by a `speak` node when it is part of the final workflow output, using the same voice-note rules and text fallback as agent voice replies.

#### Scenario: Final output contains generated audio

- **WHEN** a workflow run succeeds with a final output that contains an audio media reference
- **THEN** the channel reads the referenced project media and delivers it to the sender as audio

#### Scenario: Output also contains text

- **WHEN** the final output contains text alongside the audio reference
- **THEN** the system uses that text as the audio caption subject to the same length rules

#### Scenario: Audio file is missing

- **WHEN** the referenced audio file no longer exists or resolves outside the project's media area
- **THEN** the delivery fails with an actionable error and the run records the failed delivery

#### Scenario: Audio output without a supported channel

- **WHEN** the workflow output contains audio but the integration is not a Telegram channel
- **THEN** the delivery fails explicitly without sending the audio as text
