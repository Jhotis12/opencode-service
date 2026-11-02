# Tasks

Desktop-only frontend change. Do not edit `apps/server`, `packages/shared`, database migrations or workflow execution code.

## 1. Brand foundation

- [x] 1.1 Create `apps/web/public/brand/agentic-mark.svg`, `agentic-mark-mono.svg` and `apps/web/public/favicon.svg` from the "Nodo abierto" geometry; verify each renders at 16, 24 and 40 px and that the SVG files are valid XML.
- [x] 1.2 Add `apps/web/src/components/Brand.tsx` with a decorative mark, standalone mark with accessible title, wordmark lockup and optional project link; verify a new `brand.test.tsx` covers the accessible name, link target and mark-only variant.
- [x] 1.3 Replace the `◆` placeholder in `Layout.tsx`, `LoginPage.tsx` and `ChatPanel.tsx` with the shared brand component; verify `grep -R "◆" apps/web/src` returns no user-facing placeholder.
- [x] 1.4 Update `apps/web/index.html` with the favicon, product title, description and theme color; verify `bun run build` emits an HTML file that no longer contains `href="data:,"`.
- [x] 1.5 Add the bundled Inter Variable dependency and import the Latin subset, then define the type scale in `index.css`; verify the built app loads the font and `bun run typecheck` passes.
- [x] 1.6 Add `docs/design-standard.md` covering logo variants and clear space, token roles, type scale, spacing/radius, component states, accessibility, motion link and copy/status glossary; verify every rule used by tasks 2–8 is documented.
- [x] 1.7 Skipped: the design standard brand section is sufficient; no separate docs/brand directory. Add `docs/brand/` usage notes only if the SVG assets need a separate distribution note; verify the design standard links to them. Skip if the standard section is sufficient.

## 2. Tokens and semantic color system

- [x] 2.1 Add the surface, line, text, brand, agent, status and node-category tokens to `index.css`, keeping existing names as aliases only where they are still used; verify the app compiles with Tailwind 4 and no token is undefined.
- [x] 2.2 Replace hard-coded surface hex values in `ui.ts`, `Layout.tsx`, `ChatPanel.tsx`, `WorkflowCanvas.tsx`, `PlatformNode.tsx`, `PlatformEdge.tsx`, `Modal.tsx`, `ProjectsPage.tsx`, `SettingsPage.tsx`, `HealthPage.tsx`, `ProjectResourcesPanel.tsx`, `ProjectKnowledgePanel.tsx` and `ProjectSettingsPanel.tsx`; verify `grep` no longer finds the retired surface values outside `index.css`.
- [x] 2.3 Reduce `node-catalog.ts` from nine per-type colors to five category tokens; update palette previews, minimap node colors and node chips to derive color from category; verify a unit test asserts HTTP/code/transform/delay share the action token and validate/decision share the logic token.
- [x] 2.4 Update `statusBadge` and status dots so running uses the informational accent and warning is reserved for degraded/paused/needs-config/QR states; verify `ui.test.tsx` covers each tone and the localized label remains visible.
- [x] 2.5 Apply the 11 px metadata floor, 14 px node title and tabular numerals; increase the node footprint to keep category, title and subtitle legible; verify a component test asserts the node title size and card height, and a visual check at 100% zoom shows no clipped label.
- [x] 2.6 Truncate long model IDs, agent paths, slugs and run IDs with an accessible full-value title in Settings, Projects, Agents, Resources and Runs; verify the affected cards keep a stable height in component tests.
- [x] 2.7 Update the token and typography sections of `docs/design-standard.md` with the final values and category mapping; verify the document matches the classes used in the code.

## 3. Desktop shell and project top bar

