# UI motion and modal standard

This project follows the design-engineering and animation standards from
`emilkowalski/skills` (installed in `.agents/skills`): `emil-design-eng`,
`animate`, `animation-performance` and `review-animations`.

## Shell and route changes

Sections are routes, not in-place panels, and the shell doesn't animate a page
transition. Switching tabs swaps the content immediately behind a Suspense
skeleton, so the top bar never moves and the user never waits on a fade. The
tab strip only animates colour on hover and selection; the active tab is marked
with border and surface, plus `aria-current="page"`.

The top bar itself stays mounted across sections. Its unsaved dot, save state
and tab scroll position survive the change, which is why a route transition
must not restart the shell.

## Modal sizes

Use the smallest size that fits the content. Modals are centered on desktop and
become bottom sheets on narrow viewports; they never fill the desktop viewport.

| Size | Width | Use for |
| --- | --- | --- |
| `sm` | `max-w-md` (448px) | Confirmations, single-field settings, destructive actions |
| `md` | `max-w-xl` (576px) | Standard forms, launch/settings dialogs |
| `lg` | `max-w-3xl` (768px) | Palettes, run details and data-rich lists |
| `xl` | `max-w-5xl` (1024px) | Node inspector with code editor or complex tabs |

Current assignments:

- `sm`: delete project, default model, destructive confirmations.
- `md`: new project, flow settings, run launch, provider/vault/telemetry settings.
- `lg`: node palette, run detail.
- `xl`: node inspector.

## Motion tokens

Defined in `apps/web/src/index.css`:

- `--motion-ease-out: cubic-bezier(0.23, 1, 0.32, 1)` for entering/exiting UI.
- `--motion-ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` for on-screen movement.
- `--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` for drawers.
- `--motion-duration-fast: 140ms` for exits and press feedback.
- `--motion-duration-base: 200ms` for small surfaces and backdrops.
- `--motion-duration-modal: 220ms` for modal entry.
- `--motion-duration-drawer: 320ms` for the navigation drawer.

## Navigation rail

- The desktop rail collapses and expands by transitioning `grid-template-columns`
  between 64 px and 240 px over 200 ms with `--motion-ease-in-out`. This is the
  one deliberate exception to the transform/opacity rule: a structural rail
  must reflow the workspace with it.
- The aside's padding and gap use the same 200 ms curve.
- Labels and the wordmark transition `max-width` over 200 ms and `opacity`
  over 140 ms. The wordmark stays mounted and is clipped by the rail.
- The narrow-viewport drawer keeps its existing 320 ms transform with
  `--motion-ease-drawer`.
- `prefers-reduced-motion: reduce` switches the rail and labels in 1 ms with no
  visible movement.

## Modal behavior

- Entry: opacity + `scale(0.96)` to `scale(1)`, 220ms strong ease-out.
- Exit: opacity + `scale(0.96)`, 140ms strong ease-out. Exit is faster than entry.
- Backdrop fades with the panel so they read as one surface.
- On narrow viewports, the tail of the animation is a subtle upward settle.
- Only `transform` and `opacity` animate; never `width`, `height`, `top` or `left`.
- `prefers-reduced-motion` keeps a short opacity transition and removes movement.
- The close control, Escape and backdrop all use the same presence path, so the
  exit animation cannot be skipped by one interaction but not another.

Use `Modal` from `apps/web/src/components/Modal.tsx` instead of building a new
overlay. Its `size` prop is the contract; do not add per-modal transition values.

## Live status motion

- **Run progress** stays inside the canvas: active edge in cyan with a dash
  animation, completed path in green, running node with a static cyan glow.
- **Agent working** uses a violet status card and a pulsing dot. The canvas
  also outlines nodes touched by the agent with a short violet pulse.
- **Minimized chat** keeps the `ChatPanel` mounted. The drawer slides with the
  drawer curve, and a floating status pill shows the latest activity. The top
  bar `Agente` button keeps a pulse dot while the agent works and a green dot
  when a reply is waiting.
- `prefers-reduced-motion` keeps the status colors and removes pulsing,
  sliding and node-touch animations.

## Press and focus feedback

- Pressable controls use `active:scale-[0.97]` with the shared 140 ms transition;
  inline icons scale with the button, layout does not move.
- Keyboard focus uses a 2 px accent outline with 2 px offset. Inputs keep their
  accent ring; buttons, links, tabs and icon-only controls use the outline.
- `prefers-reduced-motion: reduce` removes the press transform and smooth scroll
  while keeping opacity and colour changes.
- The full visual standard lives in `docs/design-standard.md`.
