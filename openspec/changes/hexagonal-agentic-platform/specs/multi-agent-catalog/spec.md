# Spec Delta

## Purpose

Permite definir, organizar y ejecutar equipos de sub-agentes por categorías y roles basados en archivos Markdown (`.opencode/agents/<categoria>/<rol>.md`), seleccionar modelos por flujo o nodo (incluyendo `opencode-go`), gestionar servidores MCP por proyecto y exponer herramientas nativas `platform_*` a OpenCode V2.

## ADDED Requirements

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
The system SHALL register a server plugin in OpenCode V2 providing `platform_*` tools so the orchestrator and authorized sub-agents can inspect, create, trigger, and monitor workflows, query external DB aliases, search knowledge bases, and send channel notifications.

#### Scenario: Asking the global orchestrator for workflow status
- **WHEN** the user asks the orchestrator how a specific workflow is performing
- **THEN** the agent invokes `platform_workflow_runs` and returns the latest execution status, duration, and any step errors

### Requirement: Project-scoped MCP server management
The system SHALL allow configuring and toggling local and remote MCP servers in each project's `opencode.jsonc` from the web UI or via the primary agent.

#### Scenario: Adding an MCP server to a project workspace
- **WHEN** a user registers an MCP server in a project's settings
- **THEN** the system updates the project's `opencode.jsonc`, reloads the OpenCode location, and reports the MCP server's connection status in the UI
