# Agentation dev panel

Added the [Agentation](https://www.agentation.com/install) overlay so feedback
posted from the running app surfaces in this Claude Code session via the
`mcp__agentation__*` tool family.

## What it does

- `npm install agentation -D` was run inside `frontend/`.
- A small client wrapper (`AgentationDev`) renders `<Agentation />` only when
  `process.env.NODE_ENV === "development"`, so the overlay never ships in a
  production build.
- The wrapper is mounted at the end of `<body>` in the root layout, after
  `{children}`, to keep its DOM out of the app tree.

## Files touched

- `frontend/package.json` — added `agentation` to `devDependencies`.
- `frontend/src/components/AgentationDev.tsx` — new, dev-only wrapper.
- `frontend/src/app/layout.tsx` — imports and renders `<AgentationDev />`.

## Optional MCP server

The npm package exposes a UI overlay only. To expose the agent feedback bridge
to a CLI agent (Claude Code), the user runs the MCP install separately —
this repo does not commit the server config:

```
npx agentation-mcp init      # interactive setup
npx agentation-mcp doctor    # verify
```

The default MCP server listens on `http://localhost:4747`. If you want the
React panel to talk to a non-default endpoint, pass it explicitly:

```tsx
<Agentation endpoint="http://localhost:4747" />
```
