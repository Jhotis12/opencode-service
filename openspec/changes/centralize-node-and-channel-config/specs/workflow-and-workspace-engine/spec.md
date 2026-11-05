# Spec Delta

## MODIFIED Requirements

### Requirement: Integration-backed triggers
The system SHALL allow trigger nodes to reference a project integration and a supported event, and SHALL reject triggers whose kind is not integration, whose integration is not an inbound channel, whose event is not supported, or whose integration is missing, disconnected, or cross-project, before execution.

#### Scenario: Telegram trigger references a project integration
- **WHEN** a trigger node declares the Telegram integration owned by its project and the `message.received` event
- **THEN** an incoming message on that integration starts this workflow and the run records the integration as its origin

#### Scenario: Missing integration is rejected before execution
- **WHEN** a workflow trigger references an integration that no longer exists or is disconnected
- **THEN** the system fails validation or the run before executing any node and identifies the unavailable integration

#### Scenario: Non-channel integration is rejected before execution
- **WHEN** a workflow trigger references an integration that does not support inbound messages
- **THEN** the system fails validation before executing any node and identifies the missing inbound capability

#### Scenario: Duplicate integration trigger is rejected
- **WHEN** two triggers in the same project declare the same integration and event
- **THEN** the system rejects the workflow with a clear validation error

#### Scenario: Manual trigger does not require an integration
- **WHEN** a trigger declares the manual kind
- **THEN** the workflow can be launched from the canvas or API without an integration reference

#### Scenario: Manual trigger with stale integration does not receive messages
- **WHEN** a trigger was changed from integration to manual and still carries a previous `integrationId`
- **THEN** the system removes the stale reference on save and an incoming channel message does not start that workflow

#### Scenario: Non-channel integration cannot be selected as a trigger
- **WHEN** a user opens the trigger integration selector
- **THEN** only project integrations with inbound-message capability are selectable, and a database, HTTP, or transcription integration is rejected at save

#### Scenario: Unsupported event is rejected
- **WHEN** a trigger declares an event that the selected channel does not emit
- **THEN** the system rejects the save with the list of supported events instead of accepting a trigger that would silently drop messages

### Requirement: Node inspector modal with execution context
The system SHALL open the selected node's settings in an overlay modal with Settings, Connections and Execution tabs, render Settings from the shared node configuration contract with guided fields, defaults and validation, and SHALL preserve unsaved canvas edits when the modal closes.

#### Scenario: Clicking a node opens the inspector
- **WHEN** the user clicks a node without dragging it
- **THEN** the node inspector modal opens for that node with its settings

#### Scenario: Dragging does not open the inspector
- **WHEN** the user drags a node to a new position
- **THEN** the node moves and the inspector modal does not open

#### Scenario: Inspector tabs expose the available context
- **WHEN** the inspector is open
- **THEN** Settings shows the per-type guided configuration (including cron/webhook settings on triggers and `outputSchema` fields on agent nodes), Connections shows the node's incoming and outgoing edges, and Execution shows the latest run status, duration, input, output, logs, model and agent when available

#### Scenario: Closing preserves unsaved edits
- **WHEN** the user closes the inspector
- **THEN** the node selection is cleared, the canvas remains visible, and any unsaved workflow edits remain in the editor

#### Scenario: Unsupported trigger remains explainable
- **WHEN** the user opens a workflow saved with an unsupported trigger kind
- **THEN** the inspector identifies the type as unavailable and explains how to switch to a supported trigger

#### Scenario: Changing trigger kind resets incompatible fields
- **WHEN** the user changes a trigger from integration to manual, schedule, or webhook, or changes an integration kind
- **THEN** the inspector removes keys that belong only to the previous kind instead of leaving stale configuration

#### Scenario: Invalid guided configuration blocks save
- **WHEN** a required node field is missing or has an invalid value
- **THEN** the inspector shows the field error and the workflow save is rejected before persisting

## ADDED Requirements

### Requirement: Typed node configuration contract
The system SHALL define each node type with a shared configuration schema, defaults, and field metadata, and SHALL use it to render the inspector and validate node configuration at save and before execution.

#### Scenario: New node field appears in inspector and validation
- **WHEN** a field is added to a node type's configuration contract
- **THEN** the inspector renders it and the server validates it from the same definition without a separate hand-written form or validator

#### Scenario: Defaults apply when adding a node
- **WHEN** a user adds a node from the palette
- **THEN** the node is created with the contract's defaults and required fields instead of an empty configuration that can only fail later

#### Scenario: Invalid node configuration is rejected before run
- **WHEN** a workflow node configuration violates its schema
- **THEN** the system rejects the workflow save or the run before executing any step and identifies the node and field

#### Scenario: Advanced node JSON is validated
- **WHEN** a user edits a node through advanced JSON
- **THEN** the system validates it against the same node contract and rejects secret-like values that are not declared secret fields
