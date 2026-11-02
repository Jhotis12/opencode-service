# Tasks

## 1. Workspace shell and navigation

- [x] 1.1 Add a fluid project layout mode to `Layout.tsx` so `/projects/:slug` uses `h-dvh`/`min-h-0` without `max-w` or page padding. Verify with `bun run --cwd apps/web typecheck` and a component/E2E assertion that the canvas fills the remaining viewport.
- [x] 1.2 Add collapse/expand state to the global sidebar with `platform.nav.collapsed` persistence. Verify a component test toggles the rail, reloads the state initializer and restores the preference.
- [x] 1.3 Add inline SVG icons, accessible names/tooltips and keyboard focus for the collapsed rail, plus the narrow-viewport drawer with backdrop and close-on-navigation. Verify with Testing Library keyboard interaction tests.
- [x] 1.4 Extract `ProjectTopBar` with breadcrumb, tabs, dirty indicator, save/run/agent actions and a "Ajustes del flujo" popover for the default model and description. Verify with `apps/web/test/pages.test.tsx` and an E2E assertion that the actions remain reachable.
- [x] 1.5 Wrap the Agentes, Conocimiento, Recursos and Ajustes tab content in a centered readable-width container while leaving Canvas full-bleed. Verify with a component test or E2E check at a wide viewport.

## 2. Type-specific node shapes

- [x] 2.1 Add a shared shape mapping/helper keyed by `NodeType` and expose `data-node-shape` on the node wrapper. Verify with a unit test covering all nine types.
- [x] 2.2 Rework `PlatformNode.tsx` into an unclipped wrapper plus clipped border/surface layers so handles, selection, status dots and focus remain visible. Verify a component test renders every shape and finds its handles and status indicator.
- [x] 2.3 Position the decision true/false handles and labels on the shaped silhouette instead of the wrapper's right edge. Verify a component test for both handles and a visual check at 100% zoom.
- [x] 2.4 Ensure node labels, type names, subtitles and long text truncate without breaking the silhouette. Verify with component tests using a long label and the existing canvas test fixtures.

## 3. Overlay node palette

- [x] 3.1 Extend `Modal.tsx` with a wide-size option and an accessible title label without changing the existing focus/Escape behavior. Verify existing modal-related tests still pass and the new size renders.
- [x] 3.2 Create `NodePaletteModal` with search by title/category/description, grouped results, empty state, shape preview, and a disabled trigger entry when a trigger already exists. Verify with Testing Library tests for search, empty results and the disabled reason.
- [x] 3.3 Wire the palette to add a node at a predictable position, remove the implicit auto-connect, select the new node and open its inspector. Verify with a component test and an E2E add-node flow.
- [x] 3.4 Remove the permanent inline palette and its layout column from `ProjectPage.tsx`, keeping `PALETTE_GROUPS`/`NODE_META` as the shared catalog. Verify with `grep` that no inline palette remains and `bun run --cwd apps/web typecheck` passes.

## 4. Node inspector modal

- [x] 4.1 Create `NodeInspectorModal` with Settings, Connections and Execution tabs, reusing `NodeInspector` for the per-type settings and code editor. Verify with component tests that each tab renders the expected controls.
- [x] 4.2 Implement click-to-open with drag suppression using React Flow drag events and a movement threshold. Verify a component test opens on click, and an E2E drag test moves the node without opening the modal.
- [x] 4.3 Move the existing latest-run status, duration, input, output, logs, model and agent into the Execution tab. Verify with a component test using a node that has a last step and one without a step.
- [x] 4.4 Add modal header actions for duplicate, connect, delete and close, including duplicate code-file creation through the existing `api.writeNode` call. Verify with component tests for open/close, duplicate and delete.
- [x] 4.5 Add `NodeToolbar` quick actions above the selected node (duplicate, connect, delete). Verify with a component test that the toolbar appears for a selected node and its actions call the expected handlers.
- [x] 4.6 Remove the bottom `NodeInspector` rendering and verify opening/closing the modal preserves unsaved graph edits and clears selection. Verify with a component test and the updated E2E canvas flow.

## 5. Graph editing helpers and validation

- [x] 5.1 Implement `getConnectionIssue` and `connectNodes` for self-loops, trigger targets, cycles, non-decision outgoing replacement, decision true/false branches and allowed merges. Verify with unit tests for every rule.
- [x] 5.2 Implement `getGraphIssues` for duplicate triggers, unsupported trigger kinds, incomplete decisions, unreachable nodes, cycles and dangling edges. Verify with unit tests for each issue and a clean-graph case.
- [x] 5.3 Persist node removals from React Flow `onNodesChange` and keyboard deletion by calling `onChange`. Verify a component test deletes a node, saves the graph and reloads it without the node.
- [x] 5.4 Add edge selection with a larger interaction width, `EdgeToolbar` delete, and a `sí`/`no` condition selector for decision edges. Verify with component tests for delete and condition changes, including duplicate-condition protection.
- [x] 5.5 Map `INVALID_WORKFLOW` server issues to affected nodes/edges where possible and show a dismissible banner for the full list. Verify with a mocked API error test and an unmapped-issue case.

## 6. Click-based connection flow

- [x] 6.1 Build the Connections tab target picker with valid targets, disabled invalid targets and reasons, the decision branch selector, replace confirmation and merge display for incoming edges. Verify with component tests for valid, invalid and replacement cases.
- [x] 6.2 Add on-canvas connect mode from the toolbar/inspector: highlight valid targets, dim others, show the cancel hint, handle Escape and create the edge on target click. Verify with a component test and an E2E connection flow.
- [x] 6.3 Route handle-drag `onConnect` through the same validation helper so drag and click cannot create different graphs. Verify with a unit/component test for a rejected drag and an accepted drag.
- [x] 6.4 Keep node selection and live status stable when the graph is re-synchronized after a drag, edge change or SSE update. Verify a component test that selection survives a graph update and a status change renders on the shaped node.

## 7. Integration and final verification

- [x] 7.1 Update `e2e/platform.spec.ts` for the modal palette and inspector, including opening the palette before selecting `Código`, closing the inspector and re-saving the renamed node. Verify with `bun run build && bun run test:e2e`.
- [x] 7.2 Add E2E coverage for sidebar collapse persistence, connecting a node without handle dragging, deleting an edge and the `data-node-shape` attributes. Verify with the same E2E command.
- [x] 7.3 Verify the full workspace: `bun run typecheck`, `bun run test` and `bun run build` all pass.
- [x] 7.4 Perform a visual check at 1366x768 and 1920x1080: canvas fills the viewport, modals fit, Monaco has usable height and every shape keeps its handles/status visible. Record the observed result in the apply summary.
- [x] 7.5 Confirm the change is frontend-only: `git diff --stat` shows no edits under `apps/server`, `packages/shared`, `packages/opencode-plugin` or dependency manifests.

## Workflow follow-up

- Archive the change after review and implementation are complete.
- Verify the archived spec delta replaces the removed inspector requirement and adds the new canvas requirements without duplicate entries.
