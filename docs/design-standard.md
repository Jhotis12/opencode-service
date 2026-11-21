# Agentic Platform — Design Standard

This document is the source of truth for the web interface. `docs/ui-motion.md`
covers timing, easing and modal behaviour; this document covers identity,
tokens, typography, components, accessibility and copy. The UI is accepted at
four viewports: 320×568 and 390×844 for phones, and 1280×800 and 1440×900 for
desktop. A screen is not done until it holds at all four; 320 px is the floor,
not a fallback.

## 1. Brand

- **Name:** Agentic Platform.
- **Descriptor (canonical):** Automatizaciones agénticas sobre OpenCode. The navigation uses
  the short form `Agentes sobre OpenCode`.
- **Mark:** "Nodo abierto", an original open square O with a filled node and a
  terminal caret. It references code, agents and OpenCode without copying the
  official OpenCode logo.
- **Assets:** `apps/web/public/brand/agentic-mark.svg` (dark surfaces),
  `agentic-mark-light.svg` (light surfaces), `agentic-mark-mono.svg`
  (`currentColor`) and `apps/web/public/favicon.svg`.
- **Component:** `apps/web/src/components/Brand.tsx` (`BrandMark`,
  `BrandLockup`). Do not inline a new copy of the mark.
- **Sizes:** mark 16–18 px in compact surfaces, 24 px in the mobile header,
  28–32 px in the navigation rail, 40 px on the login page.
- **Clear space:** at least 0.5× the mark height on every side.
- **Minimum size:** 16 px for the mark; the caret may be removed only in the
  compact favicon variant if it becomes noisy.
- **Don'ts:** do not rotate, stretch, gradient-fill, shadow, outline or place
  the mark inside another shape. Do not use the official OpenCode logo as the
  product mark. The OpenCode name is descriptive only.

## 2. Color tokens

Tokens live in `apps/web/src/index.css` under `@theme`.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| App background | `ink` | `#070B14` | body |
| Panel | `panel` | `#0D1424` | cards, modals |
| Raised/selected | `panel-2` | `#111A2E` | tabs, selected rows |
| Input/code well | `well` | `#0A1120` | inputs, code, nested panels |
| Code darkest | `code` | `#050A13` | `<pre>` |
| Border | `line` | `#1E293B` | default |
| Strong border | `line-strong` | `#334155` | hover/selected |
| Text primary | `slate-100` / `slate-200` | Tailwind | headings and body |
| Text muted | `muted` | `#94A3B8` | secondary |
| Text faint | `faint` | `#64748B` | decorative only |
| Brand | `accent` | `#38BDF8` | primary action, current |
| Brand strong | `accent-strong` | `#0EA5E9` | hover/pressed |
| Agent | `violet` | `#A78BFA` | agents/AI |
| Success | `ok` | `#22C55E` | success |
| Warning | `warn` | `#F59E0B` | attention |
| Danger | `danger` | `#FB7185` | error/destructive |
| Node input | `node-input` | `#FBBF24` | trigger |
| Node action | `node-action` | `#22D3EE` | HTTP, code, transform, delay |
| Node logic | `node-logic` | `#2DD4BF` | validate, decision |
| Node AI | `node-ai` | `#A78BFA` | agent |
| Node human | `node-human` | `#F472B6` | approval |

Rules:

- Status colors are only for status. Node-category colors are only for node
  accents. They never swap roles.
- Running uses the informational accent, not warning.
- A status must have text or an icon in addition to color.
- Components must not introduce page-local surface hex values. Use the tokens
  above.

## 3. Typography

Bundled font: `Inter Variable` from `@fontsource-variable/inter`, with a system
fallback. Code uses `--font-mono`.

| Role | Size / line | Use |
| --- | --- | --- |
| Micro | 11 / 14 | badges, metadata, node category and subtitle |
| Label | 12 / 16 | form labels, tabs, captions |
| Body | 14 / 20 | body, controls, forms |
| Section | 16 / 24 | card and panel titles |
| Page | 24 / 32 | page titles |
| Display | 30 / 36 | login and large empty states |

