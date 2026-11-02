# Tasks

## 1. Serve public brand assets

- [x] 1.1 Replace the `/assets/*`-only static registration in `apps/server/src/app.ts` with a catch-all `serveStatic({ root: webDist })` before the SPA fallback, so `/favicon.svg` and `/brand/*.svg` resolve while missing client routes still reach `index.html`; verify with `bun run --cwd apps/server typecheck`.
- [x] 1.2 Add `apps/server/test/static-assets.test.ts` using a temporary `webDist` with `index.html` and `favicon.svg`; assert `/favicon.svg` returns `200` with `image/svg+xml` and the SVG body, and a client route still returns the HTML; verify with `bun run --cwd apps/server test`.

## 2. Animate the desktop navigation rail

- [x] 2.1 Transition the shell's `grid-template-columns` between 64 px and 240 px over 200 ms, let the aside fill the track with `lg:w-auto`, add `lg:overflow-hidden`, and extend the existing `.nav-drawer` transition with padding and gap without replacing its mobile transform; verify with `bun run --cwd apps/web typecheck` and a browser collapse at 1440x900 where the main workspace reflows with the rail.
- [x] 2.2 Keep nav labels and the wordmark mounted: replace `lg:sr-only` with a desktop-only max-width and opacity wrapper, pass `compact={false}` and stretch/center the brand when collapsed, and transition nav icon padding from 12 px to 11 px; verify labels do not overflow and links keep accessible names and titles in `apps/web/test/layout.test.tsx`.
- [x] 2.3 Add `aria-controls` and `aria-expanded` to the desktop collapse control and add the shell and label transitions to the reduced-motion block in `apps/web/src/index.css`; verify `bun run --cwd apps/web test` and that `prefers-reduced-motion: reduce` switches the rail without visible movement.
- [x] 2.4 Add the navigation-rail exception to `docs/ui-motion.md`: 200 ms grid-track and padding/gap, 140 ms label opacity, 1 ms under reduced motion; verify the documented values match `apps/web/src/index.css`.

## 3. Integration verification

- [ ] 3.1 Run `bun run --cwd apps/server test`, `bun run --cwd apps/web test`, both package typechecks, and `bun run build`; verify all pass.
- [ ] 3.2 Build and start the app, then request `/favicon.svg` and `/brand/agentic-mark.svg`; verify both return `200 image/svg+xml` with the SVG body, and a client route still returns `index.html`.
- [ ] 3.3 In a browser at 1280x800 and 1440x900, collapse and expand the rail on a project canvas; verify no label or wordmark overflow, the workspace reflows, the canvas viewport is not reset, and keyboard focus stays visible. Repeat with `prefers-reduced-motion: reduce` and verify the change is immediate.
- [ ] 3.4 Run `graphify update .` after the code changes and verify the graph refresh completes without errors.

## Workflow follow-up

- Create `change/fix-favicon-and-animate-nav-rail` from the remote base branch before implementation.
- Commit the planning artifacts with `docs(openspec): plan fix-favicon-and-animate-nav-rail`.
- Create one atomic commit per numbered group using Conventional Commits: `<type>(fix-favicon-and-animate-nav-rail): <summary>`.
- Push the branch and open a PR with `gh pr create` when implementation finishes; report the URL and never merge automatically.
- Wait for human review and merge; archive only after the PR is merged.
