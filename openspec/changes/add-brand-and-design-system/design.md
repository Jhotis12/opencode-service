# Design

## Context

See `proposal.md` — Why. The current web client is a Vite + React 19 + Tailwind 4 application with a dark slate palette, inline SVG icons, React Flow canvas and a modal system. The desktop screenshots used for this change show:

- The canvas opens at `scale(0.5556)` on 1440×900 and `scale(0.25)` at narrow widths; a 13 px node title renders at 7.2 px and 3.25 px respectively.
- At 1440 px the project top bar has enough room for the tabs at scroll-start, but activating a later tab scrolls the strip and hides earlier labels; at narrow widths only `Canvas` is visible and the header grows to 137 px.
- The Agentes tab is a two-column card list followed by a long inline form; raw `subagent` / `primary` labels are visible.
- The chat has a `docked` / `expanded` / `minimized` state machine; the `expanded` state duplicates the lateral project drawer and is the "maximizar" behavior this change removes.
- Statuses such as `ok`, `connected`, `succeeded`, `subagent` and raw server errors appear in English across health, resources and agents.
- The brand is a `◆` text glyph repeated in the shell, login, chat bubble and an empty favicon.

Constraints:

- Desktop-first: acceptance at 1280×800 and 1440×900. Mobile is not redesigned; existing mobile behavior is not an acceptance target.
- No server, API, workflow schema, agent runtime or persistence changes.
- The existing motion standard in `docs/ui-motion.md` remains authoritative for timing and easing; this design extends it.
- The mark must be original and must not copy or redraw the official OpenCode logo.

## Goals / Non-Goals

**Goals:**

- One brand system: mark, wordmark, favicon, usage rules and a shared component.
- One token vocabulary for surfaces, text, brand, agent, status and node categories.
- A desktop shell and canvas that are readable at first paint.
- A polished agent catalog and focused editor.
- A simpler chat without the expanded state.
- Localized, accessible and consistent states and copy.

**Non-Goals:**

- Mobile layout redesign, mobile breakpoints or touch-first navigation.
- New agent runtime features, workflow behavior or backend endpoints.
- A custom icon library; existing inline SVG icons remain.
- A full marketing identity (stationery, social templates, open-graph art).
- Copying the OpenCode brand or implying endorsement.

## Decisions

### 1. Brand mark: "Nodo abierto"

The mark is an original 24×24 SVG built from three ideas: an open square “O” (OpenCode/openness), a filled node that completes the circuit (agent), and a terminal caret (code). The square has a gap on its upper-right edge; the node sits in the gap; the caret sits inside the square.

```text
      +-----------+
      |           |
      |     >     |
      |           |
      +-------+   |
              |   |
              o---+
```

- **Primary mark**: open square + node + caret. Used at 24–40 px.
- **Compact mark**: open square + node, no caret. Used for the 16 px favicon and the collapsed rail if the caret becomes noisy.
- **Monochrome mark**: one `currentColor`; used in contexts where the accent is unavailable.
- **Lockup**: mark + HTML wordmark `Agentic Platform` + descriptor `Automatizaciones agénticas sobre OpenCode`. The wordmark stays as HTML text so it remains selectable and uses the loaded font; the standalone SVG is the mark, not a text path.
- **Placement**: sidebar expanded (mark 32 px + wordmark), sidebar collapsed (mark 28–32 px, accessible name), mobile header (mark 24 px + wordmark), login (mark 40 px + wordmark), minimized chat bubble (mark 16–18 px), favicon (16/32 px).

The app will use an inline `BrandMark` component so `currentColor` and the accent token work on both dark and light surfaces. `apps/web/public/brand/agentic-mark.svg` is the canonical standalone asset for docs and external use; `apps/web/public/favicon.svg` is the compact variant. A dark/light pair is provided for contexts that cannot use `currentColor`. The mark keeps 0.5× its height as clear space and is never rotated, stretched, given a gradient or placed inside another shape.

**Alternatives considered:** a hexagon with a caret (too close to a generic AI badge and less connected to OpenCode); a multi-node loop (illegible at 16 px); keeping the diamond (no product meaning and no relationship to agents).

### 2. Tokens: small vocabulary, semantic roles

