# Spec Delta

## Purpose

Define un contrato único de configuración para integraciones, nodos, ajustes de proyecto y plataforma, de modo que servidor y UI compartan esquemas, defaults, metadata y validación, y que todo valor efectivo tenga una fuente visible.

## ADDED Requirements

### Requirement: Single configuration contract
The system SHALL define each integration kind and node type with one shared configuration contract containing its schema, defaults, field metadata, capabilities, and secret fields, and SHALL use that contract in both server validation and web forms.

#### Scenario: New field appears in both validation and UI
- **WHEN** a field is added to a node or integration contract
- **THEN** the server validates it and the web form exposes it from the same metadata without a second hand-written definition

#### Scenario: Guided fields do not require raw JSON
- **WHEN** a user configures a supported integration or node
- **THEN** the UI renders the guided fields from the contract and only exposes advanced JSON as an optional, validated fallback

#### Scenario: Invalid configuration is rejected before persistence
- **WHEN** an integration or node configuration violates its contract
- **THEN** the system rejects the create, update, or workflow save with field-level errors and persists nothing

### Requirement: Effective configuration resolution
The system SHALL resolve every configuration value through an explicit precedence of entity, project, platform, environment, and default layers, and SHALL expose the effective value, its source, and whether a restart is required without revealing secret values.

#### Scenario: Effective value shows its source
- **WHEN** an administrator opens the configuration view for a setting such as the default model or orchestrator model
- **THEN** the UI shows the value that will be used and whether it comes from the entity, project, platform settings, environment, or default

#### Scenario: Secret values stay masked
- **WHEN** the effective configuration includes a token, password, or DSN
- **THEN** the API returns only an alias, a masked preview, and the source, never the plaintext value

#### Scenario: Restart-required setting is applied at startup
- **WHEN** an administrator saves a restart-required setting such as the Sentry DSN
- **THEN** the next startup reads the persisted value and applies it without requiring the environment variable

#### Scenario: Environment-only setting is read-only
- **WHEN** a setting can only come from the environment
- **THEN** the UI shows it as read-only with its source instead of offering an edit that would have no effect

### Requirement: Configuration change safety
The system SHALL preserve stable identifiers when configuration is edited and SHALL remove or reject stale keys that no longer belong to the selected kind or type.

#### Scenario: Credential rotation preserves references
- **WHEN** a user rotates a Telegram token or changes routing on an existing integration
- **THEN** the integration keeps its identifier and every trigger, notification, and approval reference remains valid

#### Scenario: Changing kind resets incompatible configuration
- **WHEN** a user changes a trigger from integration to manual or changes an integration kind
- **THEN** the system removes configuration keys that belong only to the previous kind and rejects the save if required fields for the new kind are missing

#### Scenario: Secret-like value in non-secret configuration is rejected
- **WHEN** a user pastes a token or password into an advanced JSON field that is not declared as a secret field
- **THEN** the system rejects the configuration and explains which guided secret field to use instead
