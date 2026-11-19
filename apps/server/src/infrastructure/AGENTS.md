# src/infrastructure — all real I/O

Score 14 (33 files, 18 subdirs; SqliteStore and SafeFsWorkspaceAdapter are god nodes). Earned file: every adapter touching disk/network/vendor SDKs. out/ has its own AGENTS.md; in/ (10 files, score 7) is covered here.

## STRUCTURE
`in/` = driving adapters (auth, channels, http, sse) — the server runs them. `out/` = driven adapters (persistence, opencode, media, vault, ...) — implement the ports; see out/AGENTS.md.

## NAMING
`*Adapter` (implements a port) / `*Service` (provider client) / `*Transport` (vendor SDK wrapper) / `Fake*` (test double) / `create*` (factory).

## CONVENTIONS
- Imports only application/ports, application/use-cases, domain, @platform/shared; port types are `import type` — the port file owns the interface, the adapter the implementation. No import cycles.
- No DI container: one deps/options object per constructor; `fetchImpl` injectable (IntegrationManager, WhatsAppCloudTransport, both OpenAI-compatible services) so tests never hit the network.
- Env read only via factory default parameter `env = process.env` (createEmbeddingAdapter, createAgentRuntime, ...).
- Adapters throw error types owned by application/ports (MediaStoreError, SpeechError, TranscriptionError, WorkerTimeoutError, AgentPromptTimeoutError).
- Outbound error text bounded: sanitizers truncate to 300 chars and strip tokens/credentials before anything leaves the process.

## in/ — DRIVING ADAPTERS (score 7, covered here)
| Area | Facts |
|------|-------|
| auth | Signed HMAC-SHA256 cookie `platform_session`, no server-side session state; verify via timingSafeEqual; default TTL 7d. authMiddleware blocks mustChangePassword users outside a 3-path allowlist. |
| rate limiting | In-process sliding window, 10 attempts/15 min — single-container assumption; move to a shared store before scaling horizontally. |
| http | createAuthRoutes / createExternalChatRoutes build Hono sub-apps mounted in app.ts; external-chat requires x-integration-key (401 otherwise). |
| sse | SseHub implements EventBus, drops throwing clients; streamSSE only when the client accepts text/event-stream. |
| channels | Transport/adapter split: `*Transport` owns the vendor link (Telegram = grammy; WhatsApp = Baileys + Cloud API), `*ChannelAdapter` owns routing + `integration.status` events. IntegrationEgressRouter: two maps (text/media) keyed by integration id; unknown id throws. |
| channel-manager | 6-way kind switch (telegram, whatsapp, external_chat, transcription, speech, email); email intentionally returns needs_config ("adapter not implemented"); startAll only restarts connecting/connected/qr_pending. |

## ANTI-PATTERNS (THIS LAYER)
- Never persist plaintext secrets — vault aliases only (`secretRefs`); ciphertext only in vault_secrets (mechanism: out/ AGENTS.md).
- Never write outside managed roots: UNSAFE_PATH (media), FORBIDDEN_PATH (workspace), extraction-path escapes all rejected.
- in/channels holds *outbound* egress adapters — directories are named by driver direction, not function. Don't "fix" this.
