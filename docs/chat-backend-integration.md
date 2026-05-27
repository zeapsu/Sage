# Chat backend integration

`ChatWidget` previously faked replies with a `setTimeout` that echoed the
user's message back. It now drives a real round-trip against the FastAPI
`/api/chat` endpoint via the existing `sendChat()` helper in
`frontend/src/lib/sage-api.ts`.

## Behavior

- The widget tracks a `sessionId` returned from the first request and reuses
  it on follow-up turns, so the backend can persist the conversation in
  `KnowledgeStore`.
- The typing indicator now reflects actual backend latency instead of a
  hard-coded 1.5s delay.
- Backend errors are surfaced inline as an assistant-style message
  (`**Error reaching backend:** …`) instead of being swallowed.
- A new `initialQuery` prop lets the parent auto-send a prompt on mount —
  this is how `page.tsx` forwards the user's first command-bar query into
  the chat view.
- Optional `tomeId` / `provider` / `model` props pass through to `sendChat`
  for future tome-aware UI.

## Provider/model badge

`ChatWidget` and `CommandBar` both call `getRuntimeConfig()`
(`GET /api/config`) on mount to label the current provider/model in the
header pill, instead of the hard-coded "GPT-4o" string.

## Files touched

- `frontend/src/components/ChatWidget.tsx` — replaced simulated reply with
  `sendChat()`, added session/loading/error state, `initialQuery`,
  `onCommand` (see [in-chat-command-routing.md](./in-chat-command-routing.md)).
- `frontend/src/components/CommandBar.tsx` — model label is now driven by
  `getRuntimeConfig()`.
- `frontend/src/app/page.tsx` — tracks the user's command-bar prompt and
  forwards it to `ChatWidget` as `initialQuery`.

## Running locally

1. Backend: `cd backend && python main.py` (defaults to port 8000).
2. Frontend: `cd frontend && npm run dev` (defaults to port 3000).

CORS for `http://localhost:3000` is already allowed in `backend/main.py`.
The `/api/chat` endpoint uses whichever provider is configured as
`providers.default` in `SageConfig` (Ollama by default); see
`backend/config.py` for the per-provider settings.
