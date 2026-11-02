# Design

## Context

See `proposal.md` - Why. The current editor is a React Flow canvas owned by `ProjectPage`:

- `ProjectPage.tsx` keeps the `WorkflowGraph`, `selectedId`, dirty state and save mutation. It also owns the inline palette, the bottom `NodeInspector` and the canvas height calculation.
- `WorkflowCanvas.tsx` converts the graph to React Flow nodes/edges, keeps local `useNodesState`/`useEdgesState`, and persists edge removals but not node removals.
- `PlatformNode.tsx` renders every non-trigger type as the same card; only trigger, decision and approval have small visual differences.
- `Layout.tsx` owns the 240 px sidebar and the `max-w-[1500px]` padded main area.
- `NodeInspector.tsx` already contains the complete per-type settings form and the latest execution context. `Modal.tsx` already handles Escape, backdrop close and initial focus.
- `@xyflow/react` v12 already exposes `NodeToolbar`, `EdgeToolbar`, `Panel`, `useReactFlow` and `screenToFlowPosition`; no dependency is needed.

The server graph contract is fixed: one trigger, one outgoing edge for non-decision nodes, exactly two true/false edges for decisions, no cycles or self-loops, and every node reachable from the trigger. Multiple incoming edges are allowed. This change only adds client-side affordances and validation feedback; the engine, `workflow.json` schema and API remain unchanged. See the delta spec in `specs/workflow-and-workspace-engine/spec.md`.

## Goals / Non-Goals

**Goals:**

- Recover the full viewport for the canvas and make navigation/top-bar chrome compact.
- Make the palette and node options overlay modals that do not permanently consume canvas space.
- Give each node type a recognizable silhouette without sacrificing labels, status or handles.
- Let users create, replace, merge, edit and delete connections without precise handle dragging.
- Keep the client consistent with the existing server graph rules and surface errors before/around save.
- Preserve existing per-type settings, agent/chat actions, run status and unsaved-edit behavior.

**Non-Goals:**

- No execution-engine, scheduler, `workflow.json` schema, server route or dependency changes.
- No isolated single-node execution.
- No general DAG fan-out, parallel branches, loops or synchronized joins.
- No undo/redo history; a duplicate and delete action is enough for this iteration.
- No change to SSE merge/overwrite semantics between the agent and the client.

## Decisions

### 1. Route-level fluid shell instead of negative margins

`Layout` gains a fluid mode for project routes (detected by `useLocation` or an explicit layout prop). In fluid mode the render tree becomes:

```text
+------+-------------------------------------------------------------+
| rail | ProjectTopBar: breadcrumb | tabs | dirty | save | run | agent|
|      +-------------------------------------------------------------+
|      | CanvasWorkspace: flex-1 min-h-0, no max-width, no padding   |
+------+-------------------------------------------------------------+
```

The project page itself decides which tabs are full-bleed. Canvas uses `h-dvh` with a `100vh` fallback, `min-h-0`, and `overflow-hidden`; Agentes, Conocimiento, Recursos and Ajustes get a centered `max-w` wrapper. This keeps the change local to `Layout` and `ProjectPage` without restructuring the router.

**Alternative considered:** negative margins on the project page. Rejected because it fights the layout, breaks scroll behavior and leaks the full-bleed treatment into unrelated pages.

### 2. Collapsible navigation as a persisted React state

The sidebar has two widths: 240 px expanded and 64 px icon rail. The collapsed state is lazy-initialized from `localStorage` (`platform.nav.collapsed`) and written on toggle. Collapsed destinations keep `aria-label`, a visible tooltip/title and keyboard focus. On narrow viewports the same state becomes an overlay drawer with a backdrop and closes on navigation.

**Alternative considered:** a CSS-only checkbox/details element. Rejected because focus management, tooltips and persisted state are clearer with React, and the app already uses React state for all navigation.

Navigation icons are inline SVGs in the existing icon style; no icon package is added. The logo collapses to its diamond mark.

### 3. Project top bar extracted from the page header

Create `ProjectTopBar` with three zones:

- Left: back-to-projects link, project name/breadcrumb.
- Center: the existing project tabs (Canvas, Ejecuciones, Agentes, Conocimiento, Recursos, Ajustes), horizontally scrollable on narrow screens.
- Right: dirty indicator, save, run and agent actions. The default-model selector and project description move into a small "Ajustes del flujo" popover/modal opened from the top bar.

The top bar is the only project chrome allowed to consume vertical space; it should stay around 56-64 px. `ProjectPage` keeps the mutation handlers and passes them down.

