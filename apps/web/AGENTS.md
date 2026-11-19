# apps/web — @platform/web

## OVERVIEW

React 19 + Vite 6 + TypeScript SPA "Agentic Platform" — the platform's only UI; dark-theme only, all user-facing copy in Spanish.
Earned its file: score 13 (88 files, 86% code ratio, `src/ui.ts` imported by 27 files) — the frontend is a distinct domain.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App bootstrap | `index.html` → `src/main.tsx` | `createRoot`, `BrowserRouter`, Sentry only when `VITE_SENTRY_DSN` set |
| HTTP call | `src/api.ts` (631 LOC) | `api` object, ~80 methods; `credentials: "include"`; non-2xx → `ApiClientError` |
| Server state | `src/query.ts` | `queryClient` + `qk` key factory; mutations invalidate `qk.x(slug)` |
| Route | `src/App.tsx` | whole route table + `RequireAuth` guard; catch-all → `/projects` |
| New screen | `src/pages/<Name>Page.tsx` | title set via `useDocumentTitle` → "`<título> · Agentic Platform`" |
| Styling | `src/ui.ts` + `src/index.css` | class-string constants; design tokens = CSS vars in one Tailwind v4 `@theme` block; dark-only |
| Session | `src/auth.tsx` | `AuthProvider`/`useAuth`; HTTP-only cookies only |
| Live updates | `src/pages/ProjectPage.tsx` (825 LOC) | `EventSource("/api/events")` pushes `workflow.updated`/`run.updated`/`chat.turn.updated` into the query cache |
| Chat streaming | `src/api.ts` `readTurnStream` + `src/useChatTurn.ts` | hand-parsed SSE (not EventSource); turn states `idle\|streaming\|reconnecting\|done\|error` |
| Canvas editor | `src/components/` | own AGENTS.md — React Flow node/edge subsystem |
| Unit tests | `test/<module>.test.ts(x)` | spec name mirrors the module under test |

## CONVENTIONS

- All user-facing copy is Spanish (labels, errors, node titles); identifiers and comments are English.
- Named exports only — no `export default` in `src/` (only inside generated code-node strings).
- Every relative import carries its explicit extension: `"./api.ts"`, `"../ui.ts"`, `"./Modal.tsx"`.
- Server state = TanStack Query v5; local state = plain `useState`; no Redux/Zustand/global store.
- Exactly two React contexts: `AuthProvider` (`src/auth.tsx`) and `CanvasActionsContext` (`src/components/nodes/canvas-actions.ts`).
- Icons are inline SVG components (`NavIcon.tsx`, `nodes/node-icons.tsx`) — no icon dependency.
- Naming: pages `PascalCasePage.tsx`, components `PascalCase.tsx`, non-component modules kebab-case, hooks `use<Name>.ts` at `src/` root.
- `localStorage` namespaced and try/catch-wrapped: `platform.nav.collapsed`, `chat-surface:<key>`.
- Motion uses `--motion-*` tokens in `index.css`; `prefers-reduced-motion` disables animations.

## ANTI-PATTERNS

- Never store an auth token client-side — sessions are HTTP-only cookies.
- Only `ApiClientError.code === "INVALID_WORKFLOW"` is handled specially (→ per-node `GraphIssue` mapping in ProjectPage); everything else surfaces `cause.message`.
- Secrets never round-trip to the browser; UI copy states they resolve server-side only.
- Test mocks: `vi.mock("../src/api.ts")` is hoisted above the component import; render through `renderWithProviders` (`test/render.tsx`); no `.only`/`.skip` in the suite.

## COMMANDS

```bash
bun run --cwd apps/web dev        # vite :5173, /api proxied to http://localhost:3000
bun run --cwd apps/web test       # vitest run (jsdom; test config lives in vite.config.ts)
bun run --cwd apps/web typecheck  # tsc --noEmit -p tsconfig.json
bun run --cwd apps/web build      # vite build → dist/ (required before bun run test:e2e)
```
