# Design

## Context

See `proposal.md` for motivation.

- `apps/server/src/app.ts` serves only `/assets/*` from the Vite output and then returns `index.html` for every other path. The built app contains `favicon.svg` and `brand/*.svg`, but requests for them receive HTML. Vite dev serves `public/` directly, so the failure is production-only.
- `apps/web/src/components/Layout.tsx` uses one `<aside>` for both the desktop rail and the narrow-viewport drawer. The outer shell toggles `lg:grid-cols-[64px_1fr]` and `lg:grid-cols-[240px_1fr]`; the aside toggles width, padding and gap; nav labels use `lg:sr-only`; `BrandLockup` unmounts the wordmark with `compact`; the header switches from row to column. Only the mobile drawer has a transition (`.nav-drawer`, 320 ms transform).
- `apps/web/src/index.css` already defines the motion tokens and the reduced-motion block. `docs/ui-motion.md` currently says only `transform` and `opacity` may animate.
- `apps/web/src/components/WorkflowCanvas.tsx` fits the graph only when `graph.id` changes, not when its container resizes, so a rail transition will resize the canvas without resetting the viewport.
- Existing tests: `apps/web/test/layout.test.tsx` covers collapse persistence and accessible labels; `apps/server/test/app.http.test.ts` exercises the HTTP surface.

## Goals / Non-Goals

**Goals:**

- Serve the built favicon and brand SVGs with the correct content type while preserving the SPA fallback for client routes.
- Animate the desktop rail between 64 px and 240 px in 200 ms, with labels and wordmark contained inside the rail.
- Keep the existing layout behavior: the workspace reflows as the rail changes width.
- Preserve accessible names, tooltips, keyboard operation and the persisted preference.
- Respect `prefers-reduced-motion`.
- Keep the mobile drawer's existing transform behavior unchanged.

**Non-Goals:**

- Redesigning the navigation, changing destinations or adding new controls.
- Replacing the rail with an overlay or a floating panel.
- Splitting the desktop rail and mobile drawer into separate asides.
- Changing the favicon artwork or adding new brand assets.
- Changing canvas viewport behavior, workflow behavior, APIs or persistence.

## Decisions

### 1. Serve static assets with a catch-all before the SPA fallback

Replace the `/assets/*`-only registration with a static middleware registered for all GET/HEAD paths, before the `app.get("*")` fallback:

```text
GET /favicon.svg
  -> serveStatic(root: webDist)  -> file exists -> image/svg+xml
GET /projects/demo
  -> serveStatic(root: webDist)  -> no file    -> next()
  -> app.get("*")               -> index.html
```

Hono's `serveStatic` calls `next()` when the file does not exist, so the SPA fallback remains intact. This fixes the favicon and every current or future file under `apps/web/public/` in one place.

Alternatives considered:

- **Explicit `/favicon.svg` and `/brand/*` routes.** Works, but leaves the same trap for the next public asset. Rejected.
- **Inline the SVG as a data URI in `index.html`.** Avoids the server fix but duplicates the artwork, bloats the HTML and still leaves `/brand/*` unreachable. Rejected.
- **A CDN or reverse proxy.** Not part of this application's deployment and does not fix the local Docker image. Rejected.

The catch-all may serve `/` from disk instead of the in-memory `indexHtml`. Both are the same built file; client routes still use the in-memory fallback. This is acceptable and keeps the route order simple.

### 2. Animate the grid track, not the aside width

Keep the outer shell as a grid and transition `grid-template-columns` between `64px 1fr` and `240px 1fr` over 200 ms with `--motion-ease-in-out`. Let the aside fill the track (`lg:w-auto`) and add `lg:overflow-hidden` so clipped content cannot spill into the workspace. Transition the aside's padding and gap with the same duration.

This keeps one source of width truth: the rail and the workspace move together, and the canvas expands or contracts exactly as it does today.

Alternatives considered:

- **Animate the aside width while the grid track snaps.** The main content would jump or lag the rail. Rejected.
- **Overlay rail with `transform` and `opacity`.** Fully compositor-friendly and respects the existing motion rule, but the workspace would no longer expand; the panel would cover content. That is a different product behavior. Rejected.
- **FLIP or transform-only animation.** Requires measuring both layouts and animating inverse transforms, while the content still reflows at the start. Complex without a better result. Rejected.

This is a deliberate exception to the "only transform and opacity" rule. A structural navigation rail cannot change layout without reflow. The exception is narrow: the rail's grid track is the only layout property animated, and it is capped at 200 ms.

### 3. Keep one aside and extend its existing transition

Do not split the desktop rail from the mobile drawer. Extend the existing `.nav-drawer` transition with `padding` and `gap`, keeping `transform` at 320 ms for the mobile drawer. Desktop-only width and content states use `lg:` variants. The mobile drawer continues to slide with its current curve.

This avoids duplicating the navigation markup, the brand lockup and the footer actions, and keeps the `inert` gating unchanged. A split was considered for cleaner separation, but it adds risk and does not solve the animation itself.

### 4. Keep labels and the wordmark mounted; clip and fade

Replace `lg:sr-only` on nav labels with a desktop-only wrapper that transitions:

- `max-width: 0` and `opacity: 0` when collapsed.
- `max-width: 180px` and `opacity: 1` when expanded.
- `overflow: hidden`, `white-space: nowrap`, and `min-width: 0`.