**Alternative considered:** keep the current header and just reduce padding. Rejected because the title, description, model selector and actions still wrap into multiple rows on smaller screens.

### 4. Palette modal with explicit placement

Reuse `Modal` with a new `size`/`className` variant (wide) for the palette. It contains:

- A search input filtering by node title, category and description.
- Category groups from the existing `PALETTE_GROUPS`/`NODE_META` data.
- A shape preview using the same shape mapping as `PlatformNode`.
- A disabled trigger entry with the existing "only one trigger" explanation when a trigger already exists.

Adding a node no longer creates an implicit edge. The current `addNode` picks a source and connects automatically; that hidden behavior is removed. The new node is placed near the selected node (or in the next free grid position), selected, and the inspector opens on Settings so the user can configure it. If no valid position can be derived, use the existing default grid formula.

**Alternative considered:** keep auto-connect from the selected node. Rejected because it silently creates edges the user did not ask for and makes the new explicit connection flow inconsistent.

### 5. Inspector modal reusing `NodeInspector`

`NodeInspector` remains the settings content component; a new `NodeInspectorModal` wraps it with a wide modal, a header (node icon, label, type, last status) and three tabs:

- **Settings**: the existing per-type fields, timeout/retries and code editor.
- **Connections**: incoming edges, outgoing edges, add/replace connection, branch selector for decisions, delete edge.
- **Execution**: the existing latest-run status, duration, input, output, logs, model and agent; no new execution endpoint.

Header actions: duplicate, connect, delete, close. Closing keeps `graph` state untouched and clears `selectedId`.

Click vs drag: React Flow's `onNodeDragStart`/`onNodeDragStop` set a short-lived "dragged" ref; `onNodeClick` opens the modal only when the pointer did not move beyond the drag threshold. The node toolbar (`NodeToolbar`) remains available for hover/selection quick actions and does not require opening the modal. The existing `Modal` focus/Escape behavior is reused; the panel gets an accessible label for the node.

**Alternative considered:** double-click opens the modal. Rejected because the user explicitly asked for click-to-open; the drag threshold preserves repositioning.

### 6. Shape language with a shared wrapper

Every node keeps a wrapper that is not clipped; the visible surface and border layer are clipped inside it. Handles and the status indicator live on the wrapper so `clip-path` cannot hide them. Selection and focus use the border layer, not a clipped `ring`.

Base footprint is approximately 240 x 88 px. The shape mapping:

| Type | Shape | Implementation sketch |
|---|---|---|
| trigger | stadium | `border-radius: 999px` |
| http | rounded card | `border-radius: 14px` |
| code | notched card | `clip-path` with cut top-right and bottom-left corners |
| transform | tag/arrow | flat left side, pointed right side |
| delay | D-shape | flat left side, semicircular right side |
| validate | octagon | cut corners, flat left/right midpoints |
| agent | hexagon | flat top/bottom, pointed left/right |
| decision | flattened diamond | pointed left/right, cut top/bottom corners |
| approval | shield | flat top/sides, pointed bottom |

