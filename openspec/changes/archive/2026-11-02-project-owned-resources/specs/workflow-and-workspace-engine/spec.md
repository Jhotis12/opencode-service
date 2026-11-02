# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Bottom node inspector with last execution context
The system SHALL show the selected node's configuration in a bottom panel of the project canvas, alongside its latest execution status, input, output, logs, model, agent, and duration when available.

#### Scenario: Selecting a node opens the bottom inspector
- **WHEN** a user clicks a node on the canvas
- **THEN** the inspector opens below the canvas without replacing the canvas or requiring a side panel

#### Scenario: Inspector shows latest run context
- **WHEN** the selected node participated in the latest run
- **THEN** the inspector shows its status, duration, input, output, logs, model, and agent

#### Scenario: Closing the inspector
- **WHEN** the user closes the inspector
- **THEN** the canvas remains visible and the node selection is cleared without losing unsaved workflow edits

#### Scenario: Palette remains available
- **WHEN** the user works with the canvas
- **THEN** the node palette remains grouped by category and adding a node does not require opening a modal
