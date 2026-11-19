# openspec/changes/ — In-flight review-gated deltas

**Earned:** score 15 — 110 files, 8 subdirs (7 active + `archive/`), lifecycle target of propose/apply/update/archive. Distinct domain: candidate changes with delivery rules, not current truth.

## OVERVIEW
Active change proposals; `archive/` (6 merged changes, 4 still declaring `schema: spec-driven`) is read-only history.

## WHERE TO LOOK
| Active change | Note |
|---------------|------|
| `add-reliable-automation-actions` | Only change with a non-schema artifact: `validation-p0.md` |
| `add-transcription-nodes-and-channel-media` | Transcription nodes + channel media |
| `add-tts-node-and-telegram-voice-replies` | TTS node + Telegram voice replies |
| `centralize-node-and-channel-config` | Targets capability `configuration-registry` (not yet in `specs/`) |
| `fix-favicon-and-animate-nav-rail` | Small UI fix |
| `fix-orchestrator-tool-turns` | Orchestrator tool turns |
| `harden-chat-turn-lifecycle` | Targets capability `chat-turn-lifecycle` (not yet in `specs/`) |

## CONVENTIONS
- Layout per change: `.openspec.yaml` (schema + created), `proposal.md`, `specs/<capability>/spec.md` deltas, `design.md`, `tasks.md`.
- Delta headers: `## ADDED|MODIFIED|REMOVED|RENAMED Requirements`; REMOVED carries `**Reason**` + `**Migration**`; RENAMED uses FROM:/TO:.
- New-capability deltas open with `## Purpose`; deltas for existing capabilities must not add one.
- `tasks.md`: `- [ ] X.Y` checkboxes — only `x`/`X` count as done; `- [~]`, `- [-]`, `- []` read as unfinished.
- Every `tasks.md` ends with a plain-bullet `## Workflow follow-up` section.
- Delivery: branch `change/<name>` off the remote base; planning commit `docs(openspec): plan <name>`; one atomic Conventional Commit per numbered task group; PR via `gh pr create`.

## ANTI-PATTERNS
- NEVER auto-merge — report the PR URL and wait for human review.
- NEVER archive while the PR is open: require `gh pr view change/<name> --json mergedAt` non-null, or explicit human confirmation.
- NEVER archive while a spec sync is in flight.
- NEVER leave an empty `## Requirements` section, and never invent requirements the main spec does not hold.
- NEVER collect tests/docs into a final catch-all task group; each group lands the tests and docs its own work calls for.