Keep the existing short token names already used by Tailwind (`ink`, `panel`, `panel-2`, `line`, `muted`, `accent`, `violet`) and add the missing roles. This avoids a risky mass rename while making every hard-coded surface replaceable.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| App background | `--color-ink` | `#070B14` | body |
| Panel | `--color-panel` | `#0D1424` | cards, modals |
| Raised/selected | `--color-panel-2` | `#111A2E` | tabs, selected rows |
| Input/code well | `--color-well` | `#0A1120` | inputs, code, nested panels |
| Code darkest | `--color-code` | `#050A13` | `<pre>` |
| Border | `--color-line` | `#1E293B` | default |
| Strong border | `--color-line-strong` | `#334155` | hover/selected |
| Text | `--color-text` | `#E2E8F0` | primary |
| Muted | `--color-muted` | `#94A3B8` | secondary |
| Faint | `--color-faint` | `#64748B` | decorative only, never body |
| Brand | `--color-accent` | `#38BDF8` | primary action, current |
| Brand strong | `--color-accent-strong` | `#0EA5E9` | hover/pressed |
| Agent | `--color-violet` | `#A78BFA` | agents/AI |
| Success | `--color-ok` | `#22C55E` | success |
| Warning | `--color-warn` | `#F59E0B` | warning/attention |
| Danger | `--color-danger` | `#FB7185` | error/destructive |
| Node input | `--color-node-input` | `#FBBF24` | trigger |
| Node action | `--color-node-action` | `#22D3EE` | HTTP, code, transform, delay |
| Node logic | `--color-node-logic` | `#2DD4BF` | validate, decision |
| Node AI | `--color-node-ai` | `#A78BFA` | agent |
| Node human | `--color-node-human` | `#F472B6` | approval |

Rules:

- Status colors are only for status badges, dots, alerts and progress. They are never used as node-category fills.
- Node-category colors are only for node borders, icon chips and edge accents. They are never used as status colors.
- Every status indicator includes text or an icon; color is not the only signal.
- The `running` state uses `accent`/info; `warning` is reserved for `degraded`, `paused`, `needs_config` and `qr_pending`.
- Hard-coded `#0b1220`, `#080f1c`, `#020617`, `#0f172a`, `#475569` and similar values in components are replaced by `panel`, `well`, `line`, `line-strong` or `muted`.

### 3. Typography: bundle Inter, compact scale

Use `@fontsource-variable/inter` and import the Latin subset in `main.tsx` or `index.css`; no runtime font request to a third party. Fallback remains `system-ui, sans-serif`. This is one client dependency for a deterministic product-wide font.

| Role | Size / line | Weight | Use |
| --- | --- | --- | --- |
| Micro | 11 / 14 | 500 | badges, metadata, node category/subtitle |
| Label | 12 / 16 | 500 | form labels, tabs, captions |
| Body | 14 / 20 | 400 | body, controls, forms |
| Section | 16 / 24 | 600 | card and panel titles |
| Page | 24 / 32 | 600 | page titles |
| Display | 30 / 36 | 600 | login and large empty states |

- No text below 11 px. The only exception is an uppercase tracked micro-label at 11 px, never 9–10 px.
- Node title: 14 px; node category and subtitle: 11 px. Increase the node footprint from 240×88 to approximately 252×96 to keep the three lines readable without clipping.
- Metrics and durations use `font-variant-numeric: tabular-nums`.
- Long model IDs, agent paths and slugs use `truncate` plus `title`, or a bounded code block with `break-all`; they never change card height.

### 4. Desktop shell and project top bar

The top bar is one row at desktop widths. Structure:

```text
+--------------------------------------------------------------------------------+
| <- Proyectos / Project name | Canvas  Ejecuciones  Agentes  Conocimiento ... |  |
|                             |                                                  |  |
|                             | dirty  [Guardar] [Ejecutar] [Agente] [ ... ]    |  |
+--------------------------------------------------------------------------------+
```

- Left: back link, project name (max 240 px, truncates with title), slug only on very wide screens.
- Center: tab strip with `overflow-x-auto`; a left/right fade indicates hidden tabs; the active tab scrolls fully into view and keeps its neighbors visible when possible.
- Right: unsaved dot (with `aria-label`/tooltip), Save, Run, Agent and a `...` overflow menu. Versiones and Ajustes del flujo move into the overflow menu.
- The overflow menu is an anchored popover with `role="menu"`, keyboard traversal, Escape and click-outside close. It does not use a full modal.
- At 1280 px and 1440 px all six tabs fit in one row; the project name truncates before any tab label is clipped.
- Below 1280 px the existing wrap/scroll behavior may remain; it is not redesigned. Mobile is out of scope.

### 5. Canvas: readable initial viewport

Replace the automatic full-graph fit with an intentional initial viewport:

1. Compute whether the graph fits at `zoom >= 0.8`.
2. If it fits, call `fitView({ padding: 0.2, minZoom: 0.8 })`.
3. If it does not fit, set the viewport centered on the trigger at `zoom = 0.8` (or the nearest readable zoom if the graph has a huge node footprint).
4. Add an explicit `Ajustar vista` button next to `+ Nodo` that calls `fitView({ padding: 0.2, minZoom: 0.25 })` for the full overview.
5. Do not re-fit on every graph update. Fit on project change/first load only; keep the user's viewport while nodes update from SSE or edits.
6. Keep `minZoom={0.25}` so the user may explicitly zoom out; the minimap remains the overview.

