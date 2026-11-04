# Spec Delta

## ADDED Requirements

### Requirement: Model input modality discovery

The system SHALL expose each available model's supported input modalities so the UI can warn when a text-only model is selected for image analysis.

#### Scenario: Model list includes input modalities

- **WHEN** the web requests the available models
- **THEN** each model includes its supported input types, such as text, image, or PDF, when the runtime reports them

#### Scenario: Vision-capable model is marked

- **WHEN** a model supports image input
- **THEN** the project settings and node model selectors mark it as vision-capable

#### Scenario: Text-only model warning

- **WHEN** a user selects a text-only model for an agent node that receives images
- **THEN** the inspector warns that image analysis may not work

#### Scenario: Missing modality metadata

- **WHEN** the runtime does not report input modalities for a model
- **THEN** the UI does not claim support and the run records a warning when an image is attached