- No text below 11 px. The only micro-label is 11 px uppercase with tracking.
- Node title: 14 px; node category and subtitle: 11 px.
- Use `tabular-nums` for metrics, durations and counters.
- Long IDs, model names, slugs and agent paths truncate with a `title` or wrap
  inside a bounded code area. They never change card height.

## 4. Spacing and shape

- Base unit: 4 px. Use 4, 8, 12, 16, 20, 24, 32.
- Page padding: 20 px compact, 32 px desktop.
- Card padding: 20 px. Card gap: 12–16 px.
- Controls: 40 px height, 8 px radius.
- Cards: 12 px radius.
- Modals: 16 px radius.
- Pills and badges: full radius.
- Icon-only controls: at least 28 px, preferably 32 px on desktop.

### Responsive rules

- Acceptance viewports: 320×568, 390×844, 1280×800 and 1440×900. At 320 the
  page never scrolls horizontally: `documentElement.scrollWidth` stays within the
  viewport and every primary action stays reachable. Pinned today by
  `test/global-runs.test.tsx`, `test/health.test.tsx` and
  `test/canvas-ui.test.tsx` at 320 and 390; `test/auth-pages.test.tsx` pins the
  dynamic viewport height and the scrollable form.
- 640 px (`sm`) is the surface breakpoint. Below it a `Modal` is a bottom sheet
  (full width, top corners only, `max-h-[92dvh]`), the project top bar stacks,
  the canvas switches to narrow chrome and `Select` uses its sheet. At 640 px
  and wider, dialogs are centered and the picker uses its popover.
- There is exactly one picker breakpoint: `PICKER_SHEET_QUERY =
  "(max-width: 639px)"` in `components/Select.tsx`. `WorkflowCanvas.PHONE_QUERY`,
  `RunsTable.NARROW_TABLE_QUERY` and the CSS twin in `index.css` repeat the same
  value for their own surfaces; do not add a second one.
- The mobile navigation drawer is the rail below 1024 px; it is off-screen and
  inert while closed and slides over the content.

## 5. Components

### Shared primitives

These primitives are shared by every screen. They live in
`apps/web/src/components/`; compose them instead of rebuilding the same markup,
because they carry the tokens and the accessibility wiring. The props below are
the contract — do not invent extras.

| Primitive | File | Props | Use when |
| --- | --- | --- | --- |
| `PageHeader` | `apps/web/src/components/PageHeader.tsx` | `title`, `description?`, `actions?`, `breadcrumbs?` | top of every page: title, optional description, breadcrumbs and page-level actions |
| `EmptyState` | `apps/web/src/components/EmptyState.tsx` | `icon`, `title`, `description`, `action?` | a list or panel has zero items: icon, short explanation and one next action |
| `Skeleton` | `apps/web/src/components/Skeleton.tsx` | `shape?` (`line` \| `block` \| `circle`), `size?` (`sm` \| `md` \| `lg`), `className?` | loading placeholders shaped like the final content |
| `ConfirmDialog` | `apps/web/src/components/ConfirmDialog.tsx` | `title`, `children`, `confirmLabel`, `cancelLabel?`, `confirmationText?`, `confirmationLabel?`, `pending?`, `onCancel`, `onConfirm` | destructive or irreversible confirmations; typed `confirmationText` guards the risky ones and `pending` disables confirm while the action runs |
| `Field` | `apps/web/src/components/Field.tsx` | `id`, `label`, `hint?`, `error?`, `children` | every form control: wraps one control and wires `id`, `aria-describedby`, `aria-invalid` |
| `Tabs` | `apps/web/src/components/Tabs.tsx` | `items` (`id`, `label`, `content`, `disabled?`), `value?`, `defaultValue?`, `onValueChange?`, `aria-label` | sibling sections inside one page; roving tabindex with Arrow/Home/End keys |

