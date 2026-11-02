# multi-agent-catalog Specification

## Purpose

Permite definir, organizar y ejecutar equipos de sub-agentes por categorías y roles basados en archivos Markdown (`.opencode/agents/<categoria>/<rol>.md`), seleccionar modelos por flujo o nodo (incluyendo `opencode-go`), gestionar servidores MCP por proyecto y exponer herramientas nativas `platform_*` a OpenCode V2.

## Requirements

### Requirement: Categorized Markdown sub-agent definitions
The system SHALL manage custom agents and sub-agents as Markdown files under `.opencode/agents/<category>/<role>.md` with YAML frontmatter (`description`, `mode`, `model`, `color`, `permissions`, `steps`) and system instructions in the Markdown body.

#### Scenario: Primary agent creates a category of sub-agents from user instructions
- **WHEN** the user instructs the primary agent in chat to build an agentic workflow with specialized roles (e.g., `ventas/calificador` and `ventas/cotizador`)
- **THEN** the system writes `.opencode/agents/ventas/calificador.md` and `.opencode/agents/ventas/cotizador.md`, reloads the project location in OpenCode V2, and links them as Agent Nodes in `workflow.json`

#### Scenario: Editing a sub-agent Markdown profile from the UI
- **WHEN** a user edits a sub-agent's instructions, model, or permissions in the UI and saves
- **THEN** the system updates the corresponding `.opencode/agents/<category>/<role>.md` file and triggers an OpenCode location reload

#### Scenario: Sub-agents stay inside their project
- **WHEN** a project location lists or invokes its sub-agents
- **THEN** only `.opencode/agents/**` under that project's directory is visible; sibling projects' sub-agents are not exposed

### Requirement: Per-workflow and per-node model and agent selection
The system SHALL allow selecting a specific provider and model (`providerID/modelID#variant`, including `opencode-go` models) and agent profile for each workflow and each individual `agent` or `decision` node.

#### Scenario: Executing two agent nodes with different models in the same workflow
- **WHEN** Node A is configured with `opencode-go/<fast-model>` and Node B is configured with `opencode-go/<reasoning-model>`
- **THEN** the workflow runner switches or scopes the session model accordingly before executing each node and records the exact model used in the step checkpoint

### Requirement: Native OpenCode platform plugin tools (`platform_*`)
The system SHALL register a server plugin in OpenCode V2 providing `platform_*` tools with explicit project, agent, and execution-context scope, so project agents can inspect and mutate only permitted resources in their own project while the global orchestrator can inspect all projects in read-only mode.

#### Scenario: Asking the global orchestrator for workflow status
- **WHEN** the user asks the orchestrator how a specific workflow is performing
- **THEN** the agent invokes the global run tool and returns the latest execution status, duration, and any step errors

#### Scenario: Project agent lists only its project
- **WHEN** a project agent invokes a workflow, knowledge, integration, or run tool
- **THEN** the tool resolves the project from the authenticated project scope and returns only that project's data

#### Scenario: Project agent cannot call a global tool
- **WHEN** a project-scoped agent invokes a tool that requires global scope
- **THEN** the plugin call is rejected with HTTP `403` and the scope violation is audited

#### Scenario: Global tools are read-only by default
- **WHEN** the global orchestrator invokes a tool that would mutate a project, run, integration, or notebook
- **THEN** the tool is unavailable or requires an explicit administrator confirmation and is recorded in the audit trail

### Requirement: Per-agent and execution-context tool permission enforcement
The system SHALL enforce each agent profile's `permissions` rules (`allow`/`deny`) and execution-context restrictions on `platform_*` tool calls, denying workflow and sub-agent design mutations during workflow step execution or untrusted external channel turns unless explicitly allowed.

#### Scenario: Sub-agent inside a workflow step is blocked from mutating the workflow
- **WHEN** an `agent` node executes during a workflow run and attempts to call `workflow_upsert` or `subagent_upsert` without an explicit `allow` permission
- **THEN** the server rejects the tool call with HTTP `403`, logs the denied tool and agent identifier, and does not modify the project

#### Scenario: Agent with a deny rule on database or notification tools is blocked
- **WHEN** an agent whose frontmatter `permissions` includes a `deny` rule for `db_query` or `notify` invokes that tool
- **THEN** the platform rejects the call with HTTP `403` and records the permission violation

#### Scenario: Primary agent in authenticated web chat retains design capabilities
- **WHEN** an administrator interacts with the project's `primary` agent in the web chat and no `deny` rule blocks `workflow_upsert` or `subagent_upsert`
- **THEN** the primary agent can create and update workflows and sub-agents for that project

### Requirement: Project-scoped MCP server management
The system SHALL allow configuring and toggling local and remote MCP servers in each project's `opencode.jsonc` from the web UI or via the primary agent.

#### Scenario: Adding an MCP server to a project workspace
- **WHEN** a user registers an MCP server in a project's settings
- **THEN** the system updates the project's `opencode.jsonc`, reloads the OpenCode location, and reports the MCP server's connection status in the UI

### Requirement: Project primary agent and instructions
The system SHALL provide each project with a primary agent profile and project instructions loaded for chat sessions, select that agent as the default for new project sessions, and allow editing it without affecting the project's sub-agents.

#### Scenario: New project chat uses the primary agent
- **WHEN** a project is created and its chat session starts
- **THEN** OpenCode selects the project's primary agent as the default agent for that session

#### Scenario: Primary agent is editable from the catalog
- **WHEN** a user opens the project's agent catalog
- **THEN** the primary agent is listed with mode `primary` and can be edited independently from sub-agents

#### Scenario: Editing a sub-agent does not change the primary agent
- **WHEN** a user updates a sub-agent's instructions, model, or permissions
- **THEN** the project primary agent and project instructions remain unchanged

#### Scenario: Existing session adopts the primary agent
- **WHEN** an existing project session was created before the primary agent existed
- **THEN** the system switches that session to the primary agent or starts a new session with it and preserves the project chat history

#### Scenario: Primary agent is project-scoped
- **WHEN** a project primary agent is listed or invoked
- **THEN** only the profile and instructions under that project are visible and sibling primary agents are not exposed
