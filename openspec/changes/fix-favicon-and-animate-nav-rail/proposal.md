# Proposal

## Why

The brand and design system change introduced a favicon and brand SVGs, but the production server only serves `/assets/*`; every other path returns `index.html`. As a result, `/favicon.svg` and `/brand/*.svg` return HTML in the built application, so the browser tab still shows no icon. Separately, the desktop navigation rail changes between 64 px and 240 px instantly, which makes the shell feel unfinished and produces a jarring reflow on every collapse or expand.

## What Changes

- **Serve public brand assets in production**: register the Vite output directory as a static source before the SPA fallback so `/favicon.svg` and `/brand/*.svg` return their real files with the correct content type. Client-side routes continue to fall back to `index.html`.
- **Animate the desktop navigation rail**: transition the grid track between 64 px and 240 px over 200 ms with the project's ease-in-out motion token; transition padding and gap; keep labels and the wordmark mounted and clip or fade them so the rail does not spill during the transition; preserve accessible names and tooltips.
- **Respect reduced motion**: when `prefers-reduced-motion: reduce`, the rail and labels switch immediately (1 ms) and no movement is shown. The mobile drawer keeps its existing transform animation.
- **Document the layout exception**: add a short navigation-rail section to `docs/ui-motion.md` explaining that the structural grid track is the one allowed layout animation, with its duration, easing and reduced-motion behavior.
- **Tests**: cover the production favicon response and the rail's accessible collapsed and expanded states; keep the existing layout tests passing.

### Out of scope

- Redesigning the mobile drawer or changing its 320 ms transform animation.
- Changing the navigation information architecture, labels or destinations.
- Changing the favicon artwork. The existing SVG is legible at 16 and 32 px; the optional compact variant is not part of this change.
- Splitting the shell into separate desktop and mobile asides. The existing single aside is kept; desktop-only transitions are gated with `lg:` classes and the mobile drawer's transform remains independent.
- Changing the canvas viewport behavior or any workflow, API or persistence behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interface-design-system`: clarify that the favicon and brand assets must resolve from the built application, not only from the Vite dev server.
- `workflow-and-workspace-engine`: extend the collapsible global navigation requirement with a smooth collapse and expand transition and reduced-motion behavior.

## Impact

- **Web UI**: `apps/web/src/components/Layout.tsx` (rail transition classes, label and wordmark clipping, toggle state), `apps/web/src/index.css` (rail and label transitions, reduced-motion coverage), and possibly `apps/web/src/components/Brand.tsx` if the wordmark needs a wrapper prop. The mobile drawer keeps its existing behavior.
- **Server**: `apps/server/src/app.ts` static asset serving order. No API, database or workflow behavior changes.
- **Assets**: no new assets. `apps/web/public/favicon.svg` and `apps/web/public/brand/*.svg` are already present and copied by Vite.
- **Docs**: `docs/ui-motion.md` navigation-rail motion exception.
- **Tests**: `apps/web/test/layout.test.tsx` for accessible collapse and expand; a server HTTP test for `GET /favicon.svg` returning `image/svg+xml`; optionally a CSS or class assertion for reduced motion.
- **Dependencies**: none.