The pickers (`Select` and `MultiSelect`) are shared controls too; their
contract is in *Select and combobox* below.

### Buttons

Primary, secondary, ghost and danger variants. Every button has hover,
pressed (`active:scale-[0.97]`), disabled and `focus-visible` states. Icon-only
buttons need an accessible name and a tooltip/title.

### Inputs

Label above the control, helper or error below. Use the `well` surface, `line`
border and the accent focus ring. Placeholder contrast must remain readable.
Every form control goes inside `Field`, which wires `id`, `aria-describedby`,
`aria-invalid` and the error message.

### Select and combobox

`Select` (`apps/web/src/components/Select.tsx`) and `MultiSelect.tsx` are the
only pickers. A native `<select>` is forbidden and the conformance scanner
fails any `.tsx` under `apps/web/src` that contains one
(`test/design-conformance.test.ts`, rule `native-select`, no allowlist).

- **Trigger.** `Select` renders a `button` with `role="combobox"`, or a text
  `input` with the same role when `searchable`. Both expose
  `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls` while open and
  `aria-activedescendant` pointing at the keyboard-active row. The label, helper
  and error come from `Field` when an `id` is passed; standalone, `Select`
  renders its own. `MultiSelect` renders one chip per value (truncated, with a
  `Quitar {label}` remove button) and a chevron button named `Añadir {label}`;
  its search field inside the panel is the `combobox`.
- **Surface.** At 640 px and wider the list opens in the shared `Popover`: a portal at
  `position: fixed`, 240–480 px wide, clamped 8 px from the viewport edges,
  flipped above the trigger when less than 240 px remain below, and capped at
  360 px high. The popover is the one non-modal overlay: it does not trap focus
  or inert the page, and it closes on outside pointer-down, focus leaving,
  outside scroll, resize, Escape (the event is stopped so a dialog behind stays
  open) and Tab. Below 640 px `Select` swaps to `SelectSheet`, a `Modal`
  that contains the very same listbox; the sheet traps focus, owns the title and
  an optional search field, and returns focus to the trigger. `MultiSelect`
  stays a popover.
- **Order.** Pinned rows render first, then the empty/inherit row (`value: ""`),
  then groups in first-appearance order, then ungrouped rows. Pinned rows are the
  transient custom row and a saved value the catalogue no longer offers; when
  either exists it precedes the empty row and takes the default active row, so
  the empty row leads the keyboard order only when nothing is pinned. `emptyValue`
  decides what committing it emits: `""` or `undefined`, and each call site
  declares it.
- **Saved values.** A value the catalogue no longer offers stays on the trigger
  as its raw string and is pinned as the first row with a muted
  `(no disponible)` suffix; it remains selected and re-emits unchanged.
  `MultiSelect` shows the same raw string as the chip label.
- **Filtering.** `searchable` makes the trigger a filter input. The default
  filter matches label, description, value and `keywords`, case- and
  accent-insensitive. No matches shows `noResultsLabel` (default
  `Sin resultados`); no options shows `emptyLabel`. Loading, empty,
  no-results and error states render inside the panel; the first three are a
  `role="status"` message and the multi-select load error is an inline notice
  with `Reintentar`.
- **Custom values.** `allowCustom` (searchable `Select` only) offers a
  `Usar «texto»` row first when the trimmed query matches no option exactly, and
  commits that text verbatim. Without `allowCustom` unknown text can never be
  committed; whitespace-only text is never offered.

| Keys / gesture | `Select` (searchable or not) | `MultiSelect` |
| --- | --- | --- |
| Closed, Enter / Space / ArrowDown / Alt+ArrowDown | opens at the first row; Space only when not searchable | chevron opens and focuses the search field; Enter/Space on the button opens |
| Closed, ArrowUp | opens at the last row | — |
| Closed, printable character | starts typeahead (prefix match, 500 ms buffer); only when not searchable | types into the search field |
| Open, ArrowDown / ArrowUp | moves the active row; single-select clamps at the ends | moves the active row; wraps |
| Open, Home / End | first / last row, select-only | — |
| Open, Enter | commits the active row and closes | toggles the active row and stays open |
| Open, Space | commits when not searchable | toggles only with an empty query |
| Open, Backspace | — | removes the last chip when the query is empty |
| Escape | closes without committing | closes without committing |
| Tab | closes the popover | closes the popover |