- [x] 3.1 Refactor `ProjectTopBar` to a single desktop row with breadcrumb, scrollable tab strip, active-tab visibility, unsaved dot, Save, Run, Agent and overflow trigger; verify a component test renders all six tabs and primary actions at 1440 px.
- [x] 3.2 Add the `...` overflow menu with Versiones and Ajustes del flujo, keyboard traversal, Escape and click-outside close; verify a component test opens it by keyboard, activates an item and closes with Escape.
- [x] 3.3 Add left/right fade affordances to the tab strip and keep the active tab fully visible when the strip scrolls; verify a Playwright check at 1280 and 1440 shows no clipped tab label and the active tab is in view.
- [x] 3.4 Update `Layout.tsx` to use the brand lockup, replace the `OpenCode V2 · Hexagonal` subtitle with the approved descriptor and keep the collapsed rail accessible; verify `layout.test.tsx` covers the brand link and collapsed state.
- [x] 3.5 Update `LoginPage.tsx` with the brand lockup and the same descriptor; verify the login test still submits credentials and renders the new heading and mark.
- [x] 3.6 Add a small document-title hook so `/projects`, `/projects/:slug`, `/orchestrator`, `/settings` and `/system/health` set a descriptive title; verify Playwright observes the expected title on each route.
- [x] 3.7 Update the Playwright project-shell flow for the new top bar and overflow menu; verify the test opens Versiones and Ajustes from the menu and finds Save, Run and Agent directly.
- [x] 3.8 Add the desktop shell rules to `docs/design-standard.md`, including the one-row constraint and overflow behavior; verify the document is linked from the proposal's referenced docs.

## 4. Canvas legibility

- [x] 4.1 Replace the automatic `fitView` on mount with an explicit initial viewport: fit when the graph fits at 0.8 or higher, otherwise center on the trigger at 0.8; verify a Playwright assertion reads a viewport scale of at least 0.8 at 1440×900 for the seeded workflow.
- [x] 4.2 Add an `Ajustar vista` action next to `+ Nodo` that fits the full graph at the lower overview threshold; verify it is keyboard reachable and changes the viewport scale.
- [x] 4.3 Stop re-fitting on every graph update; fit only on project change/first load and preserve the current viewport during SSE or node edits; verify a component test or Playwright interaction does not reset the viewport after a node update.
- [x] 4.4 Apply the node footprint and typography from task 2.5 to `PlatformNode` and the shape mapping; verify the node title remains at least 11 px effective at the initial 0.8 zoom and the shape handles stay usable.
- [x] 4.5 Update the canvas tests and e2e assertions for the new viewport, `Ajustar vista`, node label size and the absence of clipped labels; verify `bun run test:e2e` covers the desktop canvas flow.
- [x] 4.6 Add the canvas legibility rules to `docs/design-standard.md`; verify the documented minimum zoom and fit behavior match `WorkflowCanvas.tsx`.

## 5. Agent catalog

- [x] 5.1 Extract the Agentes tab from `ProjectPage.tsx` into `AgentCatalog.tsx` and `AgentEditorModal.tsx`, moving the existing upsert/delete mutations with it; verify `bun run typecheck` and the existing page tests pass.
- [x] 5.2 Implement the card grid with category/role, localized mode badge, description, model, notebook summary and denied-tool count; verify component tests render primary and sub-agent cards and assert the primary card appears first.
- [x] 5.3 Emphasize the primary agent with the agent accent and `Principal` label and omit its delete action; verify a test asserts the primary card has no delete button.
- [x] 5.4 Add the sub-agent delete confirmation modal; verify a test cancels without deleting and confirms the mutation once.
- [x] 5.5 Implement the focused editor modal with grouped sections, required-field validation, sticky footer, cancel/save and returned focus; verify tests cover new-agent validation, edit prefill, save and discard.
- [x] 5.6 Add the empty sub-agent state and long-value truncation; verify tests cover the empty state and stable card height with a long model or notebook name.
- [x] 5.7 Update the Playwright agent flow to create and edit an agent through the modal instead of the inline form; verify the agent still exists through the API after saving.
- [x] 5.8 Add the agent catalog rules to `docs/design-standard.md`; verify the primary-agent protection and mode labels are documented.

## 6. Chat simplification

- [x] 6.1 Remove `"expanded"` from `ChatSurface` and delete the expand button, expanded classes, Escape-to-dock behavior, expanded persistence and expanded textarea sizing; verify `chat.test.tsx` asserts no `Expandir chat` control exists.
- [x] 6.2 Keep the project chat as a lateral drawer with `Cerrar` and the orchestrator chat as a docked panel with `Minimizar`/bubble restore; verify both page-level flows render and the persisted `"expanded"` value falls back to `"docked"`.
- [x] 6.3 Move `Ir al último mensaje` into a reserved right-aligned pill above the composer, hide it at the bottom and respect reduced motion for the scroll; verify a test covers appearance, activation and non-overlap with the composer.
- [x] 6.4 Update `apps/web/test/chat.test.tsx` for the two-state surface, scroll affordance and reduced-motion branch; verify `bun test --cwd apps/web` passes.
- [x] 6.5 Update the README and `docs/ui-motion.md` references to the old expanded chat state; verify `grep -R "expandido" README.md docs` no longer describes a supported chat surface.
- [x] 6.6 Update the Playwright chat flow to open, minimize/close and restore the drawer without an expand step; verify the test covers the project chat and the orchestrator bubble.