The initial view should show roughly four to five nodes at 1440 px, with the trigger visible and legible. Panning is expected; unreadable labels are not. The `fitView` prop on `ReactFlow` is removed in favor of an explicit initial viewport effect.

**Alternative considered:** keep the full-graph fit and increase node text. Rejected because fitting a 2,000 px graph into 1,200 px still halves the text; the canvas needs a legible viewport, not a smaller overview.

### 6. Agent catalog

Extract the Agentes tab into `AgentCatalog.tsx` and `AgentEditorModal.tsx`; `ProjectPage` keeps the `agents` query and passes the data. The existing `upsertAgent` and `deleteAgent` mutations move into the catalog module; behavior and API calls stay the same.

**Catalog:**

- Header: title `Agentes`, one-line explanation and `Nuevo agente` primary action.
- Grid: `md:grid-cols-2 xl:grid-cols-3`, cards with a monogram/avatar derived from category/role, category/role title, localized mode badge, description, model, notebook chips and denied-tool count.
- Primary agent: first card, violet accent border/icon, `Principal` badge, edit action only. The UI must not offer delete for the primary agent.
- Sub-agent cards: edit and delete; delete opens a `sm` confirmation modal with the agent path and a danger confirm action.
- Empty state when there are no sub-agents: explanation plus `Crear sub-agente`; the primary agent remains visible.
- Long values truncate with `title`; the card height stays stable.

**Editor:**

- `Modal size="lg"` (or `xl` if the instructions field needs more room) opened from `Nuevo agente` or `Editar`.
- Sections: `Identidad` (categoría, rol, descripción), `Comportamiento` (modo, instrucciones `.md`), `Modelo y conocimiento` (modelo, notebooks), `Permisos` (herramientas bloqueadas).
- Helper text explains inherited model, notebook identifiers and denied tools.
- Save is disabled until category, role, description and instructions are present; saving keeps the modal open only long enough to show the result or closes and reports success in the catalog.
- Footer uses a sticky area inside the modal body so the save action is always reachable while the form scrolls.
- Cancel/Escape/backdrop close discards the draft and returns focus to the opening action.

**Alternatives considered:** keep the inline form and restyle it. Rejected because the page becomes a long form with no clear separation between browsing and editing; a focused modal matches the rest of the app and keeps the catalog scannable.

### 7. Chat: remove the expanded surface

`ChatPanel` becomes a two-state surface: `docked` and `minimized`.

- Remove `"expanded"` from `ChatSurface`, the `Expandir`/`Contraer` button, the expanded panel class, the Escape-to-dock handler, the persisted expanded value and the `rows={expanded ? 4 : 3}` branch.
- Project chat: the lateral drawer owns the visible/hidden state; `onMinimize` closes the drawer. The panel header shows `Cerrar`.
- Orchestrator chat: remains docked in its aside; without `onMinimize` it can minimize to the fixed bubble and restore. The header shows `Minimizar`/`Restaurar`.
- Existing `localStorage` values of `"expanded"` are ignored and fall back to `"docked"`; no data migration is needed.
- Move the "Ir al último mensaje" control out of the message flow into a reserved right-aligned area above the composer; it uses a small pill (`border`, `panel-2`, 12 px text) and does not overlap messages. Hide it at the bottom.
- Respect reduced motion for `scrollIntoView`: use `behavior: "auto"` when `prefers-reduced-motion: reduce`.

This resolves the "maximizar" question: the expanded state was a second overlay on top of an already-modal drawer, so it is removed rather than restyled.

### 8. Status, copy and error mapping

Add a shared label map in `apps/web/src/ui.ts` (or a small `labels.ts`):

| Raw | Visible Spanish | Tone |
| --- | --- | --- |
| `queued` | En cola | neutral/info |
| `running` | En ejecución | info |
| `paused` | Pausado | warning |
| `succeeded` | Completado | success |
| `failed` | Fallido | danger |
| `timed_out` | Tiempo agotado | danger |
| `cancelled` | Cancelado | neutral |
| `skipped` | Omitido | neutral |
| `ok` | Operativo | success |
| `degraded` | Degradado | warning |
| `down` | Caído | danger |
| `connected` | Conectado | success |
| `needs_config` | Falta configurar | warning |
| `qr_pending` | QR pendiente | warning |
| `error` | Error | danger |
| `primary` | Principal | agent |
| `subagent` | Sub-agente | neutral |
| `all` | Principal y sub-agente | agent |