Selected rows carry `aria-selected` (and a `✓` badge in `MultiSelect`); the
keyboard-active row is a separate axis exposed through `aria-activedescendant`
and `data-active`.

### Badges and status

Use a dot or icon plus a localized label. Raw API values belong in
`title`/`aria-label`, not as the only visible copy.

### Feedback and notifications

- **Action outcomes are toasts.** Success and failure of a save, create,
  delete or test call `notifySuccess` / `notifyWarning` / `notifyError` from
  `components/Toast.tsx`, which wrap the sonner host mounted once in
  `main.tsx` (dark, bottom-right, `richColors`, `closeButton`). Success lands in
  a polite live region; an error toast is dismissible from the keyboard. One
  toast per action, with the copy the inline message used to carry. Do not
  render a green success paragraph. Derive the channel from the status tone
  (`statusTone` in `ui.ts`): a `needs_config` or `qr_pending` outcome is a
  warning, never a success.
- **State stays inline.** Anything that is not the outcome of an action (the
  unsaved dot, list loading, chat state, the picker's empty or no-results
  message) keeps `role="status"` where it belongs on the screen. A toast never
  replaces persistent state. Run status is inline text today and carries no
  `role`, so it is not an example of this rule yet.
- **Validation errors stay next to the field.** `Field` renders the message with
  `aria-invalid` on the control and emits no toast; an invalid submit makes no
  request. The same line covers parsing a JSON config field
  (`NodeConfigFields`), a field validator (`PlatformSettingsFields`), an
  unparsable launch value (`RunLaunchModal`), the flow's trigger/connection
  rules and the server's `INVALID_WORKFLOW` issues: they stay inline and never
  fire a toast. `NodeInspector` is neither: its `onError` occurrences are a
  node's error-strategy configuration field. The inventory in
  `apps/web/test/design-conformance.test.ts` records which files still hold
  inline state; `REQUEST_FAILURE_DEBT` is empty.
- **Known gap: `GlobalRunsPage`'s export failure.** It writes
  `setExportError(...)` and renders it inline with no toast, and it escaped the
  inventory because the scanner's signal is `setError(`, not `setExportError(`.
  Plan row 71 converts it. That is how this class of gap survives a sweep: the
  failure is real, only the setter's name is different. Field-level errors are never
  transient surfaces.
- Run-status and canvas notices stay in their own surface; they do not become
  toasts.

### Tabs

Active tab uses `panel-2` with a `line` border. The strip scrolls horizontally
when needed, keeps the active tab fully visible and shows a fade or arrow at the
hidden edge. No label is clipped with an ellipsis.

### Cards

Stable header/body/footer structure, no more than three badges, and
`truncate` + `title` for long values. Empty cards use the shared empty state.

### Modals and dialogs

Use `Modal` with `sm`/`md`/`lg`/`xl`. The modal traps focus, makes the background
inert, locks body scroll, restores focus to the trigger and closes with Escape,
the backdrop or the close control. It scrolls only its body (`data-modal-body`):
the header and the sticky footer stay fixed, and a `pre` inside the body scrolls
horizontally rather than in its own vertical box. The one exception is the
picker's list, whose listbox is a capped scroll region (`max-h-80` with
`overscroll-contain`) by design. Nested dialogs stack: only the top one owns
Escape and the focus trap.

### Project top bar

