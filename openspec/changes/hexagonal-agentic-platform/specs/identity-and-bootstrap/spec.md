# Spec Delta

## Purpose

Provee el aprovisionamiento automático en el primer arranque del contenedor (Docker/EasyPanel), autenticación de administradores con rotación obligatoria de contraseña, bóveda de secretos encriptada (AES-256-GCM) y gestión de conexiones a proveedores de modelos como OpenCode Go y bases de datos externas.

## ADDED Requirements

### Requirement: First-boot admin provisioning and master key initialization
The system SHALL initialize persistent directories under `/data`, generate a 256-bit master encryption key if none exists, and create a default administrator account (`admin`) with `mustChangePassword = true` when the user database is empty.

#### Scenario: Container starts for the first time with empty volume
- **WHEN** the server starts with an empty `/data` volume and no existing users
- **THEN** the system creates `/data/master.key`, initializes the database schema, and creates user `admin` using `INITIAL_ADMIN_PASSWORD` or the default initial password with `mustChangePassword = true`

#### Scenario: Container restarts with existing volume
- **WHEN** the server starts and at least one user already exists in the database
- **THEN** the system preserves the existing users and master key without overwriting credentials

### Requirement: Mandatory initial password rotation
The system SHALL block access to protected API routes and UI views (except password rotation and logout) while the authenticated user has `mustChangePassword = true`.

#### Scenario: Admin logs in with default credentials
- **WHEN** the `admin` user authenticates using the initial default password
- **THEN** the system issues a session cookie and returns `mustChangePassword: true`, rejecting any non-auth resource request with HTTP `403 PASSWORD_CHANGE_REQUIRED`

#### Scenario: Admin sets a new compliant password
- **WHEN** the `admin` user submits a new password of at least 12 characters that differs from the default password
- **THEN** the system hashes the password with Argon2id, sets `mustChangePassword = false`, and unlocks full platform access

### Requirement: AES-256-GCM secret vault and alias resolution
The system SHALL encrypt all stored API keys, channel tokens, and external database credentials at rest using AES-256-GCM and expose only non-sensitive aliases and masked previews to the UI and LLM context.

#### Scenario: Storing a secret credential in the vault
- **WHEN** an administrator saves a credential with an alias (e.g., `ventas_postgres_prod`)
- **THEN** the system encrypts the secret value with a unique IV and authentication tag before storing it and returns only metadata and a masked preview

#### Scenario: Resolving a secret at execution time
- **WHEN** a code node or platform tool requests a connection by alias
- **THEN** the runtime decrypts the credential in memory for the adapter call without injecting the raw secret into LLM prompts or logs

### Requirement: OpenCode Go and provider connection management
The system SHALL allow administrators to connect and verify their OpenCode Go API key and other model providers directly from the web UI, synchronizing available models and usage limits with the OpenCode V2 server.

#### Scenario: Connecting OpenCode Go API key from settings UI
- **WHEN** an administrator submits an OpenCode Go API key in the Settings screen
- **THEN** the system registers the credential with the OpenCode V2 server, verifies connectivity, and returns the catalog of available `opencode-go` models

### Requirement: External database connection pool registry
The system SHALL allow administrators to register, test, and query external databases (PostgreSQL, MySQL, MSSQL, SQLite) referenced by alias across projects and workflows.

#### Scenario: Testing a registered external database connection
- **WHEN** an administrator triggers a connection test for a registered database alias
- **THEN** the system opens a bounded connection with a 5-second timeout, executes a health query, and returns connection latency or a sanitized error code

### Requirement: Global default model selection
The system SHALL persist an administrator-selected global default model and use it when neither the workflow nor the node defines a model.

#### Scenario: Administrator selects the global default model
- **WHEN** an administrator saves a default model from Settings
- **THEN** the system persists `default_model`, exposes it in Settings, and uses it for agent nodes and project chat sessions without an explicit model

#### Scenario: Workflow or node override wins
- **WHEN** a workflow or agent node defines its own model
- **THEN** the engine uses that model instead of the global default
