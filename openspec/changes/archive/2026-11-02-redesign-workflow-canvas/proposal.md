# Proposal

## Why

The visual canvas is the primary place to understand a workflow, but it is currently cramped and hard to operate: every node type looks like the same rectangular card, connections are only discoverable through tiny drag handles, and the permanent palette plus the bottom inspector reduce the canvas to a fraction of the viewport. The agent can create, edit and join nodes by writing `workflow.json`, while a user cannot perform the same edits reliably from the client. This change gives the client editing parity and turns the canvas into a full-workspace editor without changing the execution engine.

## What Changes

- **Full-bleed project workspace**: the Canvas tab uses all available width and height. The global sidebar collapses to a 64 px icon rail (expandable, persisted), and the project gets a compact top bar for breadcrumb, tabs, save, run and agent actions.
- **Overlay modals**: the node palette and the node inspector move from permanent inline panels to fixed modals above the canvas. The inspector keeps the existing per-type settings and separates settings, connections and latest execution context into tabs.
- **Node shape language**: each node type gets a distinct silhouette (trigger/stadium, code/notched card, transform/trapezoid, delay/D-shape, validate/octagon, agent/hexagon, decision/diamond, approval/shield) on a shared footprint, while preserving icon, color, labels and live run status.
- **Client graph editing parity**: users can select a node and connect it to a valid target by clicking instead of dragging handles; decision nodes expose explicit `true`/`false` branch actions; edges can be selected, relabeled for decisions and deleted; node deletion via keyboard is persisted; nodes can be duplicated.
- **Connection guidance**: interactive targets are filtered by the existing graph rules (one trigger, one outgoing edge for non-decision nodes, exactly two branches for decisions, no cycles, no self-loops, all nodes reachable). Invalid targets are disabled with an explanation, and save-time validation errors are shown against the affected node or edge.
- **Tests and specs updated** for the new modal and connection flows, including the existing end-to-end canvas scenario.
- **BREAKING (UI)**: the bottom node inspector is replaced by a modal, and the always-visible palette is replaced by a modal. No API, schema or execution behavior changes.

### Out of scope

- Any change to the workflow execution engine, scheduler, graph schema (`workflow.json`), server validation, or node runtime.
- Fan-out/parallel execution, general DAG scheduling, loops, or joins with synchronization semantics.
- Isolated single-node test execution and its backend endpoint.
- New dependencies; shapes and controls are implemented with CSS/SVG and the existing React Flow API.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workflow-and-workspace-engine`: replaces the bottom-inspector and always-visible-palette requirements with an overlay-modal workspace, and adds requirements for type-specific node shapes and click-based graph editing/connection parity.

## Impact

- **Web UI**: `apps/web/src/pages/ProjectPage.tsx`, `apps/web/src/components/WorkflowCanvas.tsx`, `apps/web/src/components/nodes/PlatformNode.tsx`, `apps/web/src/components/NodeInspector.tsx`, `apps/web/src/components/Layout.tsx`, `apps/web/src/components/Modal.tsx`, `apps/web/src/ui.ts`, `apps/web/src/index.css`.
- **Tests**: `apps/web/test/ui.test.tsx`, `apps/web/test/pages.test.tsx`, `e2e/platform.spec.ts` and any selectors affected by the modal palette/inspector.
- **Specs**: delta for `workflow-and-workspace-engine`.
- **Unchanged**: server routes, `packages/shared` schemas, execution engine, persistence, dependencies.