One row at 1280 px and 1440 px. Below `sm` (640 px) it stacks into a breadcrumb
row and a second row with the tab strip and the action cluster. Left: breadcrumb
and project name. Center: scrollable tab strip with fade affordances and seven
routed sections: Resumen, Flujo, Ejecuciones, Agentes, Conocimiento,
Integraciones and Ajustes. Each tab is
a URL under `/projects/:slug/`, so reload and deep links land on the same
section; `/projects/:slug` redirects to `overview`. Right, in implementation
order: issue badge (only when the flow has problems), unsaved dot, overflow
menu, `Guardar`/`Guardar flujo`, `Ejecutar` and `Agente`.
The overflow menu contains Versiones del flujo, Biblioteca del flujo and Ajustes
del flujo. The project name truncates before any tab label is clipped. The save
action reads `Guardar` at 1280 px and expands to `Guardar flujo` from 1400 px.
On narrow viewports the action cluster stays on screen at 320 px: the overflow
menu anchors to the cluster (`max-sm:static`) so its panel cannot spill past the
left edge, and the tabs scroll horizontally with edge fades.

The rail above the project shell has five global destinations: Proyectos,
Ejecuciones, Orquestador global, Ajustes and Salud del sistema. Ejecuciones is
the cross-project run history with filters, child-run grouping and JSON/CSV
export; it uses the list template.

### Canvas

- Initial zoom is at least 0.8. If the graph does not fit, center on the trigger
  at 0.8; do not auto-fit below that threshold.
- `Ajustar vista` fits the full graph at the overview threshold (0.25).
- Do not re-fit on every SSE or node update; preserve the user's viewport.
- On desktop the minimap is the overview; panning and explicit zoom-out are
  allowed.
- Below 640 px the canvas runs in narrow mode (`data-canvas-layout="narrow"`):
  the minimap, zoom readout and shortcuts help are hidden, the action cluster is
  capped at `calc(100vw - 2rem)` so its actions stay inside the viewport (it does
  not wrap), and connection handles get a 16 px target with a 32 px touch radius
  and click-to-connect.
- The narrow canvas is fully editable: `+ Nodo` opens the palette as a
  full-height sheet, tapping a node opens the inspector the same way, tapping a
  target node completes a connection, and the same save/run actions apply.
- Transient notices (connect prompt, agent working, run progress) share one
  bottom-centre stack that clears the fixed chat pill. When the free band is
  under 11 rem the stack collapses to a single compact line with a `+N`
  counter; it never covers the top-left actions or the connect instruction.
- At the initial view a node title is at least 11 px effective.

### Agent catalog

- Cards show category/role, localized mode, description, model, notebook
  summary and denied-tool count.
- The primary agent is first, uses the agent accent and `Principal` label, and
  has no delete action.
- Sub-agents expose edit and delete; delete requires confirmation.
- Create/edit uses a focused modal with grouped sections, validation and a
  sticky footer. The Agentes tab does not end in a permanent inline form.
- Mode labels: `Principal`, `Sub-agente`, `Principal y sub-agente`.

### Chat

- States: docked and minimized. The expanded/maximized state is removed.
- Project chat lives in a lateral drawer with `Cerrar`; orchestrator chat is
  docked and can minimize to a bubble.
- The "Ir al último mensaje" control is a reserved right-aligned pill above the
  composer, never overlapping messages.
- Keyboard focus is visible; the composer, send, close/minimize and copy actions
  are reachable.

### Page templates

Every screen is one of four templates. Each starts with `PageHeader` and
composes the shared primitives; the state matrix below applies to all of them.

- **List** — `PageHeader` (title, description, create action in `actions`), a
  toolbar with search and filters, then the content region. Rows keep a stable
  height with `truncate` + `title`.
- **Detail** — `PageHeader` with `breadcrumbs` and record actions over a stack
  of cards or sections. Sub-collections inside it follow the List states.
- **Editor** — `PageHeader` with save/run actions and the unsaved dot, grouped
  sections (often `Tabs`), every control inside a `Field`, and a sticky footer
  so the primary action stays reachable while the body scrolls.
- **Settings** — `PageHeader` then `Tabs` or stacked section cards of `Field`
  forms. Destructive actions live in their own zone and open `ConfirmDialog`.

