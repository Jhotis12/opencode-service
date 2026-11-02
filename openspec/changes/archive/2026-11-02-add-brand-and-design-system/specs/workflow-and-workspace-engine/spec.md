# Spec Delta

## ADDED Requirements

### Requirement: Readable initial canvas viewport
The canvas SHALL open at a legible zoom on desktop. When the graph is wider than the available viewport, the canvas SHALL center on the trigger at a zoom of at least 0.8 instead of auto-fitting the entire graph below that threshold, and SHALL expose an explicit fit-view action for the full overview.

#### Scenario: Graph fits at a readable zoom
- **WHEN** the user opens a workflow whose graph fits within the desktop canvas at a zoom of 0.8 or higher
- **THEN** the graph is fitted on screen and every node title remains legible

#### Scenario: Wide graph opens centered on the trigger
- **WHEN** the workflow is wider than the desktop canvas at a zoom of 0.8
- **THEN** the canvas opens centered on the trigger at 0.8, shows a fit-view action, and lets the user pan or zoom to inspect the rest

#### Scenario: User explicitly zooms out
- **WHEN** the user chooses to zoom out or use the minimap overview
- **THEN** the canvas may render below the initial threshold while the minimap continues to show the full graph

#### Scenario: Node labels stay readable at the initial view
- **WHEN** the canvas opens at 1440 x 900 with a workflow of up to ten nodes
- **THEN** each node title renders at an effective size of at least 11 px and no label is clipped by the node shape

### Requirement: Desktop project top bar
At desktop widths of 1280 px and above, the project top bar SHALL keep the breadcrumb, all primary tabs, the unsaved indicator, save, run and agent actions visible in one row. Secondary actions SHALL move to an accessible overflow menu, and tab labels SHALL NOT be clipped.

#### Scenario: All tabs remain fully readable at 1440 px
- **WHEN** the project page is rendered at 1440 px
- **THEN** Canvas, Ejecuciones, Agentes, Conocimiento, Recursos and Ajustes are fully readable without an ellipsis or a clipped label

#### Scenario: Secondary actions move to overflow
- **WHEN** the desktop top bar is rendered at 1280 px or 1440 px
- **THEN** version history and flow settings are available from an accessible overflow menu while save, run and agent remain directly reachable

#### Scenario: Active tab stays visible when the strip scrolls
- **WHEN** the tab strip must scroll because the project name or action set is wider than usual
- **THEN** the active tab is fully visible and a fade or arrow indicates that more tabs are available in the hidden direction

#### Scenario: Overflow menu is keyboard accessible
- **WHEN** the user opens the overflow menu with the keyboard
- **THEN** its items have accessible names, can be traversed with the keyboard and close with Escape

## MODIFIED Requirements

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
