# Spec Delta

## ADDED Requirements

### Requirement: Speak node

The system SHALL execute a `speak` node that reads text from its input, synthesizes audio through a project speech connection, stores the result inside the project's media area, and returns the spoken text plus an audio media reference.

#### Scenario: Workflow synthesizes text into audio

- **WHEN** the flow reaches a `speak` node whose input contains text
- **THEN** the node synthesizes the audio, stores it under the project's media area, and returns an object containing the text and an audio `MediaRef`

#### Scenario: Plain text input

- **WHEN** the node input is a plain string
- **THEN** the node uses that string as the text to synthesize

#### Scenario: Node overrides voice, model, or speed

- **WHEN** a `speak` node declares a voice, model, or speed
- **THEN** those values override the connection defaults for that node only

#### Scenario: Project default connection

- **WHEN** a `speak` node does not declare an integration and the project has a default speech connection
- **THEN** the node uses the project default

#### Scenario: Missing text

- **WHEN** the configured text path resolves to an empty value or a non-string value
- **THEN** the step fails with an actionable error naming the node and the text path without calling the provider

#### Scenario: Text exceeds the synthesis limit

- **WHEN** the text exceeds the configured maximum synthesis length
- **THEN** the step fails with an actionable error and does not truncate or synthesize partial content

#### Scenario: Speech provider fails

- **WHEN** the speech provider fails, times out, or returns empty audio
- **THEN** the step follows its retry policy and, if it still fails, its configured error strategy, and the run records a sanitized error

#### Scenario: Stored audio stays inside the project

- **WHEN** the node stores generated audio
- **THEN** the file is addressable only under the owning project's media area and cannot be read through a sibling project

### Requirement: Speech resource validation for workflows

The system SHALL validate that a `speak` node references a speech integration owned by its project with the `synthesize_speech` capability or that the project has a default speech connection before saving or executing.

#### Scenario: Missing connection is rejected

- **WHEN** a `speak` node has no integration and the project has no default speech connection
- **THEN** save or run validation fails with an actionable message

#### Scenario: Cross-project connection is rejected

- **WHEN** a `speak` node references a speech integration from another project or from the global scope
- **THEN** validation rejects the workflow or the run

#### Scenario: Wrong integration kind is rejected

- **WHEN** a `speak` node references an integration that is not a speech integration or lacks `synthesize_speech`
- **THEN** validation rejects the workflow or the run

#### Scenario: Deleted connection fails before execution

- **WHEN** the referenced speech connection no longer exists before a run
- **THEN** the run fails before executing the node with a clear message

#### Scenario: Valid connection is accepted

- **WHEN** the node references a project speech integration or the project default
- **THEN** validation passes and the run uses that connection
