# Spec Delta

## ADDED Requirements

### Requirement: Scheduled and webhook workflow triggers
The system SHALL execute workflows configured with a `schedule` trigger on their declared cron schedule with per-window idempotency, and SHALL execute workflows configured with a `webhook` trigger when a signed or secret-authenticated HTTP request arrives at the project's webhook endpoint.

#### Scenario: Scheduled workflow runs on matching cron tick
- **WHEN** a workflow's trigger has `kind: "schedule"` and a valid `cron` expression matching the current minute window
- **THEN** the scheduler starts at most one run for that window using a deterministic idempotency key and records `entryPoint: "schedule"`

#### Scenario: Webhook trigger starts a run with valid secret or signature
- **WHEN** an external caller sends `POST /api/v1/webhooks/:projectSlug/:nodeId` with a valid webhook secret header or HMAC signature and payload matching `inputSchema`
- **THEN** the system starts the workflow run with `entryPoint: "webhook"`, returns HTTP `202` with `runId`, and records the webhook origin

#### Scenario: Webhook trigger rejects invalid secret or signature
- **WHEN** an external caller sends a request to the webhook endpoint with a missing or invalid secret or signature
- **THEN** the system rejects the request with HTTP `401` and does not create a workflow run

### Requirement: Workflow graph snapshots, version history, and rollback
The system SHALL persist an immutable version snapshot of the workflow graph and its referenced code files whenever a workflow is saved or executed, bind every run to its snapshot, and allow listing versions and rolling back a project's workspace to a prior version.

#### Scenario: Saving a workflow records a new version snapshot
- **WHEN** a user or agent saves a valid workflow graph
- **THEN** the system stores an immutable version entry containing the graph JSON, `graphHash`, and referenced `nodes/*.ts` contents

#### Scenario: Replay and approval resume use the run's original snapshot
- **WHEN** a workflow is edited on disk after a run has started or paused at an approval node, and the run is later replayed or approved
- **THEN** the engine executes using the immutable graph and code snapshot recorded when that run started rather than the mutated workspace files

#### Scenario: Rolling back to a previous workflow version
- **WHEN** a user selects a previous version from the project version history and confirms rollback
- **THEN** the system restores `workflow.json` and the snapshot's `nodes/*.ts` files to disk, records the rollback version, and broadcasts `workflow.updated`

### Requirement: Structured JSON output contract for agent nodes
The system SHALL allow an `agent` node to declare an `outputSchema`, instruct the agent to respond with matching JSON, validate the parsed output against that schema with one automatic repair retry on failure, and pass the validated JSON object to downstream nodes.

#### Scenario: Agent node returns valid structured JSON
- **WHEN** an `agent` node with `config.outputSchema` runs and the agent returns JSON matching all required fields and types
- **THEN** the engine stores the parsed JSON object as the step output and passes it as a structured object to the next node

#### Scenario: Agent node repairs malformed or non-conforming JSON once
- **WHEN** an `agent` node with `config.outputSchema` receives text that is not valid JSON or misses a required field on the first turn
- **THEN** the engine sends one repair prompt with the validation issues and succeeds if the repaired response conforms to `outputSchema`

#### Scenario: Agent node fails when structured output still violates schema
- **WHEN** the agent response still fails `outputSchema` validation after the repair retry
- **THEN** the step is marked `failed` with an actionable schema validation error and downstream nodes do not execute

### Requirement: Vertical workflow project template
The system SHALL allow creating a new project from a built-in vertical template that scaffolds a complete end-to-end operational workflow, specialized sub-agent profile with structured output and scoped tool permissions, and node code files.

#### Scenario: Creating a project from the operational triage vertical template
- **WHEN** a user creates a project and selects the `triaje-operativo` template
- **THEN** the system scaffolds the project with a ready-to-run workflow (trigger with `inputSchema`, `validate`, `agent` with `outputSchema`, `decision`, `approval`, and `code` nodes), the corresponding sub-agent Markdown profile, and an initial version snapshot

