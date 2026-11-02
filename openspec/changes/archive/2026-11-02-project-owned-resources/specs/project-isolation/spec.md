# Spec Delta

## MODIFIED Requirements

### Requirement: Per-project chat session and persistent history
The system SHALL keep separate chat threads and persistent message history per project and per global control scope, storing user, agent, and system messages with timestamps and linking each thread to its OpenCode session and optional integration.

#### Scenario: Leaving and re-entering a project
- **WHEN** a user sends messages in a project, navigates away and returns
- **THEN** the chat panel loads the previous user, agent and system messages from the database and reuses the same project thread and session

#### Scenario: Two projects have independent sessions
- **WHEN** the user chats in project A and then in project B
- **THEN** each project uses a different thread and `opencodeSessionId` and never shares conversation context

#### Scenario: Project and global conversations are separate
- **WHEN** the user chats with a project agent and then with the global orchestrator
- **THEN** the messages, thread, and OpenCode session are distinct and neither conversation appears in the other's history

#### Scenario: Channel conversation maps to a thread
- **WHEN** a Telegram, WhatsApp, or external application integration receives a message from the same external thread
- **THEN** the system reuses the mapped chat thread and session for that integration and external thread

### Requirement: Project-scoped tool and API access
The system SHALL scope every project tool and API call to an explicit project, filter project listings, and reject cross-project reads, writes, runs, notebook access, integration access, and secret resolution with HTTP `403`; global control-plane access SHALL require a separate global credential or claim.

#### Scenario: Project agent lists only its project
- **WHEN** the OpenCode plugin calls `platform_workflow_list` from a project location
- **THEN** the platform returns only that project, not its siblings

#### Scenario: Cross-project run access is rejected
- **WHEN** a scoped request tries to read or replay a run belonging to another project
- **THEN** the server responds with `403 project scope mismatch`

#### Scenario: Cross-project resource access is rejected
- **WHEN** a project-scoped request tries to read or mutate another project's integration, secret, notebook, connection, or chat thread
- **THEN** the server responds with HTTP `403` and records the rejected resource and scope

#### Scenario: Global orchestrator sees all projects
- **WHEN** the global orchestrator authenticates with its global control credential and lists projects
- **THEN** the platform returns all projects so the administrator can request cross-project reports

#### Scenario: Missing scope cannot be used to escalate
- **WHEN** a request originates from a project location without a valid project scope
- **THEN** the platform rejects it instead of treating it as an unscoped global request

## ADDED Requirements

### Requirement: Project-owned asset isolation
The system SHALL treat integrations, secrets, notebooks and their sources, chat threads, and workflow runs as project-owned assets and SHALL prevent any project-scoped request from reading or mutating another project's assets.

#### Scenario: Sibling integration is invisible
- **WHEN** a project lists or resolves integrations
- **THEN** it sees only integrations whose scope is that project and never global or sibling integrations

#### Scenario: Sibling secret is invisible
- **WHEN** a project lists or resolves vault aliases
- **THEN** it sees only aliases owned by that project and cannot resolve a sibling alias by guessing its name

#### Scenario: Sibling notebook is invisible
- **WHEN** a project lists, searches, or binds notebooks
- **THEN** it sees only notebooks owned by that project and cannot cite or ingest into a sibling notebook

#### Scenario: Sibling chat history is invisible
- **WHEN** a project reads chat history or a channel thread mapping
- **THEN** it receives only threads owned by that project and never the global control history or a sibling project's threads

### Requirement: Separate project and global authorization scopes
The system SHALL distinguish project-scoped calls from global control-plane calls using separate credentials or signed claims, and SHALL audit every rejected scope escalation attempt.

#### Scenario: Project credential cannot call global tools
- **WHEN** a project-scoped credential is used for a global tool or global channel operation
- **THEN** the system rejects the request with HTTP `403` and records the credential scope and attempted action

#### Scenario: Global credential cannot edit a project
- **WHEN** the global control credential is used for a mutating project operation
- **THEN** the system rejects the mutation unless the operation is explicitly allowlisted for the orchestrator and confirmed by an administrator

#### Scenario: Scope violation is auditable
- **WHEN** any scope violation is rejected
- **THEN** the system records the requesting scope, target scope, resource, action, and outcome without recording secret values or message bodies
