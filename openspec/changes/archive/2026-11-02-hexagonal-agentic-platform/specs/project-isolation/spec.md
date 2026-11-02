# Spec Delta

## Purpose

Garantiza que cada proyecto tenga su propia sesión de chat e historial persistente, y que el agente de un proyecto solo pueda leer, editar y operar sobre su propio directorio, workflows, sub-agentes y ejecuciones. El orquestador global es la única vista transversal.

## ADDED Requirements

### Requirement: Per-project chat session and persistent history
The system SHALL keep a separate OpenCode session and persistent message history per project, storing user, agent and system messages with timestamps.

#### Scenario: Leaving and re-entering a project
- **WHEN** a user sends messages in a project, navigates away and returns
- **THEN** the chat panel loads the previous user, agent and system messages from the database and reuses the same project session

#### Scenario: Two projects have independent sessions
- **WHEN** the user chats in project A and then in project B
- **THEN** each project uses a different `opencodeSessionId` and never shares conversation context

### Requirement: Long-running project chat with SSE heartbeats
The system SHALL stream project chat over SSE with periodic heartbeats and a configurable timeout (15 minutes by default), persisting timeout errors in the chat history.

#### Scenario: Long agent construction keeps the connection alive
- **WHEN** the agent takes several minutes to build nodes or run tools
- **THEN** the server sends heartbeat events so the connection stays open and the UI shows the elapsed time

#### Scenario: Chat timeout is persisted
- **WHEN** the agent exceeds `AGENT_CHAT_TIMEOUT_MS`
- **THEN** the request ends with an error, the error is stored as a system message and the user can retry without losing prior messages

### Requirement: Project file isolation
The system SHALL restrict project file tools to the project directory via default `opencode.jsonc` permissions and reject traversal or symlink escapes outside it.

#### Scenario: Sibling project read is denied
- **WHEN** an agent session in project A attempts to read or edit a file under project B
- **THEN** OpenCode denies the operation according to the project permissions and the platform logs the rejected access

#### Scenario: Workspace traversal is blocked
- **WHEN** a node or API request resolves a path outside `/data/workspaces/<project-slug>/` after symlink resolution
- **THEN** the system rejects it with `403 FORBIDDEN_PATH`

### Requirement: Project-scoped tool and API access
The system SHALL scope platform tool and API calls with `x-platform-project`, filter project listings and reject cross-project reads/runs with HTTP 403; the global orchestrator remains unscoped.

#### Scenario: Project agent lists only its project
- **WHEN** the OpenCode plugin calls `platform_workflow_list` from a project location
- **THEN** the platform returns only that project, not its siblings

#### Scenario: Cross-project run access is rejected
- **WHEN** a scoped request tries to read or replay a run belonging to another project
- **THEN** the server responds with `403 project scope mismatch`

#### Scenario: Global orchestrator sees all projects
- **WHEN** the global orchestrator (outside `/workspaces`) lists projects without a scope header
- **THEN** the platform returns all projects so the administrator can request cross-project reports