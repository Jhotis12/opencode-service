# Spec Delta

## Purpose

Gestiona los proyectos/automatizaciones basados en directorios reales en disco, la edición bidireccional entre el chat de OpenCode y el canvas visual en React Flow, y la ejecución resiliente de nodos de código y nodos de agente con checkpointing e idempotencia.

## ADDED Requirements

### Requirement: Disk-backed project workspaces
The system SHALL store each project/automation in a dedicated directory under `/data/workspaces/<project-slug>/` containing `opencode.jsonc`, `workflow.json`, and `nodes/*.ts`.

#### Scenario: Creating a new automation project
- **WHEN** a user or the primary agent creates a project with slug `facturacion-diaria`
- **THEN** the system scaffolds `/data/workspaces/facturacion-diaria/` with a valid `opencode.jsonc`, an initial `workflow.json`, and a `nodes/` directory

#### Scenario: Preventing path traversal outside workspace root
- **WHEN** a request or tool attempts to read, write, or delete a path resolving outside `/data/workspaces/<project-slug>/` after symlink resolution
- **THEN** the system rejects the operation with HTTP `403 FORBIDDEN_PATH` and logs the blocked target

### Requirement: Bidirectional synchronization between Chat and Visual Canvas
The system SHALL synchronize changes to `workflow.json` and `nodes/*.ts` in real time between the OpenCode agent session and the React Flow canvas over Server-Sent Events (SSE).

#### Scenario: Agent creates or updates nodes from chat
- **WHEN** the OpenCode agent modifies `workflow.json` or creates `nodes/01-fetch.ts` during a chat turn
- **THEN** the backend validates the schema, broadcasts a `workflow.updated` SSE event, and updates the React Flow canvas without page reload

#### Scenario: User edits nodes or code in the visual canvas
- **WHEN** a user moves nodes, edits edges, or modifies node TypeScript code in the web UI and saves
- **THEN** the system persists the changes to `workflow.json` and `nodes/*.ts` so the OpenCode agent reads the updated state on its next turn

### Requirement: Isolated execution of TypeScript code nodes
The system SHALL execute `code` nodes inside isolated Bun worker processes with configurable timeouts and a typed runtime context (`ctx.db`, `ctx.http`, `ctx.notify`, `ctx.env`).

#### Scenario: Code node completes within timeout
- **WHEN** a `code` node runs and returns a JSON-serializable output before `timeoutMs`
- **THEN** the engine records the step output, duration, and `SUCCEEDED` status and passes the payload to downstream nodes

#### Scenario: Code node exceeds execution timeout
- **WHEN** a `code` node runs longer than its configured `timeoutMs`
- **THEN** the worker terminates the execution via `AbortSignal`, records `TIMED_OUT` on the step run, and halts or routes to the error branch

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
