# omnichannel-and-chat-gateway Specification

## Purpose

Habilita la comunicación bidireccional por WhatsApp, Telegram y aplicaciones externas con chat propio, operando tanto a nivel global (conversación directa del administrador con el Agente Orquestador y aprobaciones interactivas) como a nivel de nodos dentro de cada flujo con sesiones persistentes por hilo.

## Requirements

### Requirement: Interactive Human-in-the-Loop permission and approval replies over chat
The system SHALL forward OpenCode permission requests and workflow `approval` nodes to the administrator's configured Web, WhatsApp, Telegram, or global control channel associated with the run, and resume execution upon receiving an authorized reply.

#### Scenario: Approving a paused workflow step from Telegram or WhatsApp
- **WHEN** a workflow started from a project Telegram or WhatsApp integration reaches an `approval` node
- **THEN** the system sends the approval prompt to the channel that originated the run and resumes or rejects the step only after an authorized administrator replies

#### Scenario: Approval from the global control channel
- **WHEN** the global orchestrator or an administrator initiates an action that requires approval
- **THEN** the prompt is sent to the configured global control channel and the decision is attributed to the responding administrator

#### Scenario: Unauthorized approval is rejected
- **WHEN** a sender outside the integration's administrator allowlist attempts to approve or reject a pending step
- **THEN** the system rejects the command, keeps the step pending, and records a security audit entry

### Requirement: External Application Chat Gateway API with persistent conversation threads
The system SHALL expose an authenticated API at `POST /api/v1/integrations/:integrationId/messages` allowing external applications with their own chat UI to converse with the integration's bound project agent or workflow using a persistent `externalThreadId <-> chat thread` mapping.

#### Scenario: Multi-turn conversation from an external app chat over SSE or JSON
- **WHEN** an external application sends a message with its integration key, `threadId: "cust_42"`, and `message`
- **THEN** the system resolves or creates the mapped chat thread for that integration and external thread, executes the configured agent or workflow retaining prior conversation context, and streams SSE events or returns the structured JSON response

#### Scenario: Asynchronous callback to external application webhook
- **WHEN** a workflow triggered by an external application integration pauses for an asynchronous step and later completes
- **THEN** the system delivers the completion payload signed with HMAC-SHA256 to the integration's configured `webhookUrl`

#### Scenario: Integration key cannot access another project
- **WHEN** an external application presents a valid key for an integration owned by project A and attempts to address project B or a global integration
- **THEN** the system rejects the request with HTTP `403` and does not create a thread in the other scope

#### Scenario: Invalid or revoked key is rejected
- **WHEN** an external application presents an unknown, rotated, or revoked integration key
- **THEN** the system responds with HTTP `401` and does not invoke any agent or workflow

### Requirement: Project-scoped channel routing
The system SHALL resolve every incoming project channel message to exactly one owning project and route it deterministically according to that integration's mode and declared trigger, without scanning unrelated projects.

#### Scenario: Telegram message reaches the owning project
- **WHEN** a message arrives through a Telegram integration owned by project `ventas`
- **THEN** the system routes it only within `ventas` according to the integration's mode and never evaluates triggers in sibling projects

#### Scenario: Sibling project with a similar channel does not compete
- **WHEN** two projects have integrations with the same display slug or bot name but different integration identifiers
- **THEN** each message is routed by its integration identifier and neither project can consume the other's messages

#### Scenario: No matching trigger in the owning project
- **WHEN** a channel uses workflow mode and the owning project has no matching trigger for the incoming event
- **THEN** the system drops the message with a recorded reason and does not fall back to another project

### Requirement: Separate global control channels
The system SHALL keep global orchestrator integrations separate from project integrations, with their own administrator allowlist, event subscriptions, and lifecycle, and SHALL never expose them as project channels.

#### Scenario: Global channel is not available to projects
- **WHEN** a project lists available channels for a trigger or resource picker
- **THEN** global integrations are excluded and only project integrations are selectable

#### Scenario: Project channel is not available to the orchestrator
- **WHEN** the global orchestrator lists its channels or sends an alert
- **THEN** it can only use global integrations and cannot send through a project integration

#### Scenario: Global channel allowlist is independent
- **WHEN** an administrator is allowlisted on a global channel but not on a project channel
- **THEN** the global permission does not grant access to the project channel
