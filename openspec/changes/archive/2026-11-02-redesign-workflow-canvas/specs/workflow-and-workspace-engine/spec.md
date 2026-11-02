# Spec Delta

## REMOVED Requirements

### Requirement: Bottom node inspector with last execution context
**Reason**: The bottom inspector and the permanent palette are replaced by a full-bleed canvas with overlay modals to recover workspace space.

**Migration**: Use the node inspector modal for settings, connections and execution context, and the overlay palette modal to add nodes. The previous requirement and its scenarios are superseded by the requirements below.

## ADDED Requirements

### Requirement: Full-bleed workflow workspace
The system SHALL render the project Canvas tab as a full-bleed workspace that uses the available viewport width and height, keeping global navigation and project controls outside the canvas surface.

#### Scenario: Canvas fills the available space
- **WHEN** a user opens the Canvas tab on a desktop viewport
- **THEN** the canvas occupies all space not used by the navigation rail and project top bar, without a fixed pixel height, a max-width content container, or a permanent side palette

#### Scenario: Project actions remain reachable
- **WHEN** the full-bleed canvas is active
- **THEN** the breadcrumb, project tabs, unsaved indicator, save, run and agent actions are available from a compact top bar

#### Scenario: Non-canvas tabs stay readable
- **WHEN** the user switches to Agentes, Conocimiento, Recursos or Ajustes
- **THEN** that tab's content uses a centered readable width instead of stretching a form across the full viewport

### Requirement: Collapsible global navigation
The system SHALL let the user collapse the global navigation sidebar into an icon rail and expand it again, preserving the active section and remembering the preference.

#### Scenario: Collapsing and expanding the sidebar
- **WHEN** the user activates the navigation collapse control
- **THEN** the sidebar becomes an icon-only rail, the canvas area expands, and activating the control again restores the labeled sidebar

#### Scenario: Collapsed navigation remains accessible
- **WHEN** the navigation is collapsed
- **THEN** every destination keeps an accessible name and tooltip and remains operable by keyboard

#### Scenario: Preference survives reload
- **WHEN** the user reloads the application or returns later
- **THEN** the sidebar starts in the last state chosen by that user

#### Scenario: Narrow viewport navigation
- **WHEN** the viewport is too narrow for the labeled sidebar
- **THEN** navigation opens as an overlay drawer and closes after the user selects a destination

### Requirement: Overlay node palette
The system SHALL provide node creation through an overlay palette modal above the canvas, grouped by category and searchable, without permanently occupying canvas space.

#### Scenario: Opening the palette
- **WHEN** the user activates the add-node control on the canvas
- **THEN** a modal palette opens above the canvas with nodes grouped by category

#### Scenario: Searching the palette
- **WHEN** the user types a node name or description in the palette search field
- **THEN** the palette shows only matching nodes and an empty-state message when nothing matches

#### Scenario: Adding a node
- **WHEN** the user chooses a node type from the palette
- **THEN** the node is added to the workflow with its default configuration and the canvas remains available

#### Scenario: Unavailable trigger is explained
- **WHEN** the workflow already has a trigger node
- **THEN** the trigger option is disabled in the palette and explains that only one trigger is supported

#### Scenario: Closing the palette
- **WHEN** the user closes the palette without choosing a node
- **THEN** the canvas and the current selection remain unchanged

### Requirement: Node inspector modal with execution context
The system SHALL open the selected node's settings in an overlay modal with Settings, Connections and Execution tabs, and SHALL preserve unsaved canvas edits when the modal closes.

#### Scenario: Clicking a node opens the inspector
- **WHEN** the user clicks a node without dragging it
- **THEN** the node inspector modal opens for that node with its settings

#### Scenario: Dragging does not open the inspector
- **WHEN** the user drags a node to a new position
- **THEN** the node moves and the inspector modal does not open

#### Scenario: Inspector tabs expose the available context
- **WHEN** the inspector is open
- **THEN** Settings shows the existing per-type configuration, Connections shows the node's incoming and outgoing edges, and Execution shows the latest run status, duration, input, output, logs, model and agent when available