## MODIFIED Requirements

### Requirement: Step-level checkpointing, idempotency, and partial replay
The system SHALL persist input, output, status, model metadata, and timing for every node execution, honour atomic idempotency keys for workflow triggers, and recover runs interrupted in `running` state upon server startup.

#### Scenario: Duplicate trigger with the same Idempotency-Key and payload
- **WHEN** a workflow trigger receives a duplicate `Idempotency-Key` with an identical payload hash
- **THEN** the system atomically claims the key via a unique constraint and returns the existing execution run or `409 Conflict` while in flight

#### Scenario: Replaying a failed run from the failed step
- **WHEN** a user or the orchestrator agent requests a replay of a failed execution from step `N`
- **THEN** the engine loads the checkpointed outputs of steps `1..N-1` and resumes execution starting at step `N` using the run's stored workflow snapshot

#### Scenario: Recovering interrupted running executions on startup
- **WHEN** the server starts and finds workflow runs left in `running` status from a prior process
- **THEN** the engine loads each run's stored snapshot and succeeded step checkpoints and resumes execution from the first unfinished node (or marks the run `failed` if its snapshot cannot be resolved)

### Requirement: Single executable trigger per workflow
The system SHALL require exactly one trigger node per workflow and SHALL validate the required configuration for `manual`, `integration`, `schedule`, and `webhook` trigger kinds before saving or executing, while rejecting any unknown trigger kind that does not have an active executor.

#### Scenario: Second trigger is rejected
- **WHEN** a workflow already has a trigger and another trigger is added or saved
- **THEN** the system rejects the change with a validation error explaining that only one trigger is supported

#### Scenario: Unimplemented trigger kind is rejected
- **WHEN** a workflow uses an unknown trigger kind that has no active executor
- **THEN** the system rejects the save with a clear message instead of storing a non-executable entry point

#### Scenario: Schedule trigger requires a valid cron expression
- **WHEN** a trigger uses the `schedule` kind without a valid 5-field `config.cron` expression
- **THEN** the system rejects the save with a clear validation message identifying the invalid cron schedule

#### Scenario: Webhook trigger requires a secret alias or token configuration
- **WHEN** a trigger uses the `webhook` kind without a configured secret alias or token
- **THEN** the system rejects the save with a validation error explaining that a webhook secret alias is required

#### Scenario: Integration trigger requires an integration
- **WHEN** a trigger uses the integration kind
- **THEN** the system requires a project integration identifier and an event before the workflow can be saved

#### Scenario: Existing unsupported trigger is visible in the inspector
- **WHEN** a user opens a workflow saved with an unsupported trigger kind
- **THEN** the inspector shows the type as unavailable and explains how to switch to a supported trigger

### Requirement: Node inspector modal with execution context
The system SHALL open the selected node's settings in an overlay modal with Settings, Connections and Execution tabs, including configuration for schedule/webhook triggers and structured agent output schemas, and SHALL preserve unsaved canvas edits when the modal closes.

#### Scenario: Clicking a node opens the inspector
- **WHEN** the user clicks a node without dragging it
- **THEN** the node inspector modal opens for that node with its settings

#### Scenario: Dragging does not open the inspector
- **WHEN** the user drags a node to a new position
- **THEN** the node moves and the inspector modal does not open

#### Scenario: Inspector tabs expose the available context
- **WHEN** the inspector is open
- **THEN** Settings shows the per-type configuration (including cron/webhook settings on triggers and `outputSchema` fields on agent nodes), Connections shows the node's incoming and outgoing edges, and Execution shows the latest run status, duration, input, output, logs, model and agent when available

#### Scenario: Closing preserves unsaved edits
- **WHEN** the user closes the inspector
- **THEN** the node selection is cleared, the canvas remains visible, and any unsaved workflow edits remain in the editor

#### Scenario: Unsupported trigger remains explainable
- **WHEN** a user opens a workflow saved with an unsupported trigger kind
- **THEN** the inspector identifies the type as unavailable and explains how to switch to a supported trigger
