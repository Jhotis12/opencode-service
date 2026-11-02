# Spec Delta

## ADDED Requirements

### Requirement: Agent catalog cards
The project Agentes tab SHALL present agents as a catalog of cards showing category/role, localized mode, description, model, notebook summary and permission summary. The primary agent SHALL be visually emphasized and listed first.

#### Scenario: Primary agent is emphasized and protected
- **WHEN** the agent catalog renders the project primary agent
- **THEN** its card appears first with a distinct accent and a `Principal` label, exposes edit but not delete, and remains independently editable

#### Scenario: Sub-agent cards summarize their configuration
- **WHEN** the catalog renders a sub-agent
- **THEN** its card shows the localized mode, description, inherited or explicit model, notebook count or names and denied-tool count, with edit and delete actions

#### Scenario: Empty sub-agent catalog explains the next action
- **WHEN** the project has no sub-agents
- **THEN** the tab shows a concise empty state with a primary action to create the first sub-agent

#### Scenario: Long values do not break the card
- **WHEN** an agent path, model or notebook name is longer than its card container
- **THEN** the value truncates with an accessible full-value title without changing the card height

### Requirement: Focused agent editor
Creating and editing agents SHALL use a focused modal or side editor with grouped fields, validation and a single save action. The Agentes tab SHALL NOT end in a permanent long inline form.

#### Scenario: Creating a new agent
- **WHEN** the user activates the new-agent action
- **THEN** a focused editor opens with empty fields, required-field validation and a disabled save action until the minimum fields are complete

#### Scenario: Editing an existing agent
- **WHEN** the user chooses edit on an agent card
- **THEN** the focused editor opens with the agent's current values and saving updates the corresponding card without leaving the tab

#### Scenario: Discarding edits
- **WHEN** the user cancels or closes the editor without saving
- **THEN** the catalog remains unchanged and focus returns to the action that opened the editor

#### Scenario: Destructive deletion requires confirmation
- **WHEN** the user chooses delete on a sub-agent
- **THEN** the interface asks for explicit confirmation before removing the agent and reports the result in the catalog
