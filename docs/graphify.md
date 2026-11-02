# Graphify

This repository uses [Graphify](https://github.com/Graphify-Labs/graphify) as a
local code knowledge graph. The project-scoped integration was installed with:

```bash
uv tool install graphifyy
graphify install --project --platform opencode
```

## What is installed

- `graphify` CLI (`graphifyy` PyPI package) in the user tool path.
- `.opencode/skills/graphify/`: the `/graphify` skill and its references.
- `.opencode/plugins/graphify.js`: an OpenCode hook that reminds the agent to
  consult the graph before the first shell command of a session.
- `AGENTS.md`: query-first instructions for agents working in this repository.
- `graphify-out/`: the generated graph, report and interactive HTML.

## Daily use

```bash
bun run graph:build          # code-only local graph, no API key
bun run graph:update         # incremental AST update after code changes
graphify query "how does the canvas fit view work?"
graphify path "WorkflowCanvas" "ProjectPage"
graphify explain "ProjectPage"
graphify god-nodes
```

The graph is built from code with tree-sitter. Docs, PDFs and media are not
included in the default build; use the `/graphify` skill when you explicitly
want a semantic pass over documents.

## OpenSpec integration

`openspec/config.yaml` tells OpenSpec agents to query the graph before broad
code exploration and to refresh it after code changes. The agent instructions in
`AGENTS.md` carry the same rule. The graph is an input to exploration, not a
substitute for reading the exact lines a query points to.

## Maintenance

- Rebuild after code changes: `bun run graph:update`.
- Full rebuild: `bun run graph:build`.
- The generated `graphify-out/graph.json` is rewritten whole on updates; a large
  diff is expected when the graph is committed.
- If a graph query is stale or incorrect, run the update first; only skip
  Graphify when the task is specifically about graph correctness.
