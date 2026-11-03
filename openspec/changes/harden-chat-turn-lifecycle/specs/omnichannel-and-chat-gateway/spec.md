# Spec Delta

## ADDED Requirements

### Requirement: Durable channel turns and idempotent delivery

Agent-mode turns started by Telegram, WhatsApp, or the external chat gateway SHALL use the durable turn lifecycle. The reply SHALL be delivered after the turn completes, delivery SHALL be retryable and idempotent, and a duplicate inbound message SHALL NOT create a second prompt.

#### Scenario: Long Telegram or WhatsApp agent turn
- **WHEN** an agent-mode channel message starts a turn that takes longer than the transport idle timeout
- **THEN** the turn continues, the reply is delivered to the same channel when it completes, and the channel handler is not blocked by the full turn

#### Scenario: External chat SSE disconnects
- **WHEN** an external chat client disconnects during SSE streaming
- **THEN** the turn continues and the final reply remains available through the thread mapping or configured webhook

#### Scenario: Duplicate inbound message
- **WHEN** the same external message is delivered twice with the same external message identifier
- **THEN** the system returns the existing turn and delivers at most one reply

#### Scenario: Channel delivery fails
- **WHEN** the turn succeeds but the channel provider rejects or fails the reply delivery
- **THEN** the turn remains succeeded, the delivery is retried idempotently with a bounded policy, and the failure is visible in health and logs

#### Scenario: Channel turn scope
- **WHEN** a channel turn is created from an integration owned by project A
- **THEN** its turn, session, and delivery are scoped to project A and cannot be read or retried by project B or the global control plane
