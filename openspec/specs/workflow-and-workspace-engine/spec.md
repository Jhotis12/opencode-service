# workflow-and-workspace-engine Specification

## Purpose

Gestiona los proyectos/automatizaciones basados en directorios reales en disco, la edición bidireccional entre el chat de OpenCode y el canvas visual en React Flow, y la ejecución resiliente de nodos de código y nodos de agente con checkpointing e idempotencia.

## Requirements

### Requirement: Disk-backed project workspaces
The system SHALL store each project/automation in a dedicated directory under `/data/workspaces/<project-slug>/` containing `opencode.jsonc`, `workflow.json`, `nodes/*.ts`, `AGENTS.md`, a primary agent profile, and a project-owned `knowledge/` area.

#### Scenario: Creating a new automation project
- **WHEN** a user or the primary agent creates a project with slug `facturacion-diaria`
- **THEN** the system scaffolds `/data/workspaces/facturacion-diaria/` with a valid `opencode.jsonc` that selects the project primary agent, an initial `workflow.json`, a `nodes/` directory, `AGENTS.md`, the primary agent profile, and a `knowledge/` directory

#### Scenario: Preventing path traversal outside workspace root
- **WHEN** a request or tool attempts to read, write, or delete a path resolving outside `/data/workspaces/<project-slug>/` after symlink resolution
- **THEN** the system rejects the operation with HTTP `403 FORBIDDEN_PATH` and logs the blocked target

#### Scenario: Knowledge stays inside the project
- **WHEN** a project ingests a source or reads knowledge files
- **THEN** every file is resolved under that project's `knowledge/` directory and a path escaping it is rejected

### Requirement: Bidirectional synchronization between Chat and Visual Canvas
The system SHALL synchronize changes to `workflow.json` and `nodes/*.ts` in real time between the OpenCode agent session and the React Flow canvas over Server-Sent Events (SSE).

#### Scenario: Agent creates or updates nodes from chat
- **WHEN** the OpenCode agent modifies `workflow.json` or creates `nodes/01-fetch.ts` during a chat turn
- **THEN** the backend validates the schema, broadcasts a `workflow.updated` SSE event, and updates the React Flow canvas without page reload

#### Scenario: User edits nodes or code in the visual canvas
- **WHEN** a user moves nodes, edits edges, or modifies node TypeScript code in the web UI and saves
- **THEN** the system persists the changes to `workflow.json` and `nodes/*.ts` so the OpenCode agent reads the updated state on its next turn

### Requirement: Isolated execution of TypeScript code nodes
The system SHALL execute `code` nodes inside isolated Bun worker processes with configurable timeouts and a typed runtime context (`ctx.db`, `ctx.http`, `ctx.notify`, `ctx.env`) that resolves project-scoped integrations and never exposes raw secrets to the worker.

#### Scenario: Code node completes within timeout
- **WHEN** a `code` node runs and returns a JSON-serializable output before `timeoutMs`
- **THEN** the engine records the step output, duration, and `SUCCEEDED` status and passes the payload to downstream nodes

#### Scenario: Code node exceeds execution timeout
- **WHEN** a `code` node runs longer than its configured `timeoutMs`
- **THEN** the worker terminates the execution via `AbortSignal`, records `TIMED_OUT` on the step run, and halts or routes to the error branch

#### Scenario: Code node resolves a project integration
- **WHEN** a `code` node calls `ctx.db` or `ctx.notify` with an integration owned by its project
- **THEN** the runtime resolves the integration and credential in the server process and returns only the result to the worker

#### Scenario: Code node cannot resolve a sibling integration
- **WHEN** a `code` node references an integration owned by another project or a global integration not available to the project
- **THEN** the runtime rejects the call and records the attempted integration and scope without exposing credentials

### Requirement: Step-level checkpointing, idempotency, and partial replay
The system SHALL persist input, output, status, model metadata, and timing for every node execution and honour atomic idempotency keys for workflow triggers.

#### Scenario: Duplicate trigger with the same Idempotency-Key and payload
- **WHEN** a workflow trigger receives a duplicate `Idempotency-Key` with an identical payload hash
- **THEN** the system atomically claims the key via a unique constraint and returns the existing execution run or `409 Conflict` while in flight

#### Scenario: Replaying a failed run from the failed step
- **WHEN** a user or the orchestrator agent requests a replay of a failed execution from step `N`
- **THEN** the engine loads the checkpointed outputs of steps `1..N-1` and resumes execution starting at step `N`

### Requirement: Extended node catalog (HTTP, delay, transform, visual condition)
The system SHALL execute `http`, `delay`, `transform` and visual-condition nodes in addition to trigger, code, agent and approval, validating each node's required configuration before a run.

#### Scenario: HTTP node executes and exposes its response
- **WHEN** an `http` node with a valid URL and method runs
- **THEN** the engine performs the request within the node timeout and stores the response body as the step output

#### Scenario: Delay node preserves the payload
- **WHEN** a `delay` node with `config.ms` runs
- **THEN** the engine waits up to 60 seconds and passes the input payload unchanged to the next node

#### Scenario: Transform node interpolates input
- **WHEN** a `transform` node uses a template such as `{"name":"{{input.name}}"}`
- **THEN** the engine renders the template with the resolved input values and returns the parsed JSON object

#### Scenario: Visual condition branches without code
- **WHEN** a `decision` node uses `config.condition` with `field`, `operator` and `value`
- **THEN** the engine evaluates the condition and follows the `true` or `false` outgoing edge without requiring a code file

