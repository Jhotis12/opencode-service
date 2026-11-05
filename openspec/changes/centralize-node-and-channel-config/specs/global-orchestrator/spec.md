# Spec Delta

## MODIFIED Requirements

### Requirement: Global channels configured in platform settings
The system SHALL allow administrators to create, edit, test, connect, disconnect, and remove global integrations for the orchestrator with the same configuration contract and editor as project channels, with scope `global`, independent from project channels.

#### Scenario: Configuring a Telegram channel for the orchestrator
- **WHEN** an administrator creates a Telegram integration in the global channel settings
- **THEN** the integration is available only to the orchestrator, and project channel lists do not show it

#### Scenario: Editing a global channel preserves references
- **WHEN** an administrator changes a global channel's token, allowlist, routing, or alert preferences
- **THEN** the integration keeps its identifier and global alert subscriptions continue to work without being recreated

#### Scenario: Testing a global channel
- **WHEN** an administrator sends a test message from the global channel settings
- **THEN** the system verifies the channel with its provider, delivers the test through the selected global integration, and reports the real result in the UI

#### Scenario: Global channel access control
- **WHEN** a sender not present in the global channel allowlist messages the orchestrator
- **THEN** the system drops or rejects the message according to the configured policy and records the decision

#### Scenario: Global and project channels cannot share a bot identity
- **WHEN** an administrator configures the same Telegram bot in a global channel and a project channel
- **THEN** the system rejects the second configuration with HTTP `409` and leaves both scopes independently manageable

#### Scenario: Global channel failure is visible in settings
- **WHEN** a global channel cannot connect, loses its connection, or cannot deliver an alert
- **THEN** its status and sanitized last error are visible in the platform settings and in health
