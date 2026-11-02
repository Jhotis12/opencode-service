# Proposal

## Why

The product already has strong bones: a coherent dark palette, a distinctive node-shape language, and a motion standard. But its identity is still a text diamond, the typography and semantic colors drift between screens, the desktop canvas opens at an unreadable zoom, the project top bar clips tabs, and the Agentes tab is a plain list followed by a very long inline form. The result reads as a capable internal admin panel rather than a finished product with a point of view.

This change establishes a real brand and design system, then applies it to the highest-value surfaces: the shell, the canvas, the agent catalog, the chat, and the status/copy layer. The goal is a polished, elegant desktop product that feels intentional and ownable without changing the workflow engine or the API.

## What Changes

- **Brand identity**: add an original SVG mark, wordmark/lockup and favicon; replace the `◆` placeholder in the login, navigation, chat bubble and browser tab; introduce a single `Brand` component. The mark references terminal/code, agent nodes and OpenCode conceptually; it does not copy the official OpenCode logo. A descriptor explains the relationship.
- **Brand and design standard**: add `docs/design-standard.md` covering logo usage, color roles, typography, spacing/radius, component states, motion, accessibility, copy and status localization. Extend, not replace, `docs/ui-motion.md`.
- **Design tokens**: centralize surfaces, lines, text, brand, agent, status and node-category colors. Reduce node colors from nine per-type hues to five category tokens, using shape and icon to distinguish types within a category. Add semantic status tokens and stop reusing status colors as category colors.
- **Typography and font loading**: bundle Inter Variable (or an equivalent bundled variable font) instead of relying on a locally installed font; define a compact type scale with an 11 px metadata floor and a 13 px node title. Use tabular numerals for metrics and durations.
- **Desktop shell polish**: make the project top bar fit on one row at desktop widths, move secondary actions into an overflow menu, keep the active tab fully visible when the tab strip scrolls, and remove clipped labels. Mobile responsiveness is explicitly out of scope for this change.
- **Canvas legibility**: stop auto-fitting the whole graph below a readable zoom; when the graph is wider than the viewport, center on the trigger at a legible zoom and provide an explicit "Ajustar vista" action. Preserve the full-graph overview through the minimap, and keep panning as the way to inspect the rest.
- **Agent catalog redesign**: turn the Agentes tab into a polished catalog of agent cards (identity, category/role, mode, description, model, notebooks and permission summary), highlight the primary agent, add a clear empty state, and move create/edit into a focused modal or side editor instead of a permanent form below the list. Localize mode labels (`Primary`/`Subagent` → `Principal`/`Sub-agente`/`Principal y sub-agente`).
- **Chat simplification**: remove the expanded/maximized chat surface, which duplicates the existing lateral drawer and no longer has a purpose. Keep the project chat as a drawer with a close action and the orchestrator chat as a docked panel; keep the minimized bubble where a panel is not forced. Remove the expand control and its persisted state, and place the "jump to latest" action so it does not cover the last message.
- **Status and copy consistency**: localize API statuses and raw errors, reserve color for semantic roles, use actionable Spanish error copy, and truncate long model IDs and identifiers with a title instead of wrapping card layouts.
- **Accessibility hardening**: explicit `focus-visible` styles, focus trap and background `inert` for modals, `inert` for the off-screen mobile nav, a skip link, status text that is not color-only, and reduced-motion coverage for smooth scroll and animated status.
- **BREAKING (UI)**: the expanded/maximized chat state is removed; the agent editor moves out of the permanent page flow; the top bar reorganizes secondary actions. No API, database, workflow schema or execution behavior changes.

### Out of scope

- Mobile-first redesign and new mobile breakpoints. The app is desktop-first; mobile must not block this change, and existing mobile behavior is not an acceptance target.
- Backend, database, OpenCode adapter, workflow engine, agent runtime, permissions model or API contracts.
- New agent capabilities, new workflow node types or changes to workflow validation.
- Marketing site, open-graph imagery, custom illustration or a full copywriting pass beyond the surfaces listed above.
- Copying or redrawing the official OpenCode logo; any use of the OpenCode name is descriptive and subject to its brand terms.

## Capabilities

### New Capabilities

- `interface-design-system`: owns the brand identity, design tokens, typography, component states, status/copy localization, accessibility rules and logo usage that apply across the web interface.

### Modified Capabilities

- `agent-chat-experience`: removes the expanded/maximized chat state, keeps the drawer and minimized bubble behavior, and clarifies the accessible controls and jump-to-latest behavior. Mobile-specific requirements are retired from this change's acceptance.
- `workflow-and-workspace-engine`: adds a readable initial canvas viewport and a desktop project top bar that keeps tabs and primary actions visible without clipped labels.
- `multi-agent-catalog`: adds the agent catalog presentation contract: card identity, primary-agent emphasis, mode labels, empty state and focused edit surface.

## Impact

- **Web UI**: `apps/web/src/index.css`, `apps/web/src/ui.ts`, new `Brand` component, `Layout.tsx`, `LoginPage.tsx`, `ChatPanel.tsx`, `ProjectPage.tsx`, `ProjectTopBar.tsx`, `WorkflowCanvas.tsx`, `nodes/node-catalog.ts`, `nodes/PlatformNode.tsx`, `Modal.tsx`, `ProjectsPage.tsx`, `SettingsPage.tsx`, `HealthPage.tsx`, `ProjectResourcesPanel.tsx`, `ProjectKnowledgePanel.tsx`, `ProjectSettingsPanel.tsx`, and the agent catalog section of `ProjectPage`.
- **Assets and docs**: `apps/web/public/brand/*.svg`, `apps/web/public/favicon.svg`, `apps/web/index.html`, `docs/design-standard.md`, and a referenced update to `docs/ui-motion.md`.
- **Tests**: existing web unit tests for chat, layout and pages; new tests for the brand component, token/status mapping, accessible dialogs and the agent catalog. The Playwright e2e flow is updated for the desktop top bar, canvas zoom and agent editor.
- **Dependencies**: likely one font package (`@fontsource-variable/inter` or equivalent) or self-hosted WOFF2 files. No server dependencies.
- **Unchanged**: server routes, `packages/shared`, workflow execution, persistence, OpenCode integration, database schema and provider configuration.
