# apps/web/src/components — UI kit + workflow canvas

## OVERVIEW

Reusable UI plus the React Flow graph editor (`WorkflowCanvas` + `nodes/` + `canvas/`) — the app's densest UI area.
Earned its file: score 9 (33 files, 100% code, ~40 exports); distinct domain: the node-editor subsystem.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Canvas host | `WorkflowCanvas.tsx` (479 LOC) | registers exactly one node type and one edge type: `platform` |
| Node metadata | `nodes/node-catalog.ts` | `NODE_META`, `NODE_CATALOG`, `PALETTE_GROUPS`, `NODE_CATEGORY_COLORS` |
| Node visuals | `nodes/node-shapes.ts` `NODE_SHAPES` + `nodes/node-icons.tsx` `NodeIcon` | node box hardcoded 252×96 — WorkflowCanvas and PlatformNode must stay in sync |
| Node component | `nodes/PlatformNode.tsx` | toolbar + handles; reads `CanvasActionsContext` |
| Edge rendering | `PlatformEdge.tsx` | `PlatformFlowEdge` |
| Graph rules | `canvas/graph-edits.ts` (316 LOC) | pure functions: `getConnectionIssue`, `connectNodes`, `getGraphIssues`, `mapServerIssue` |
| Per-node-type forms | `NodeConfigFields.tsx` (654 LOC) | driven by `NODE_CONFIG_REGISTRY` from `@platform/shared` |
| Dot-path config edits | `config-field-utils.ts` | `getPath`/`setPath`; special-cased keys: `routing`, `allowlist`, `public`, `voiceReplies` |
| Inspector and palette | `NodeInspector.tsx`, `NodeInspectorModal.tsx`, `NodePaletteModal.tsx` | |
| Modal shell | `Modal.tsx` | portal to `document.body`, focus trap, `inert` on `#root`, Escape with 160 ms closing state |
| Canvas actions | `nodes/canvas-actions.ts` | `CanvasActionsContext` — nullable, tolerates a missing provider |
| Project panels | `Project*Panel.tsx` | Configuration, Settings, Resources, Knowledge, Destinations |
| Runs and chat | `RunDetailModal.tsx`, `RunLaunchModal.tsx`, `ChatPanel.tsx` | ChatPanel persists its surface to `chat-surface:<key>` |
| Shared kit | `Modal`, `StatusBadge`, `Layout`, `ErrorBoundary`, `Brand`, `NavIcon`, `AgentCatalog`, `AgentEditorModal`, `IntegrationEditor`, `CodeEditor`, `ControlChannelsPanel` | |

## CONVENTIONS

- The canvas owns no domain logic: `WorkflowCanvas` emits `onSelect/onChange/onConnect/onDeleteNode/...`; `src/pages/ProjectPage.tsx` performs the mutations.
- Node config validation always goes through `validateNodeConfig` from `@platform/shared` — zod lives in shared, never here.
- Adding a node config field means editing `NODE_CONFIG_REGISTRY` in `packages/shared/src/configuration.ts`, not this directory.
- Icons are inline SVG components; there is no icon package.

## ANTI-PATTERNS (enforced in `canvas/graph-edits.ts`)

- A flow needs exactly one `trigger` node; the trigger may not receive connections.
- No self-connections; no duplicate edges into the same target.
- `decision` nodes expose exactly one `true` + one `false` outgoing edge; every other node type has at most one outgoing edge.
- Cycles and nodes unreachable from the trigger are reported as graph issues.
