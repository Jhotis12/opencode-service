# Security and isolation checklist

This checklist records the controls verified for the `project-owned-resources` change. It is intentionally concrete: each item names the boundary and the test or command that exercises it.

## Trust boundaries

- [x] Project HTTP/API input is validated with Zod at the route boundary.
- [x] Project service calls require `x-platform-project` and a project credential.
- [x] Global control calls require `x-platform-scope: global` and a separate global credential.
- [x] A project credential cannot be used for the control plane; the API returns `403`.
- [x] The global credential cannot mutate project data; project routes are GET-only for global scope.
- [x] External chat uses a per-integration key hash and never stores the plaintext key.
- [x] Inbound channel/email text is treated as data. The agent prompt is not a security boundary; tools and routes enforce scope.
- [x] LLM output is rendered as Markdown with ReactMarkdown escaping raw HTML; no `innerHTML` or `eval`.

## Secrets

- [x] Project secrets are stored in the AES-256-GCM vault with `scope = project` and `project_slug`.
- [x] Global secrets are limited to platform providers, Sentry and the orchestrator.
- [x] Integration config stores `secretRefs`, never plaintext credentials.
- [x] Worker RPC resolves database/channel integrations server-side; the worker receives results, not secrets.
- [x] Alert and log paths redact tokens, passwords, URLs and keys.
- [x] API responses never return secret values; the integration list returns metadata only.

## Isolation

- [x] Integrations, secrets, notebooks, chat threads and runs are filtered by project.
- [x] A sibling project cannot read or use another project's integration, secret, notebook or run.
- [x] A channel message is routed by `integrationId`; no global scan of project triggers.
- [x] A trigger cannot reference an integration or notebook from another project.
- [x] A project cannot create or modify another project.
- [x] Global orchestrator access is auditable and read-only by default.

## SSRF and external fetches

- [x] URL ingestion rejects non-HTTP(S), loopback, link-local, private and reserved addresses.
- [x] URL ingestion rejects redirects and enforces a response size limit.
- [x] Webhooks are validated through the URL safety check.
- [x] Database queries are parameterized and restricted to SQL statements.

## Authentication and abuse

- [x] Login is rate-limited (10 attempts per 15 minutes).
- [x] Session cookies are `httpOnly` and `sameSite`.
- [x] Password rotation is mandatory on first boot.
- [x] Channel allowlists are checked before agent/workflow routing.
- [x] Alerts are deduplicated and throttled to avoid notification floods.

## Verification evidence

```bash
bun run typecheck
bun test --cwd apps/server
bun run test
bun run test:e2e
```

Relevant tests:

- `apps/server/test/app.http.test.ts` — scope escalation, project integrations, resource reference validation.
- `apps/server/test/integrations.test.ts` — kind/config/secret validation, external chat keys, duplicate slugs.
- `apps/server/test/channel-router.test.ts` — allowlist, public workflow routing, approval commands, dropped messages.
- `apps/server/test/knowledge.test.ts` — SSRF, project isolation, cross-project citations.
- `apps/server/test/alerts.test.ts` — redaction, throttle and no-channel behavior.
- `apps/server/test/legacy-migration.test.ts` — backup creation and explicit resource mapping.
- `apps/web/test/chat.test.tsx` — Markdown rendering and unsafe HTML handling.

## Residual risks

- Shell commands inside the container remain a trusted capability; strong isolation requires a container/sandbox per project.
- Email is a future adapter; inbound email content must be treated as untrusted and attachments must be size/type limited when implemented.
- WhatsApp Baileys is an unofficial transport; account risk and rate limiting are operational concerns.
- The migration script requires an explicit mapping for legacy resources; unassignable resources are reported and never guessed.