#### Scenario: Closing preserves unsaved edits
- **WHEN** the user closes the inspector
- **THEN** the node selection is cleared, the canvas remains visible, and any unsaved workflow edits remain in the editor

#### Scenario: Unsupported trigger remains explainable
- **WHEN** the user opens a workflow saved with an unsupported trigger kind
- **THEN** the inspector identifies the type as unavailable and explains how to switch to a manual or integration trigger

### Requirement: Type-specific node shapes
The system SHALL render each workflow node type with a distinct silhouette while keeping its icon, color, label, type name, subtitle and live status legible and its connection handles usable.

#### Scenario: Node types are visually distinct
- **WHEN** a workflow contains trigger, http, code, transform, delay, validate, agent, decision and approval nodes
- **THEN** each type renders with a visibly different shape rather than the same rectangular card

#### Scenario: Selection and run status remain visible
- **WHEN** a node is selected or reports a running, succeeded or failed status
- **THEN** the selection outline and status indicator remain visible and are not clipped by the node shape

#### Scenario: Handles remain reachable
- **WHEN** the user interacts with a shaped node's connection handles
- **THEN** every handle is visible on hover or selection and remains operable without being covered by the node silhouette

### Requirement: Click-based connection editing
The system SHALL allow a user to create or replace an outgoing connection by selecting a source node, choosing a target from valid candidates, and confirming, without requiring a drag from a handle.

#### Scenario: Connecting a regular node
- **WHEN** the user chooses Connect for a non-decision node and selects a valid target
- **THEN** an outgoing edge is created from the source to the target

#### Scenario: Replacing an existing outgoing edge
- **WHEN** a non-decision source already has an outgoing edge and the user connects it to another target
- **THEN** the existing edge is replaced after the user confirms the replacement

#### Scenario: Connecting a decision branch
- **WHEN** the user chooses Connect on a decision node
- **THEN** the user must choose the true or false branch before choosing the target

#### Scenario: Merging branches
- **WHEN** two different sources point to the same target
- **THEN** both incoming edges are kept and shown in the target's Connections tab

#### Scenario: Cancelling a connection
- **WHEN** the user cancels a pending connection
- **THEN** the workflow remains unchanged

### Requirement: Connection validation guidance
The system SHALL evaluate each proposed connection against the existing workflow graph contract and SHALL disable or reject invalid targets with a user-facing reason before save.

#### Scenario: Invalid target is disabled
- **WHEN** a proposed target would create a self-loop, a cycle, a second trigger, an edge into the trigger, or a second outgoing edge on a non-decision node
- **THEN** the target is unavailable and the interface explains why

#### Scenario: Decision requires both branches
- **WHEN** a decision node has fewer than two outgoing edges or lacks either the true or false condition
- **THEN** the editor marks the decision as incomplete before the workflow is saved

#### Scenario: Unreachable nodes are reported
- **WHEN** a node cannot be reached from the trigger
- **THEN** the editor identifies that node as disconnected from the flow

#### Scenario: Server validation is surfaced
- **WHEN** saving a workflow is rejected by the server
- **THEN** the returned validation issues are shown with the affected node or edge instead of a generic save failure

### Requirement: Persistent node and edge manipulation
The system SHALL persist node deletion, node duplication, edge deletion and decision edge condition changes through the existing workflow save contract.

#### Scenario: Keyboard deletion persists
- **WHEN** the user deletes a selected node with the keyboard and saves the workflow
- **THEN** the node and its connected edges remain deleted after reload

#### Scenario: Duplicating a node
- **WHEN** the user duplicates a node
- **THEN** a distinct node with a new identifier and copied configuration is added to the canvas, and a duplicated code node receives its own code file

#### Scenario: Deleting an edge
- **WHEN** the user selects an edge and deletes it
- **THEN** the edge is removed from the canvas and remains removed after save and reload

#### Scenario: Changing a decision condition
- **WHEN** the user changes a decision edge between true and false
- **THEN** the new condition is persisted with the edge and the decision's two branches remain distinguishable
