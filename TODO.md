# Sage TODO

> Historical note: the original TODO predates the local-first Tome direction and referenced Electron/Instagram-style arXiv feeds. Current work should follow `README.md`, `DESIGN.md`, `SESSION_CONTEXT.md`, `AGENT_SKILL_SPEC.md`, and `docs/PRODUCT_SURFACES.md`.

## Current Frontend/Product TODO

- [x] Make Tome Home the default app landing surface.
- [x] Preserve Tome Dashboard as a secondary overview.
- [ ] Design the macOS global command-bar overlay as a separate Spotlight/Raycast-style layer.
- [ ] Wire the Tome Home composer to the real agent/chat endpoint.
- [ ] Connect capability chips to real skill execution and generated artifacts.
- [ ] Keep hosted/web deployment out of scope until desktop scope stabilizes.
- [ ] Continue replacing or deleting stale pre-Ethereal UI paths.

## Validation

- Frontend changes: run `cd frontend && npm run build`.
- Backend changes: run relevant `uv run --group dev pytest` commands from `backend/`.
