# agent-chat-experience Specification

## Purpose

Define la conversación con los agentes: un agente principal propio por proyecto, instrucciones orientadas al negocio y una superficie de chat legible, accesible y adaptable a respuestas largas.

## Requirements



### Requirement: Project primary agent and project instructions
Each project SHALL have a primary agent profile and project instructions that OpenCode loads for project chat sessions, including a default agent selection for new sessions.

#### Scenario: New project uses its primary agent
- **WHEN** a project is created and the user opens its chat
- **THEN** the session uses the project's primary agent rather than the default coding agent of OpenCode

#### Scenario: Existing project adopts the primary agent
- **WHEN** a project created before this change opens a chat session
- **THEN** the system switches the session to the project's primary agent or starts a new session with it, and informs the user if prior context cannot be retained

#### Scenario: Primary agent is edited from the project
- **WHEN** a user edits the primary agent's instructions, model, or communication rules in the project UI
- **THEN** the agent profile and project instructions are updated and the project location is reloaded without overwriting unrelated agent files

#### Scenario: Project instructions are project-scoped
- **WHEN** the primary agent of project A responds
- **THEN** it applies project A's instructions and does not inherit the instructions, resources, or agent profile of project B

### Requirement: Business-oriented communication contract
The project primary agent SHALL communicate in terms of nodes, flows, and outcomes, and SHALL avoid exposing internal file paths, raw JSON, or implementation details unless the user explicitly requests technical detail.

#### Scenario: Agent describes a change without paths
- **WHEN** the user asks the agent to create or modify a node
- **THEN** the reply describes the affected node, the change, and the next step without mentioning workspace paths or internal filenames by default

#### Scenario: Agent uses compact formatting
- **WHEN** the agent needs to present tabular information in chat
- **THEN** it uses at most three columns or a list suitable for a narrow panel, and does not paste raw workflow JSON

#### Scenario: User requests technical detail
- **WHEN** the user explicitly asks for files, paths, or code detail
- **THEN** the agent may provide them in a clearly separated technical section without changing the default business-oriented behavior

#### Scenario: Destructive change requires confirmation
- **WHEN** the agent is about to delete a node, replace an agent, or perform another destructive project change
- **THEN** it asks for confirmation before applying the change

### Requirement: Markdown and structured content rendering
The chat SHALL render Markdown with GFM tables, code blocks, lists, headings, and links, using safe rendering that does not execute untrusted HTML.

#### Scenario: Table is readable in a narrow panel
- **WHEN** the agent returns a GFM table
- **THEN** the chat renders it as a table with horizontal scrolling when needed and keeps the column content legible

#### Scenario: Code block is copyable
- **WHEN** the agent returns a fenced code block
- **THEN** the chat renders it as a code block with a copy action and horizontal scrolling

#### Scenario: Unsafe HTML is not executed
- **WHEN** an agent response contains raw HTML or a script tag
- **THEN** the chat displays it as text or discards the unsafe markup without executing it

#### Scenario: Long response preserves position
- **WHEN** a long response arrives while the user is reading earlier messages
- **THEN** the chat does not force-scroll away from the user's position and shows an indicator to jump to the latest message

### Requirement: Chat progress, timeout, and error states
The chat SHALL show that the agent is working, preserve timeout and failure messages in history, and allow retrying without losing prior messages.

#### Scenario: Long-running agent turn
- **WHEN** the agent takes several minutes to build nodes or run tools
- **THEN** the chat shows an elapsed-time indicator and keeps the connection alive with heartbeats

#### Scenario: Timeout is persisted
- **WHEN** the agent exceeds the configured chat timeout
- **THEN** the error is stored as a system message and the user can retry from the same conversation

#### Scenario: Chat request fails before a reply
- **WHEN** the chat request fails with a transport or agent error
- **THEN** the error is visible in the conversation and the user's original message remains available

### Requirement: Stale chat session recovery
The system SHALL recover a chat thread whose persisted OpenCode session no longer exists, by creating a new session on the same thread and retrying the turn once, while preserving the platform message history.