The text stays in the DOM, so the link keeps its accessible name while collapsed; the existing `title` attribute remains as a tooltip. The opacity transition uses `--motion-duration-fast` (140 ms); the max-width transition uses `--motion-duration-base` (200 ms).

For the brand, keep `compact={false}` and the subtitle mounted, and let the wordmark wrapper shrink and clip. When collapsed, make the brand link stretch and center (`lg:self-stretch lg:justify-center lg:gap-0`) so the mark does not jump to the middle of a still-wide rail at the start of the transition. The aside's `lg:overflow-hidden` contains the clipped wordmark.

Alternatives considered:

- **Keep `compact` and `sr-only`.** Simplest, but the wordmark unmounts and the mark jumps to the center of the 240 px rail before the width starts shrinking. Rejected.
- **Crossfade two complete headers.** Smoother for the toggle button, but duplicates markup and state. Rejected for this change.

### 5. Keep nav icons left-aligned with a padding transition

Do not toggle `justify-center` on each nav item. Keep `justify-start` and transition the horizontal padding from 12 px (expanded) to 11 px (collapsed). The icon stays near the left edge and lands centered in the 64 px rail without a horizontal jump. The label wrapper collapses after the icon, so the flex row remains stable.

### 6. Accept the header reflow at the state change

The header still switches from row to column when collapsed, so the toggle button moves below the brand. With the wordmark kept mounted, the mark stays near its expanded position and the wordmark is clipped away; the button's move is the remaining discrete step. This is accepted for the first implementation because the width transition carries the eye and the control remains in the same region.

If review finds the button jump distracting, the follow-up is a container query on the aside that switches the header to a column only when the rail is already narrow (around 120 px), or a crossfade of two header layouts. Neither is part of this change.

### 7. Motion values and reduced motion

- Rail grid track: 200 ms, `--motion-ease-in-out`.
- Aside padding and gap: 200 ms, `--motion-ease-in-out`.
- Label max-width: 200 ms; label opacity: 140 ms.
- Mobile drawer: unchanged 320 ms transform with `--motion-ease-drawer`.
- `prefers-reduced-motion: reduce`: 1 ms for the shell, labels and drawer. The state change is immediate and no movement is shown.

Add a "Navigation rail" section to `docs/ui-motion.md` documenting the layout exception, the 200 ms cap and the reduced-motion behavior. The existing rule for modals and overlays stays unchanged.

### 8. Accessibility

- Give the aside an `id` (for example `app-navigation`) and add `aria-controls` and `aria-expanded` to the desktop collapse control. Keep the changing accessible name (`Contraer navegación` / `Expandir navegación`).
- Keep the label text in the accessibility tree when collapsed. The `title` remains for pointer users.
- Keep `lg:overflow-hidden` desktop-only so the mobile drawer's focus rings and content are not clipped.
- The mobile drawer's `inert` behavior and the skip link are unchanged.
- Verify keyboard operation and 200% zoom on desktop.

### 9. Testing and verification

- **Server**: create a temporary `webDist` containing `index.html` and `favicon.svg`, pass it as `config.webDist`, and assert that `GET /favicon.svg` returns `200`, `image/svg+xml` and the SVG body, while a client route still returns `index.html`. This avoids depending on a local `apps/web/dist` in CI.
- **Web**: extend `layout.test.tsx` to assert `aria-expanded` changes with the toggle, the collapsed links keep their accessible names and titles, and the preference still persists.
- **Browser**: at 1280x800 and 1440x900, collapse and expand the rail on a project canvas. Verify no label or wordmark overflows, the workspace reflows, the canvas remains usable, and the graph viewport is not reset. Repeat with `prefers-reduced-motion: reduce` and verify the state changes without visible movement.
- **Production check**: after building, request `/favicon.svg` from the server and confirm the content type and body, then hard-refresh the browser tab.

## Risks / Trade-offs

- **Layout animation reflows the canvas for 200 ms.** The canvas does not re-fit on resize, so the viewport should stay put. Test with a representative graph; if it feels heavy, shorten the rail to 160 ms. The overlay alternative is out of scope.
- **The toggle button still jumps when the header becomes a column.** Accepted for this change; a container query or header crossfade is the follow-up if it is distracting.
- **`grid-template-columns` transitions require a modern browser.** Current desktop browsers support it; older browsers will snap to the new width. The behavior remains usable.
- **The catch-all static middleware could serve unintended files under `webDist`.** `webDist` is built output with sourcemaps disabled and no secrets. If the deployment later adds private files there, restrict the middleware to known public paths.
- **Collapsed labels remain in the accessibility tree.** This is intentional so links keep their names; the text is visually clipped, not hidden from assistive technology. The `title` remains as a secondary cue.
- **The mobile drawer shares the aside element.** Desktop transitions are gated with `lg:` variants and `lg:overflow-hidden`; the mobile transform transition is extended, not replaced. Verify the drawer still opens and closes at narrow widths.

## Migration Plan

1. Update the server static route and add the HTTP test. No data migration.
2. Add the rail transition and content treatment; keep the mobile drawer behavior.
3. Update the motion documentation.
4. Deploy the server and web build together. Rollback is a frontend/server revert; no persisted state changes. The existing `platform.nav.collapsed` preference remains compatible.
5. After deployment, hard-refresh a browser tab if the old `200 text/html` favicon response was cached.

## Open Questions

None that change the approach, specs or task breakdown. The header reflow follow-up is explicitly deferred and does not block this change.
