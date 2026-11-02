# Spec Delta

## MODIFIED Requirements

### Requirement: First-boot admin provisioning and master key initialization
The system SHALL initialize persistent directories under `/data`, generate a 256-bit master encryption key if none exists, create a default administrator account (`admin`) with `mustChangePassword = true` when the user database is empty, and provision the global control workspace at `/data/control`.

#### Scenario: Container starts for the first time with empty volume
- **WHEN** the server starts with an empty `/data` volume and no existing users
- **THEN** the system creates `/data/master.key`, initializes the database schema, creates user `admin` using `INITIAL_ADMIN_PASSWORD` or the default initial password with `mustChangePassword = true`, and scaffolds `/data/control` with the orchestrator agent and instructions

#### Scenario: Container restarts with existing volume
- **WHEN** the server starts and at least one user already exists in the database
- **THEN** the system preserves the existing users, master key, control workspace, and project files without overwriting credentials or user-authored instructions

#### Scenario: Existing projects receive the primary agent scaffold
- **WHEN** the server starts with projects created before the primary agent existed
- **THEN** the system adds the missing project instructions and primary agent profile without overwriting existing agents, workflows, or knowledge files

### Requirement: AES-256-GCM secret vault and alias resolution
The system SHALL encrypt all stored API keys, channel tokens, email credentials, and external database credentials at rest using AES-256-GCM, scope every secret to a project or to the platform/global control scope, and expose only non-sensitive aliases and masked previews to the UI and LLM context.

#### Scenario: Storing a secret credential in the vault
- **WHEN** an administrator saves a credential with an alias inside a project
- **THEN** the system encrypts the secret value with a unique IV and authentication tag before storing it, scopes it to that project, and returns only metadata and a masked preview

#### Scenario: Resolving a secret at execution time
- **WHEN** a code node, integration adapter, or platform tool requests a project credential by alias
- **THEN** the runtime decrypts the credential in memory for the adapter call without injecting the raw secret into LLM prompts, worker payloads, or logs

#### Scenario: Cross-project secret is denied
- **WHEN** project A requests a secret alias owned by project B or a global secret it is not authorized to use
- **THEN** the system rejects the resolution and records the attempted alias and scope without logging the secret value

#### Scenario: Global secret is limited to platform and control scope
- **WHEN** a secret is stored with global scope
- **THEN** only platform settings and the global orchestrator can resolve it, and project integrations cannot reference it

### Requirement: External database connection pool registry
The system SHALL allow users to register, test, and query external databases as project-owned integrations (PostgreSQL, MySQL, MSSQL, SQLite), and SHALL allow global control-plane database integrations only where explicitly configured for the orchestrator.

#### Scenario: Testing a registered external database connection
- **WHEN** a user triggers a connection test for a project database integration
- **THEN** the system opens a bounded connection with a 5-second timeout, executes a health query, and returns connection latency or a sanitized error code

#### Scenario: Sibling project cannot query the database
- **WHEN** project A attempts to query a database integration owned by project B
- **THEN** the system rejects the operation with HTTP `403` and does not open a connection

#### Scenario: Global database integration is control-plane only
- **WHEN** a database integration is configured with global scope for the orchestrator
- **THEN** it is not listed as a project resource and project nodes cannot reference it

#### Scenario: Credentials stay encrypted
- **WHEN** a database integration is created or updated
- **THEN** its credentials are stored in the scoped vault and the API never returns the plaintext connection string

### Requirement: Global default model selection
The system SHALL persist a platform default model and a per-project default model, using the project default first and the platform default second when neither the workflow nor the node defines a model.

#### Scenario: Administrator selects the global default model
- **WHEN** an administrator saves a default model from platform settings
- **THEN** the system persists it and uses it for projects that have no project default and for sessions without an explicit model

#### Scenario: Project selects its own default model
- **WHEN** a user saves a default model in a project's settings
- **THEN** that project's chat and workflow nodes use the project default before the platform default

#### Scenario: Workflow or node override wins
- **WHEN** a workflow or agent node defines its own model
- **THEN** the engine uses that model instead of either default

## ADDED Requirements

### Requirement: Persistent OpenCode service state and provider credential restoration
The system SHALL store OpenCode's database and state under the persistent data volume and SHALL re-register provider API keys from the encrypted vault when the platform starts, so a service restart does not force the administrator to re-enter the key.

#### Scenario: OpenCode database survives a container restart
- **WHEN** the container restarts with the persistent `/data` volume
- **THEN** OpenCode uses the database at `/data/opencode/opencode.db` and the sessions stored there remain available

#### Scenario: Provider key is restored on startup
- **WHEN** the platform starts and the global vault contains a provider API key
- **THEN** the system registers that key with OpenCode before accepting chat traffic

#### Scenario: Provider key restore failure is visible
- **WHEN** restoring a provider key fails
- **THEN** the system logs a sanitized warning and keeps the platform available for diagnosis

#### Scenario: Existing installation upgrade
- **WHEN** an installation from the previous ephemeral database starts on the new version
- **THEN** the system uses the persistent database for new sessions and stale chat sessions are recovered on their next turn
