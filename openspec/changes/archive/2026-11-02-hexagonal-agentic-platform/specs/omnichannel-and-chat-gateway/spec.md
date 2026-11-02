# Spec Delta

## Purpose

Habilita la comunicación bidireccional por WhatsApp, Telegram y aplicaciones externas con chat propio, operando tanto a nivel global (conversación directa del administrador con el Agente Orquestador y aprobaciones interactivas) como a nivel de nodos dentro de cada flujo con sesiones persistentes por hilo.

## ADDED Requirements

### Requirement: Dual-layer WhatsApp and Telegram routing with Admin Allowlist
The system SHALL route incoming WhatsApp and Telegram messages from allowlisted administrator sender IDs to the Global Orchestrator session (unless bound to an active workflow trigger) and restrict non-allowlisted senders strictly to explicitly configured public workflow triggers.

#### Scenario: Allowlisted administrator asks for a workflow report via Telegram or WhatsApp
- **WHEN** a message arrives from an allowlisted admin sender asking for the status or report of a workflow
- **THEN** the Channel Router forwards the message to the Global Orchestrator session, which runs the corresponding `platform_*` tools and replies on the same channel

#### Scenario: Non-allowlisted sender messages the bot without a matching public workflow trigger
- **WHEN** a message arrives from an unknown sender ID that does not match any active public workflow trigger
- **THEN** the Channel Router drops the message without invoking the Global Orchestrator session and records a security audit log

### Requirement: Interactive Human-in-the-Loop permission and approval replies over chat
The system SHALL forward OpenCode permission requests (`permission.asked`) and workflow `approval` nodes to the administrator's configured Web, WhatsApp, or Telegram channel and resume execution upon receiving an authorized reply.

#### Scenario: Approving a paused workflow step from Telegram or WhatsApp
- **WHEN** a workflow reaches an `approval` node or triggers an OpenCode permission prompt
- **THEN** the system sends an interactive prompt to the admin channel and, upon receiving the admin's approval action, resolves the pending permission or step and resumes execution

### Requirement: External Application Chat Gateway API with persistent conversation threads
The system SHALL expose an authenticated API (`POST /api/v1/channels/:channelSlug/messages`) allowing external applications with their own chat UI to converse with a target workflow or agent node using persistent `externalThreadId <-> opencodeSessionId` mapping.

#### Scenario: Multi-turn conversation from an external app chat over SSE or JSON
- **WHEN** an external application sends a message with `X-Channel-Key`, `threadId: "cust_42"`, and `message`
- **THEN** the system resolves or creates the mapped OpenCode session for `("channelSlug", "cust_42")`, executes the bound workflow/agent node retaining prior conversation context, and streams SSE tokens or returns the structured JSON response

#### Scenario: Asynchronous callback to external application webhook
- **WHEN** a workflow triggered by an external chat channel pauses for an asynchronous step and later completes
- **THEN** the system delivers the completion payload signed with HMAC-SHA256 to the channel's configured `webhookUrl`
