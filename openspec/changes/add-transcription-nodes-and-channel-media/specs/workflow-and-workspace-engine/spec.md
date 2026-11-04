# Spec Delta

## ADDED Requirements

### Requirement: Transcribe node

The system SHALL execute a `transcribe` node that reads audio attachments from its input, calls a project transcription connection, and returns the transcript with language and duration metadata.

#### Scenario: Workflow transcribes an inbound audio attachment

- **WHEN** a trigger accepts audio and the flow reaches a `transcribe` node whose input contains an audio attachment
- **THEN** the node transcribes the audio and returns an object containing the transcript and available language and duration metadata

#### Scenario: Multiple audio attachments are transcribed

- **WHEN** the input contains more than one audio attachment within the configured limit
- **THEN** the node transcribes each file and returns the combined transcript plus a per-file segment list

#### Scenario: No audio is available

- **WHEN** the node's configured media path contains no audio attachment
- **THEN** the step fails with an actionable error naming the node and the media path

#### Scenario: Transcription provider fails

- **WHEN** the transcription provider fails or times out
- **THEN** the step follows its retry policy and, if it still fails, its configured error strategy, and the run records a sanitized error

#### Scenario: Node overrides model or language

- **WHEN** a `transcribe` node declares a model or language
- **THEN** those values override the connection defaults for that node only

#### Scenario: Media path outside the project is rejected

- **WHEN** a media reference resolves outside the project's media area
- **THEN** the node rejects it without reading the file and records the blocked path

### Requirement: Integration trigger media acceptance

The system SHALL let an integration trigger declare which message kinds it accepts (`text`, `image`, `audio`), SHALL default to text-only for existing workflows, and SHALL route a message only when it contains at least one accepted kind.

#### Scenario: Default preserves text-only workflows

- **WHEN** an existing integration trigger has no `accepts` configuration and a text message arrives
- **THEN** the workflow runs unchanged

#### Scenario: Text-only trigger drops a photo without caption

- **WHEN** a text-only integration trigger receives a photo without a caption
- **THEN** the message is dropped with a recorded reason and no workflow starts

#### Scenario: Trigger accepts images

- **WHEN** a trigger declares `image` and an image message arrives
- **THEN** the workflow starts and the payload contains the image attachment

#### Scenario: Trigger accepts audio

- **WHEN** a trigger declares `audio` and an audio message arrives
- **THEN** the workflow starts and the payload contains the audio attachment without automatic transcription

#### Scenario: Only accepted attachments are passed

- **WHEN** a message contains a caption and a photo and the trigger accepts only text
- **THEN** the workflow payload contains the text and does not expose the image attachment

#### Scenario: Trigger accepts mixed content

- **WHEN** a trigger accepts text and image and an image with a caption arrives
- **THEN** the workflow starts with both the caption and the image attachment

### Requirement: Agent node media attachments

The system SHALL attach supported image files found in an agent node's input to the agent prompt and SHALL warn the agent when audio attachments are present without a transcript.

#### Scenario: Image input is attached to the prompt

- **WHEN** an agent node receives an image attachment at its configured media path
- **THEN** the agent prompt includes a `file://` attachment for the selected model

#### Scenario: Audio without transcript is flagged

- **WHEN** the input contains an audio attachment and no transcription result
- **THEN** the agent prompt states that audio is present but not transcribed and does not pretend to have heard it

#### Scenario: Path traversal is rejected

- **WHEN** a media reference resolves outside the project's media area
- **THEN** the node rejects the attachment and records the blocked path

#### Scenario: Selected model lacks image input

- **WHEN** the selected model does not advertise image input and the node receives images
- **THEN** the run records a warning that the model cannot inspect the attached images

#### Scenario: Multiple images within the node limit

- **WHEN** the input contains several images within the per-node limit
- **THEN** all are attached to the prompt

### Requirement: Transcription resource validation for workflows

The system SHALL validate that a `transcribe` node references a transcription integration owned by its project or that the project has a default transcription connection before saving or executing.

#### Scenario: Missing connection is rejected

- **WHEN** a `transcribe` node has no integration and the project has no default transcription connection
- **THEN** save or run validation fails with an actionable message

#### Scenario: Cross-project connection is rejected

- **WHEN** a `transcribe` node references a transcription integration from another project or from the global scope
- **THEN** validation rejects the workflow or the run

#### Scenario: Deleted connection fails before execution

- **WHEN** the referenced transcription connection no longer exists before a run
- **THEN** the run fails before executing the node with a clear message

#### Scenario: Valid connection is accepted

- **WHEN** the node references a project transcription integration
- **THEN** validation passes and the run uses that connection