## 7. Status and copy localization

- [x] 7.1 Add the shared status/mode label map and a helper that returns both the visible Spanish label and the raw value; verify `ui.test.tsx` covers every raw value listed in the design.
- [x] 7.2 Update `statusBadge`, Health, Runs, Resources, Agents, Orchestrator and Settings to render the localized label and keep the raw value in `title`/`aria-label`; verify component tests no longer assert raw English visible labels.
- [x] 7.3 Map common API/login errors to actionable Spanish messages while preserving the raw error in a technical detail; verify login, project creation and integration failure tests.
- [x] 7.4 Remove `OpenCode V2 · Hexagonal` from the UI and replace the health emoji-only empty state with a check icon and text; verify `grep -R "Hexagonal\|🎉" apps/web/src` returns no user-facing occurrence.
- [x] 7.5 Add the copy glossary and raw-to-Spanish status table to `docs/design-standard.md`; verify the table matches the helper and the rendered labels.
- [x] 7.6 Update the affected unit and e2e tests for localized labels; verify `bun test --cwd apps/web` and the desktop e2e flow pass.

## 8. Accessibility hardening

- [x] 8.1 Portal `Modal` to `document.body`, add a focus trap, background `inert`, body scroll lock, initial focus and focus return; verify `modal.test.tsx` tabs through the dialog, cannot reach background controls and restores the trigger.
- [x] 8.2 Add a skip link to `Layout.tsx`, give the main region an id and add the global `:focus-visible` ring; verify a keyboard test tabs to the skip link and lands on `#main-content`.
- [x] 8.3 Make the closed mobile drawer non-focusable by splitting the desktop rail from the mobile drawer or gating `inert` with a media query; verify a keyboard test cannot reach drawer links while it is closed on desktop.
- [x] 8.4 Add icon + color status indicators for nodes, runs and health so status is not conveyed by color alone; verify tests assert an accessible status label and a visible icon.
- [x] 8.5 Add pressed feedback to buttons and respect reduced motion for press, pulse and smooth scroll; verify a test or CSS assertion covers the reduced-motion branch.
- [x] 8.6 Update `docs/ui-motion.md` with the press/focus additions and link it from `docs/design-standard.md`; verify the documentation matches the CSS tokens.
- [x] 8.7 Update the modal, layout, chat and page tests for focus and inert behavior; verify `bun test --cwd apps/web` passes.

## 9. Integration verification

- [ ] 9.1 Run `bun run typecheck` and `bun run build`; verify both exit successfully.
- [ ] 9.2 Run `bun test --cwd apps/web` and `bun run test`; verify all unit and component tests pass.
- [ ] 9.3 Run `bun run test:e2e` at the desktop viewport; verify the login, project shell, canvas, agent editor, chat, resources, orchestrator, settings and health flows pass.
- [ ] 9.4 Perform a manual desktop review at 1280×800 and 1440×900: brand, login, projects, canvas at the initial zoom, Agentes, Conocimiento, Recursos, Ajustes, Orquestador and Salud; verify no clipped tab labels, no unreadable node titles and no raw English statuses.
- [ ] 9.5 Run `grep` checks for `◆`, `href="data:,"`, `Hexagonal`, `Expandir chat`, `expanded` chat persistence and the retired surface hex values; verify no user-facing occurrence remains.
- [ ] 9.6 Confirm the diff contains no server, shared-contract, database, workflow-engine or mobile-layout changes; verify with `git diff --stat` and a path review.

## Workflow follow-up

- Create `change/add-brand-and-design-system` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan add-brand-and-design-system`.
- Create one atomic commit per numbered group: `<type>(add-brand-and-design-system): <summary>`.
- Push the branch and open a PR with `gh pr create`; report the URL and do not merge.
- Wait for human review and merge; archive only after the PR is merged.
