# Spec Delta

## ADDED Requirements

### Requirement: Chat turn telemetry

The system SHALL emit structured logs and bounded metrics for every chat turn, including turn, thread, project or control scope, entry point, OpenCode session, status, duration, retries, recovery, timeout, cancellation, and token or cost usage when available. Terminal turn failures SHALL be recorded in the error ledger and health view.

#### Scenario: Long turn is measurable
- **WHEN** a turn runs for several minutes
- **THEN** logs and metrics record its start, progress transitions, duration, final status, and usage without logging the prompt or response body

#### Scenario: Recovered transport is not an error
- **WHEN** a transport interruption is recovered and the turn succeeds
- **THEN** the system records a recovery counter or warning and does not count the turn as a terminal failure

#### Scenario: Terminal failure reaches the inspector
- **WHEN** a turn fails, times out, or is cancelled
- **THEN** the error ledger and `/api/system/errors` expose the turn identifier, entry point, and sanitized error code without secrets

#### Scenario: Active turn health
- **WHEN** one or more turns are active
- **THEN** the health snapshot reports active count, oldest active age, recent recoveries, and recent terminal failures instead of only HTTP request metrics

### Requirement: Chat turn resilience test coverage

The automated suite SHALL cover long turns beyond the previous transport idle limit, browser disconnects and reloads, platform restart recovery, duplicate sends, timeout interruption, empty replies, cross-project isolation, channel delivery, and orchestrator read-only retry without real five-minute waits.

#### Scenario: Long turn regression
- **WHEN** the test suite simulates a turn that exceeds the former five-minute transport limit
- **THEN** the turn remains successful, the final answer is persisted once, and no transport error is stored

#### Scenario: Disconnect and reload regression
- **WHEN** a client disconnects and later reattaches to a running turn
- **THEN** the test verifies the turn continued, progress or status is restored, and the final answer appears without duplicate messages

#### Scenario: Restart recovery regression
- **WHEN** the test starts the application with a running turn and an OpenCode session that is active, idle, or missing
- **THEN** the turn is reattached, completed from the stored answer, or marked unknown according to the reconciliation policy

#### Scenario: Idempotency and timeout regression
- **WHEN** the same client message is sent twice or a turn exceeds its maximum duration
- **THEN** the test verifies one prompt, one user message, and one interrupt with the correct terminal status

#### Scenario: Channel and orchestrator regression
- **WHEN** a channel turn completes or an orchestrator empty reply is retried
- **THEN** delivery is attempted idempotently and the read-only orchestrator policy does not leak into mutating project chat
