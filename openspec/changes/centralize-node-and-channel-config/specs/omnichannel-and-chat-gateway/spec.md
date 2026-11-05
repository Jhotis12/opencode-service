# Spec Delta

## MODIFIED Requirements

### Requirement: Project-scoped channel routing
The system SHALL resolve every incoming project channel message to exactly one owning project and route it deterministically according to that integration's mode and the matching trigger whose kind is integration, whose integration supports inbound messages, and whose event is supported, without scanning unrelated projects.

#### Scenario: Telegram message reaches the owning project
- **WHEN** a message arrives through a Telegram integration owned by project `ventas`
- **THEN** the system routes it only within `ventas` according to the integration's mode and never evaluates triggers in sibling projects

#### Scenario: Sibling project with a similar channel does not compete
- **WHEN** two projects have integrations with the same display slug or bot name but different integration identifiers
- **THEN** each message is routed by its integration identifier and neither project can consume the other's messages

#### Scenario: No matching trigger in the owning project
- **WHEN** a channel uses workflow mode and the owning project has no matching trigger for the incoming event
- **THEN** the system drops the message with a recorded reason and does not fall back to another project

#### Scenario: Manual or stale trigger does not consume messages
- **WHEN** the owning project has a trigger whose kind is manual but which still carries the integration identifier
- **THEN** the system ignores that trigger and does not start the workflow

#### Scenario: Non-channel integration does not consume messages
- **WHEN** a trigger references a database, HTTP, transcription, or other non-inbound integration
- **THEN** an incoming channel message never matches it and the drop reason identifies the missing inbound capability

### Requirement: Separate global control channels
The system SHALL keep global orchestrator integrations separate from project integrations, with their own administrator allowlist, event subscriptions, and lifecycle, and SHALL never expose them as project channels.

#### Scenario: Global channel is not available to projects
- **WHEN** a project lists available channels for a trigger or resource picker
- **THEN** global integrations are excluded and only project integrations are selectable

#### Scenario: Project channel is not available to the orchestrator
- **WHEN** the global orchestrator lists its channels or sends an alert
- **THEN** it can only use global integrations and cannot send through a project integration

#### Scenario: Global channel allowlist is independent
- **WHEN** an administrator is allowlisted on a global channel but not on a project channel
- **THEN** the global permission does not grant access to the project channel

## ADDED Requirements

### Requirement: Telegram connection lifecycle and credential safety
The system SHALL verify a Telegram bot with the provider before reporting it connected, SHALL reject reusing the same bot identity across integrations or scopes, SHALL detect webhook-polling conflicts, and SHALL persist and expose a sanitized error and status when connection fails.

#### Scenario: Valid token connects with bot identity
- **WHEN** a user connects a Telegram integration with a valid bot token
- **THEN** the system verifies the bot with the provider, stores its bot identifier and username, and reports the integration as connected

#### Scenario: Invalid token never reports success
- **WHEN** a user tests or connects a Telegram integration with an invalid, revoked, or malformed token
- **THEN** the system reports the provider error, stores a sanitized last error, and does not mark the integration as connected

#### Scenario: Duplicate bot identity is rejected
- **WHEN** a user tries to configure the same Telegram bot identity in two integrations, two projects, or a project and the global scope
- **THEN** the system rejects the second configuration with HTTP `409` and explains that only one integration can poll a bot

#### Scenario: Webhook conflict is actionable
- **WHEN** a Telegram bot has an active webhook that prevents long polling
- **THEN** the system reports the conflict, offers to remove the webhook, and does not loop silently without receiving messages

#### Scenario: Token rotation reconnects the same integration
- **WHEN** a user rotates the token of an existing Telegram integration
- **THEN** the system reconnects the bot and preserves the integration identifier and all workflow references

### Requirement: Channel event catalog
The system SHALL expose a catalog of supported inbound events per channel kind and SHALL validate trigger events against it.

#### Scenario: Telegram event catalog is visible
- **WHEN** a user configures an integration-backed trigger for a Telegram channel
- **THEN** the event selector shows the events that channel emits, including `message.received`, instead of a free-text field

#### Scenario: Unknown event is rejected at save
- **WHEN** a trigger declares an event that is not in the selected channel's catalog
- **THEN** the system rejects the workflow save and lists the supported events

#### Scenario: Unmatched incoming event is recorded
- **WHEN** an incoming channel event has no matching trigger
- **THEN** the system drops it with a recorded reason that identifies the integration and event