### State matrix

Forms (editors and settings), lists (tables and card grids) and dialogs
(`Modal`/`ConfirmDialog` bodies) each handle the five shared states:

| State | Forms | Lists | Dialogs |
| --- | --- | --- | --- |
| Loading | controls disabled; primary action shows `pending` | `Skeleton` rows matching the final layout | `ConfirmDialog` `pending` disables confirm; cancel and close stay available |
| Empty | no record to edit: `EmptyState` or `Field` `hint` explains it; never a silent blank form | `EmptyState` with icon, explanation and one next action | body explains there is nothing to choose or confirm yet |
| Error | `Field` `error` under the control with `aria-invalid`; summary near the primary action | error message and a retry action; never the empty state | error text in the body; confirm re-enables after the failure |
| Success | saved feedback or navigation; stale errors are cleared | the data itself; success feedback is transient | the dialog closes on success (exit 140 ms) |
| Disabled | control disabled with `Field` `hint` explaining why; submit disabled until valid | row actions disabled with an accessible reason | confirm disabled until valid (e.g. `confirmationText` not typed) or while `pending` |

Per-primitive states — the mapping the matrix must keep complete:

- `Skeleton` → Loading.
- `EmptyState` → Empty.
- `Field` → Error (`error`) and Disabled (`hint` plus the control's `disabled`).
- `ConfirmDialog` → Disabled (`pending`, `confirmationText`) and Success (it
  closes with the 140 ms exit).
- `Tabs` → Disabled (`items[].disabled`).
- `PageHeader` → hosts the page-level Loading/Disabled actions (disabled save,
  `pending` run) in `actions`; it has no state of its own.

## 6. Motion

Use the tokens and rules in `docs/ui-motion.md`:

- Enter/exit uses strong ease-out; movement uses ease-in-out.
- UI motion stays under 300 ms; modal entry 220 ms, exit 140 ms; drawer 320 ms.
- Only animate `transform` and `opacity`.
- Add press feedback with a subtle scale and a short duration.
- `prefers-reduced-motion` keeps opacity/colour changes but removes movement,
  pulses and smooth scrolling.
- Do not animate keyboard-initiated high-frequency actions.

## Guia externa

External guidance is installed as two skills, both vendored under
`.agents/skills/` and pinned by commit in `skills-lock.json`:
`modern-web-guidance` (source `GoogleChrome/modern-web-guidance`) and
`frontend-design` (source `anthropics/skills`).

- **`modern-web-guidance`** — use before every HTML/CSS/client-side JS UI
  decision (patterns, APIs, forms, accessibility, performance). Exact command:
  `npx modern-web-guidance search "<topic>"`, then follow the returned guide
  with `npx modern-web-guidance retrieve "<id>"`.
- **`frontend-design`** — use for aesthetic direction: visual identity,
  palette, typography and layout composition. It does not replace the
  platform-pattern search above.

## 7. Accessibility

- Target WCAG 2.2 AA.
- Visible `focus-visible` ring on every interactive element.
- Skip link to `#main-content`.
- Modals and drawers trap focus, make the background inert and return focus.
- Off-screen navigation is not focusable.
- Status is conveyed by text/icon as well as color.
- Form errors are associated with their field and announced.
- Picker triggers keep `role="combobox"`, `aria-expanded` and
  `aria-activedescendant`; the sheet is a modal dialog, the popover is not.
- Test keyboard-only operation at 320 px and 200% zoom on desktop.

## 8. Copy and statuses

Spanish sentence case. Use `OpenCode` with that capitalization. Do not use
internal architecture terms such as "Hexagonal" in primary navigation or
headings. Use the following visible labels:

| Raw | Visible | Tone |
| --- | --- | --- |
| `queued` | En cola | neutral |
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

Errors explain what happened and what to do next. Technical details may stay in
a bounded code/detail area. Empty states use an icon, a short explanation and a
next action; no emoji-only system state.
