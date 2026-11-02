# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