### Requirement: Run trace with per-step inputs, outputs, logs and agent attribution
The system SHALL persist each step's input, output, logs, model, agentId, duration and status, expose a run detail endpoint and UI, and allow replay from any selected step.

#### Scenario: Sub-agent response is visible in the run detail
- **WHEN** an `agent` node completes inside a run
- **THEN** the run detail shows the sub-agent identifier, model, timing, input, output and worker logs for that step

#### Scenario: Replay from an arbitrary step
- **WHEN** a user selects “Re-ejecutar desde aquí” on a step
- **THEN** the engine replays the run starting at that node using the stored upstream outputs

### Requirement: Live node execution status on the canvas
The system SHALL emit run events over SSE and reflect running, succeeded and failed states per node on the visual canvas.

#### Scenario: Node changes state during execution
- **WHEN** a workflow starts and each node begins or finishes
- **THEN** the canvas highlights the running node and then shows its succeeded or failed status without a page reload

### Requirement: Integration-backed triggers
The system SHALL allow trigger nodes to reference a project integration and an event, and SHALL reject triggers that reference a missing, disconnected, or cross-project integration before execution.

#### Scenario: Telegram trigger references a project integration
- **WHEN** a trigger node declares the Telegram integration owned by its project and the `message.received` event
- **THEN** an incoming message on that integration starts this workflow and the run records the integration as its origin

#### Scenario: Missing integration is rejected before execution
- **WHEN** a workflow trigger references an integration that no longer exists or is disconnected
- **THEN** the system fails validation or the run before executing any node and identifies the unavailable integration

#### Scenario: Duplicate integration trigger is rejected
- **WHEN** two triggers in the same project declare the same integration and event
- **THEN** the system rejects the workflow with a clear validation error

#### Scenario: Manual trigger does not require an integration
- **WHEN** a trigger declares the manual kind
- **THEN** the workflow can be launched from the canvas or API without an integration reference

### Requirement: Manual run input contract
The system SHALL allow a trigger to declare an input schema with fields, types, required flags, descriptions, and examples, and SHALL validate every run payload against that schema before creating any step, regardless of the entry point.

#### Scenario: Manual launch with valid input
- **WHEN** a user launches a manual workflow with all required fields present and valid
- **THEN** the run is accepted and the input is stored with the run

#### Scenario: Missing required field is rejected before execution
- **WHEN** a user launches a manual workflow without the required `tema` field
- **THEN** the system responds with HTTP `422`, identifies `tema` as missing, and does not execute the trigger or any downstream node

#### Scenario: Channel and API inputs are validated too
- **WHEN** a Telegram, WhatsApp, email, or external application payload reaches a workflow with an input schema
- **THEN** the same validation applies and an invalid payload fails before the first step with a user-facing explanation

#### Scenario: Input schema documents the expected data
- **WHEN** a user opens the manual launch form
- **THEN** the form shows the declared fields, required markers, descriptions, and examples instead of a raw untyped payload

### Requirement: Validate node
The system SHALL support a `validate` node that checks declared rules against its input and fails the step with a user-facing message when a rule is not met.

#### Scenario: Required field is missing at the validate node
- **WHEN** a `validate` node requires `tema` and the input does not contain it
- **THEN** the step is marked failed with the configured message and downstream nodes do not execute

#### Scenario: Valid input passes through
- **WHEN** all rules of a `validate` node are satisfied
- **THEN** the step succeeds and passes its input unchanged to the next node

#### Scenario: Multiple rules report the first actionable failure
- **WHEN** a `validate` node declares several rules and more than one fails
- **THEN** the system reports an actionable failure that identifies the field and rule without exposing internal paths

### Requirement: Run provenance and immediate identifier
The system SHALL return a stable run identifier when a run is accepted and SHALL persist the initiating user or sender, entry point, source integration, and workflow graph version or hash for every run.

#### Scenario: Manual launch returns the identifier immediately
- **WHEN** a user starts a manual workflow
- **THEN** the system accepts the run, returns a stable `runId` before the workflow finishes, and streams subsequent status updates

#### Scenario: Channel run records its origin
- **WHEN** a workflow starts from a Telegram, WhatsApp, email, or external application integration
- **THEN** the run records the integration, external sender or thread, and entry point

#### Scenario: Replay preserves provenance
- **WHEN** a user replays a run
- **THEN** the new execution records the replay entry point and the user who requested it while retaining the original run as the source

#### Scenario: Run detail shows who and from where
- **WHEN** a user opens the run detail
- **THEN** the UI shows the run identifier, initiator, project, workflow, source, and graph version or hash

### Requirement: Single executable trigger per workflow
The system SHALL require exactly one trigger node per workflow and SHALL reject trigger kinds that do not have an active executor, so the canvas cannot create entry points that will never run.

#### Scenario: Second trigger is rejected
- **WHEN** a workflow already has a trigger and another trigger is added or saved
- **THEN** the system rejects the change with a validation error explaining that only one trigger is supported

#### Scenario: Unimplemented trigger kind is rejected
- **WHEN** a workflow uses `schedule` or `webhook` as its trigger kind before those executors exist
- **THEN** the system rejects the save with a clear message instead of storing a non-executable entry point

#### Scenario: Integration trigger requires an integration
- **WHEN** a trigger uses the integration kind
- **THEN** the system requires a project integration identifier and an event before the workflow can be saved

#### Scenario: Existing unsupported trigger is visible in the inspector
- **WHEN** a user opens a workflow saved with an unsupported trigger kind
- **THEN** the inspector shows the type as unavailable and explains how to switch to a manual or integration trigger

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
