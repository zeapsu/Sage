# History panel

The history view (`HistoryPanel.tsx`) used to render a hard-coded
`SAMPLE_HISTORY` array. It now reads live chat-session data from the
backend so every conversation the user has had with Sage shows up here.

## Data flow

```
HistoryPanel ──▶ listChatSessions()      (src/lib/sage-api.ts)
              ──▶ GET /api/chat/sessions (backend/api/chat.py)
              ──▶ KnowledgeStore.list_sessions()
                      (backend/store/db.py — SQL over sessions + messages + tomes)
```

## Backend

### `KnowledgeStore.list_sessions(limit=100)`

Single SQL query over `sessions`, `messages`, and `tomes`. For each
session it returns:

| field                | source                                              |
| -------------------- | --------------------------------------------------- |
| `id`                 | `sessions.id`                                       |
| `tome_id`            | `sessions.tome_id`                                  |
| `tome_name`          | `tomes.name` via `LEFT JOIN`                        |
| `provider`, `model`  | `sessions.provider`, `sessions.model`               |
| `created_at`         | `sessions.created_at`                               |
| `first_user_message` | earliest `messages.content` with `role='user'`      |
| `last_message_at`    | most recent `messages.created_at` (or session ts)   |
| `message_count`      | `COUNT(*)` of messages in the session               |

Results are sorted by `last_message_at DESC` so the freshest activity
appears first.

### `GET /api/chat/sessions?limit=<n>`

Thin FastAPI wrapper around `list_sessions`. Returns
`{ "sessions": [...] }`. Default `limit` is 100, the same as the store.

## Frontend

### `listChatSessions()` (src/lib/sage-api.ts)

Typed client wrapper that returns `ChatSessionSummary[]`. The shape
mirrors the backend dict exactly.

### `HistoryPanel` (src/components/HistoryPanel.tsx)

- On mount, fetches up to 200 sessions.
- Filters out sessions with `message_count === 0` or no
  `first_user_message` — those are stub sessions created by the chat
  endpoint that never received a user turn.
- Derives a row title from the first user message (truncated to 90
  chars, first line only).
- Groups rows into "Today", "Yesterday", "Earlier this week", "Older"
  buckets using local time. The bucket label and per-row timestamp
  share a single `formatTimestamp` helper so they stay consistent.
- Search input filters by title or tome name (client-side).
- Empty/loading/error states are handled inline.
- `onSelect` is still exposed as a prop for the eventual "resume this
  session" hand-off, but `page.tsx` does not yet pass one — clicking a
  row is a no-op for now.

## SQLite timestamp gotcha

`sessions.created_at` defaults to `datetime('now')`, which returns
`YYYY-MM-DD HH:MM:SS` in UTC with no `Z` suffix. `Message.created_at`
uses Python `datetime.utcnow().isoformat()` which *does* include a `T`.
`formatTimestamp` normalises both forms before constructing a `Date`,
so mixed records render correctly.

## Why no quiz / flashcard / audio / report rows yet?

The schema only persists chat sessions. Quiz and flashcard generations
are stateless POSTs (`/api/generate/...`) — nothing is written to disk.
Audio and report views still render sample fixtures. When any of those
gain server-side persistence, extend `list_sessions` (or add sibling
endpoints) and widen the `HistoryItem["type"]` union — the `ICONS` map
already follows that shape.