- `statusBadge(status)` renders the localized label and keeps the raw value in `title`/`aria-label`.
- Health and run error tables show a Spanish summary and put the raw technical message in a bounded code/detail area, not as the only readable text.
- Login maps `invalid username or password` to `Usuario o contraseña incorrectos`.
- Replace `OpenCode V2 · Hexagonal` with `Automatizaciones agénticas sobre OpenCode`.
- Remove the `🎉` from the health empty state; use a check icon and `Sin errores registrados.`

### 9. Accessibility implementation

- Add a global `:focus-visible` ring in `index.css` using `accent`; do not rely on the browser default.
- Add a skip link in `Layout` to `#main-content`; give `<main>` that id.
- Portal `Modal` to `document.body`, set `inert` on the app root while open, trap Tab within the dialog, focus the first meaningful control, restore focus on close and close on Escape/backdrop. This also fixes the node inspector and palette.
- Split the desktop navigation aside from the mobile drawer, or gate `inert` with a `matchMedia` hook, so the closed mobile drawer is not focusable while the desktop rail remains usable.
- Add pressed feedback to buttons (`active:scale-[0.97]`) and a focus-visible ring to buttons, links, tabs and icon-only controls.
- Add icon + text/aria state to status indicators; the node status dot becomes a small check/alert/spinner icon with an accessible label.
- Keep reduced-motion coverage for modals, drawers, status pulses and chat scrolling.

### 10. Design standard document

Add `docs/design-standard.md` as the source of truth for:

- Brand mark, lockup, favicon, clear space, minimum sizes and don'ts.
- Token table and the rule that status and category colors are separate.
- Type scale, node typography and numeric formatting.
- Spacing/radius scale: 4 px base, 8 px controls, 12 px cards, 16 px modals, full pills.
- Button/input/badge/tab/card/modal/alert/empty-state rules.
- Focus, press, hover, disabled and reduced-motion rules.
- Status/localization glossary and copy rules.
- Link to `docs/ui-motion.md` for timing/easing and to this change for the brand rationale.

The document is the review checklist for future UI changes; it does not replace the behavioral specs.

## Risks / Trade-offs

- **The 0.8 initial zoom hides part of a wide graph** → The trigger is visible, the minimap shows the whole graph, `Ajustar vista` is explicit, and panning is part of the canvas interaction. This is preferable to unreadable labels.
- **The overflow menu hides Versiones/Ajustes** → Use a labeled `...` control with an accessible name, a visible tooltip on first use and keyboard support; Save/Run/Agent stay direct.
- **Bundling Inter adds weight** → Import only the Latin variable subset and keep a system fallback; the product is Spanish-first.
- **The logo can read as a notification badge at 16 px** → Test the compact variant at 16/24/32 px; the node dot is part of the silhouette, not a status badge, and the mark is never placed next to a status dot in the same container.
- **Removing the expanded chat may surprise existing users** → The drawer already covers the viewport height and the close/minimize controls remain; document the removal in the PR and release notes. No conversation data is lost.
- **The agent editor is tall** → Use a scrollable body with a sticky footer and test at 800 px and 900 px viewport heights; keep the primary action reachable.
- **Modal portal and `inert` can break tests** → Update Testing Library queries to use `baseElement`/`document.body` where needed and keep the modal's accessible name stable.
- **Localized statuses can break existing tests and selectors** → Update tests to assert the Spanish label and keep raw values in `title`/`aria` for machine checks.
- **OpenCode brand terms** → The mark is original; the descriptor is textual and descriptive. If the project later needs the official OpenCode logo, review their brand guidelines separately.

## Migration Plan

1. Add the font dependency/assets and the token definitions; verify the app builds and the default screens render.
2. Add the brand component and SVG assets; replace the `◆` usages and favicon. No data migration.
3. Apply the desktop shell/top bar and canvas viewport changes. No persisted workflow data changes; existing graphs keep their node positions.
4. Extract the agent catalog and editor; the API contract and agent files are unchanged.
5. Simplify `ChatPanel`; ignore persisted `"expanded"` values and fall back to `"docked"`. No server/session migration.
6. Apply status localization and accessibility changes; update tests and docs.
7. Rollback is a frontend revert. There is no database migration; stored chat surface values are backward-compatible because unknown values fall back to `docked`.

## Open Questions

None that change the approach or task breakdown.

Assumptions recorded for review:

- "Maximizar" refers to the expanded chat surface (`Expandir`), not the operating-system window.
- The product name remains `Agentic Platform`; the descriptor is `Automatizaciones agénticas sobre OpenCode`.
- Acceptance is desktop-only at 1280×800 and 1440×900; mobile layout is not redesigned.
- The exact font package may be swapped for a self-hosted Inter Variable WOFF2 if the dependency is undesirable; the type scale and behavior stay the same.
