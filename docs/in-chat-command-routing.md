# In-chat command routing

The verb router used to live only in the command bar. Once the user was in
the chat view, typing "make flashcards on attention" into the chat textarea
went straight to `/api/chat` and came back as markdown describing flashcards,
instead of switching to the flashcards view.

This refactor lifts the verb-detection logic into a shared
`detectView(text)` helper at the page level and exposes it to `ChatWidget`
through an `onCommand` callback.

## Behavior

- `detectView(text)` returns one of the non-chat view states (or `null`).
  Supported keyword groups:

  | Keyword(s)                                                  | View         |
  |-------------------------------------------------------------|--------------|
  | `quiz`, whole-word `test` / `tests` / `testing`             | `quiz`       |
  | `flashcard`, `flash card`                                   | `flashcards` |
  | `audio`, `listen`, `podcast`                                | `audio`      |
  | `report`, `study guide`, `summary`                          | `report`     |
  | `history`                                                   | `history`    |
  | `tome`, `collection`, `library`                             | `tomes`      |
  | `knowledge`, `kb`, `docs`, `documents`, `knowledge base`, … | `knowledge`  |

  Anything else falls through to chat.

- `page.tsx` passes `handleChatCommand(text)` into `ChatWidget` as
  `onCommand`. Inside `ChatWidget`, `handleSend` (and the `initialQuery`
  effect) call `onCommand?.(text)` first — if it returns `true`, the chat
  call is skipped and the page has already switched view.

- For `quiz` / `flashcards`, the matching prompt is also stored as
  `generationPrompt` so `FlashcardsView` / `QuizView` can pass it as the
  `topic` to the generation endpoints. See
  [generation-endpoints.md](./generation-endpoints.md).

## Agent self-awareness of routing

The frontend intercepts and routes verb-containing prompts *before* they
reach the chat endpoint, so the chat model never actually executes a
"make flashcards" instruction itself. But users still ask "what can you
do?" inside chat, and the model needs to answer correctly.

To handle that, `SYSTEM_PROMPT` in `backend/api/chat.py` includes an
"App capabilities you should know about" section that lists every routing
keyword and the view it opens, plus the upload-modal flow for getting
documents into the knowledge base. The prompt also tells the model:

- *Do not* try to render quizzes, flashcards, audio, etc., as markdown —
  point the user at the keyword and let the app open the real view.
- If the user invokes a routed feature inside chat, the app switches views
  before the model's reply is needed, so the model can safely no-op.

Keep this section in sync with `detectView` in `frontend/src/app/page.tsx`
whenever a new keyword group is added — they are the single source of
truth pair for in-app capabilities.

## Why "test" uses a word boundary

`test` appears mid-word a lot ("testimony", "latest"). The detector uses
`/\btest(s|ing)?\b/` so only `test`, `tests`, or `testing` as standalone
words trigger the quiz view.

## Files touched

- `frontend/src/app/page.tsx` — extracted `detectView`, added
  `handleChatCommand`, threaded `generationPrompt` state.
- `frontend/src/components/ChatWidget.tsx` — added `onCommand` prop and
  short-circuit in `handleSend` / initial-query effect.
- `backend/api/chat.py` — extended `SYSTEM_PROMPT` with the
  "App capabilities you should know about" section so the agent can
  describe its own routed features when asked.
