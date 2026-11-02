# Spec Delta

## ADDED Requirements

### Requirement: Orchestrator tool-turn regression coverage
The automated test suite SHALL cover explicit orchestrator model resolution, empty replies, stuck-session recovery, blank-history filtering, control-chat progress, and the read-only global tool inventory.

#### Scenario: Model resolution is tested
- **WHEN** the suite runs the orchestrator with an explicit model, with only the platform default, and with no model configured
- **THEN** it verifies the explicit model wins, the platform default is used as fallback, and the missing-model case fails with an actionable error

#### Scenario: Empty reply is tested
- **WHEN** a fake agent returns an empty or whitespace-only reply
- **THEN** the suite verifies the turn fails, a system error is persisted, and no agent message with empty content is appended

#### Scenario: Stuck-session recovery is tested
- **WHEN** a fake agent returns an empty reply once and non-empty text on the retry
- **THEN** the suite verifies a new session is created on the same thread, the prompt is retried once, exactly one user message remains, and one agent response is stored

#### Scenario: Blank history is tested
- **WHEN** the store contains empty agent messages from earlier turns
- **THEN** the suite verifies the control-chat history omits them

#### Scenario: Control-chat progress is tested
- **WHEN** a fake agent emits text and tool events during an orchestrator turn
- **THEN** the suite verifies the SSE response contains `delta` and `activity` events and that a failed turn emits an `error` event

#### Scenario: Read-only global inventory is tested
- **WHEN** the plugin registers tools for the global scope
- **THEN** the suite verifies mutating and side-effect tools are absent while project scope retains its existing inventory

#### Scenario: The regression is part of the normal suite
- **WHEN** a developer runs `bun test --cwd apps/server` and the plugin tests
- **THEN** the orchestrator, chat recovery, progress, and plugin inventory tests execute without requiring a live OpenCode service