Implementation uses a wrapper with `data-node-shape={nodeType}` for tests, an outer colored silhouette layer and an inset dark surface (both with the same clip path) so the border follows the shape. A wrapper `filter: drop-shadow(...)` provides depth. Decision branch handles are positioned on the upper-right and lower-right cut edges (not at the wrapper's right edge), and the "sí"/"no" labels sit next to those handles. If a label is longer than the available center, it truncates with a title; the type name and icon remain visible.

**Alternative considered:** SVG paths with `foreignObject` for content. Rejected because text measurement, code editor sizing and React Flow's node measurement become harder; CSS shapes on a fixed footprint are enough.

### 7. Connection model and click-based editing

Add a pure client helper (for example `apps/web/src/components/canvas/graph-edits.ts`) with:

```ts
getConnectionIssue(graph, sourceId, targetId, condition?) : string | undefined
connectNodes(graph, sourceId, targetId, condition?) : WorkflowGraph
```

Rules mirrored from the server contract:

- No self-loop; no target that is the trigger.
- No target that would create a cycle (reachability from target back to source).
- A non-decision source with an existing outgoing edge requires an explicit replace.
- A decision source requires `true` or `false`; connecting an existing branch replaces that branch only.
- Multiple incoming edges are allowed (merge).
- The trigger can have one outgoing edge, like any non-decision node.
- Edge ids stay `edge-<random>` and each connection uses one stable id.

UI entry points:

1. **Inspector > Connections**: source node's outgoing edges, target picker listing valid nodes, disabled invalid nodes with the reason, branch chips for decisions, and delete buttons for incoming/outgoing edges.
2. **On-canvas connect mode**: launched from the node toolbar or the inspector; closes the modal, highlights valid targets with an outline and dims others, shows "Elige el destino · Esc para cancelar", and creates the edge on target click. Decision sources first show `sí`/`no` chips.
3. **Existing handle drag** remains as a power-user path and uses the same validation before `onConnect`.

Edges use `interactionWidth` for a larger hit area, a selected state, and `EdgeToolbar` for delete; decision edges expose a `sí`/`no` selector and keep `condition` as the persisted `"true"`/`"false"` value.

Node deletion is persisted by handling React Flow remove changes in `onNodesChange` and calling `onChange`. Duplicate clones the node with a new id and label suffix, offsets its position, and for code nodes writes a new code file through the existing `api.writeNode` client call before updating the graph.

### 8. Client validation and save feedback

Add a `getGraphIssues(graph)` helper that mirrors only the client-actionable rules: duplicate trigger, trigger kind unavailable, decision missing a branch, node without outgoing edge (except terminal nodes? every non-terminal node needs one; the server only requires reachability, so report only disconnected nodes), unreachable nodes, cycles, self-loops and edges pointing to missing nodes. Show a compact issue count in the top bar and inline markers on the affected nodes/edges. Do not duplicate the entire server validator; use the same helper for connection targets and a summary for save.

The save mutation keeps the server as authority. If the API returns `INVALID_WORKFLOW`, map the returned issue strings to node/edge ids with a best-effort parser and render them in a dismissible banner plus the inspector; unmapped issues remain in the banner. Do not silently swallow the error.

**Alternative considered:** disable Save whenever client validation fails. Rejected because users could create a valid intermediate state only after fixing a different node, and the server already rejects invalid graphs; a visible warning plus the server response is less trapping.

### 9. Testing strategy

- Unit tests for `getConnectionIssue`, `connectNodes`, `getGraphIssues`, duplicate-id generation and shape mapping.
- Component tests for palette search/disabled trigger, inspector tabs, click-vs-drag behavior, node keyboard deletion persistence, edge toolbar and connect mode.
- Update `e2e/platform.spec.ts` to open the palette before choosing `Código`, close the inspector modal, collapse/expand the sidebar and persist the preference, create a connection through the new flow, delete an edge, and confirm the node shapes' `data-node-shape` attributes.
- Keep the existing dark minimap/controls assertions and add canvas full-bleed/height assertions.

## Risks / Trade-offs

- **Clip-path can hide handles, focus rings or status dots** -> keep all interactive elements on the unclipped wrapper and test selection, focus and status on every shape.
- **Click opens the inspector, but dragging must not** -> use a drag threshold ref and cover it with both a component test and the e2e drag test; if the browser fires click after drag, suppress it explicitly.
- **Monaco inside a modal can render with zero height** -> give the editor tab a fixed/min height and keep the existing `CodeEditor`; verify at the modal's max height.
- **Full-bleed on mobile browser chrome** -> use `h-dvh` with a `100vh` fallback, `min-h-0` and explicit scroll containers; test at narrow widths.
- **Modal focus management** -> reuse the existing `Modal` focus/Escape implementation and add an accessible name per node; a full focus trap is out of scope but should be noted if keyboard testing exposes a problem.
- **No auto-connect after adding a node** -> the new node is visibly unconnected and the validation summary explains it; this is a deliberate trade-off for predictable edges.
- **Server issue strings may not carry ids** -> map what can be mapped and keep the full issue list visible; do not hide the server message.
- **Agent SSE updates can overwrite unsaved client edits** -> this pre-existing behavior is unchanged by this design; call it out during implementation and avoid making it worse by auto-saving or resetting the graph on every viewport change.
- **Existing e2e selectors assume a permanent palette and bottom inspector** -> update the spec together with the UI; do not leave both layouts in parallel.

## Migration Plan

No data or API migration is required. The change is limited to the web client, tests and the archived spec delta. Deploy the frontend with the existing server; rollback is a normal frontend revert. During rollout, keep the graph contract untouched so workflows saved before or after the redesign remain compatible.

## Open Questions

None that change the approach or task breakdown. The remaining details (exact color values, icon glyphs, shape base dimensions) are visual tuning and can be settled during implementation without changing the specs.