#### Scenario: Project chat after OpenCode restart
- **WHEN** a user sends a message to a project whose stored session returns `Session not found`
- **THEN** the system creates a new session for that project thread, retries the message, and persists the new session identifier

#### Scenario: Global orchestrator after OpenCode restart
- **WHEN** the global orchestrator's stored session is no longer available
- **THEN** the system creates a new orchestrator session on the same global thread and retries the turn

#### Scenario: Channel conversation after OpenCode restart
- **WHEN** a Telegram, WhatsApp, or external-chat thread references a missing session
- **THEN** the system recreates the session for that thread and sends the reply through the same integration

#### Scenario: Recovery does not duplicate the user message
- **WHEN** a stale-session recovery occurs
- **THEN** the platform history contains one user message and one agent response for that turn, not a duplicated pending message

### Requirement: Docked and minimized chat surface
The project chat SHALL support a docked drawer state and a minimized bubble state on desktop. The expanded or maximized state is removed and SHALL NOT be offered. Mobile adaptation is not an acceptance target for this change.

#### Scenario: Docked chat as a lateral drawer
- **WHEN** the user opens the project chat
- **THEN** it opens in the lateral drawer with the persisted conversation and input draft without covering the entire desktop viewport

#### Scenario: Minimizing the chat
- **WHEN** the user minimizes the chat
- **THEN** it collapses into a bubble that shows new-response status and can restore the panel with the same conversation state

#### Scenario: No expanded or maximized state
- **WHEN** the user inspects the chat controls
- **THEN** there is no expand or maximize action, no full-screen chat surface and no persisted expanded state

#### Scenario: State survives navigation
- **WHEN** the user navigates away from the project and returns
- **THEN** the chat restores the last docked or minimized state for that project and loads the persisted conversation

### Requirement: Accessible desktop chat interaction
The chat SHALL be keyboard accessible, announce loading and error states, and remain usable at supported desktop viewports. Mobile responsiveness is not an acceptance target for this change.

#### Scenario: Keyboard-only operation
- **WHEN** a user navigates the chat with the keyboard
- **THEN** the input, send action, minimize or close action, copy actions and jump-to-latest action are reachable and operable with visible focus

#### Scenario: Screen reader announcement
- **WHEN** an agent reply arrives or an error occurs
- **THEN** the chat announces the new state through an appropriate live region without reading the entire history

#### Scenario: Desktop viewport remains usable
- **WHEN** the project page is rendered at 1280 px or 1440 px
- **THEN** the chat surface, tables, code blocks and input remain usable without horizontal page overflow

### Requirement: Project chat drawer
The project chat SHALL open from the project header as a lateral drawer and SHALL be closed by default so the canvas remains full width until the user opens it.

#### Scenario: Opening the project chat
- **WHEN** the user activates the project's agent action
- **THEN** the chat opens in a lateral drawer with its persisted thread and history

#### Scenario: Closing the project chat
- **WHEN** the user closes or minimizes the drawer
- **THEN** the canvas regains the full width and the conversation remains persisted for the next open

#### Scenario: The drawer is the maximum chat surface
- **WHEN** the project chat is open
- **THEN** the drawer remains bounded by its maximum width and there is no separate full-screen expansion action

### Requirement: Chat scroll affordance
The chat SHALL show a jump-to-latest control when the user is not at the bottom of the conversation, and the control SHALL NOT cover the last message or the composer.

#### Scenario: Jump control appears away from the bottom
- **WHEN** the user scrolls up while a long conversation is open
- **THEN** a jump-to-latest control appears in a dedicated area that does not overlap message text or the composer

#### Scenario: Jump control returns to the latest message
- **WHEN** the user activates the jump-to-latest control
- **THEN** the conversation scrolls to the newest message and the control hides once the bottom is reached

#### Scenario: Incoming reply does not steal position
- **WHEN** a long agent reply arrives while the user is reading earlier messages
- **THEN** the viewport stays at the user's current position and the jump-to-latest control indicates that new content is available
