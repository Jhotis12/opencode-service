# Spec Delta

## MODIFIED Requirements

### Requirement: Native OpenCode platform plugin tools (`platform_*`)
The system SHALL register a server plugin in OpenCode V2 providing `platform_*` tools with explicit project or global scope, so project agents can inspect and mutate only their own project while the global orchestrator can inspect all projects in read-only mode.

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

## ADDED Requirements

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
