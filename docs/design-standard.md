# Agentic Platform — Design Standard

This document is the source of truth for the web interface. `docs/ui-motion.md`
covers timing, easing and modal behaviour; this document covers identity,
tokens, typography, components, accessibility and copy. The product is
desktop-first: acceptance is at 1280×800 and 1440×900. Mobile is not a design
target.

## 1. Brand

- **Name:** Agentic Platform.
- **Descriptor:** Automatizaciones agénticas sobre OpenCode. The navigation uses
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

## 5. Components

### Buttons

Primary, secondary, ghost and danger variants. Every button has hover,
pressed (`active:scale-[0.97]`), disabled and `focus-visible` states. Icon-only
buttons need an accessible name and a tooltip/title.

### Inputs

Label above the control, helper or error below. Use the `well` surface, `line`
border and the accent focus ring. Placeholder contrast must remain readable.

### Badges and status

Use a dot or icon plus a localized label. Raw API values belong in
`title`/`aria-label`, not as the only visible copy.

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
the backdrop or the close control. Sticky footers keep the primary action
reachable while the body scrolls.

### Project top bar

One row at 1280 px and 1440 px. Left: breadcrumb and project name. Center:
scrollable six-tab strip with fade affordances. Right: unsaved dot, Save, Run,
Agent and an overflow menu containing Versiones and Ajustes del flujo. The
project name truncates before any tab label is clipped.

### Canvas

- Initial zoom is at least 0.8. If the graph does not fit, center on the trigger
  at 0.8; do not auto-fit below that threshold.
- `Ajustar vista` fits the full graph at the overview threshold (0.25).
- Do not re-fit on every SSE or node update; preserve the user's viewport.
- The minimap is the overview. Panning and explicit zoom-out are allowed.
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

## 6. Motion

Use the tokens and rules in `docs/ui-motion.md`:

- Enter/exit uses strong ease-out; movement uses ease-in-out.
- UI motion stays under 300 ms; modal entry 220 ms, exit 140 ms; drawer 320 ms.
- Only animate `transform` and `opacity`.
- Add press feedback with a subtle scale and a short duration.
- `prefers-reduced-motion` keeps opacity/colour changes but removes movement,
  pulses and smooth scrolling.
- Do not animate keyboard-initiated high-frequency actions.

## 7. Accessibility

- Target WCAG 2.2 AA.
- Visible `focus-visible` ring on every interactive element.
- Skip link to `#main-content`.
- Modals and drawers trap focus, make the background inert and return focus.
- Off-screen navigation is not focusable.
- Status is conveyed by text/icon as well as color.
- Form errors are associated with their field and announced.
- Test keyboard-only operation and 200% zoom on desktop.

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
