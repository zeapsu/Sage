# Generation endpoints: flashcards & quizzes

Previously `FlashcardWidget` and `QuizWidget` rendered hard-coded
`SAMPLE_FLASHCARDS` / `SAMPLE_QUESTIONS` regardless of what the user typed.
Two new backend endpoints generate real artifacts grounded in the knowledge
base, and two new view wrappers (`FlashcardsView`, `QuizView`) consume them.

## Backend: `backend/api/generate.py`

Single router mounted at `/api/generate`, registered from
`backend/main.py`.

### `POST /api/generate/flashcards`

Request body (all fields optional except by validation):

```json
{
  "topic": "string | null",
  "tome_id": "string | null",
  "count": 6,
  "provider": "string | null",
  "model":    "string | null"
}
```

Response:

```json
{
  "cards": [{"id": "fc-…", "front": "…", "back": "…"}],
  "topic": "…",
  "sources": [
    {"document_id": "…", "document_title": "…", "chunk_index": 0,
     "similarity": 0.812}
  ]
}
```

`count` is clamped to `[1, 20]`.

### `POST /api/generate/quiz`

Same request shape. Response:

```json
{
  "questions": [
    {"id": "q-…",
     "question": "…",
     "options": [{"id":"a","text":"…"}, …],
     "correctOptionId": "b",
     "explanation": "…"}
  ],
  "topic": "…",
  "sources": [ … ]
}
```

`count` is clamped to `[1, 15]`. Each question is validated to have ≥2
options and a `correctOptionId` matching one of them; questions that fail
validation are dropped before responding.

### How grounding works

`_gather_context()` decides what excerpts to feed the model:

1. If `topic` is non-empty, it runs the existing `SearchDocsSkill` (semantic
   search over chunk embeddings, optionally scoped to the tome) and uses
   the top results.
2. If no topic — or the semantic search returned nothing — it falls back to
   a random sample of chunks from the tome (or the whole KB if no tome is
   set). This is what lets a bare "make flashcards" command still work.
3. If the KB has zero chunks in scope, the endpoint returns `400` with a
   hint to upload documents first.

### How the JSON is produced

`_llm_json()` calls the configured provider via `providers/factory.py`
with no tools and a strongly-worded system prompt. For OpenAI-compatible
providers (`openai`, `deepseek`) it also passes
`response_format={"type": "json_object"}`. The model output is then run
through `_extract_json()`, which tries (in order):

1. Any ` ```json … ``` ` fenced blocks.
2. The whole stripped response.
3. The widest `{ … }` or `[ … ]` substring.

If nothing parses, the endpoint returns `502` with the parser error so
the UI can surface a useful retry.

## Frontend wrappers

- `frontend/src/components/FlashcardsView.tsx` — calls `generateFlashcards`,
  shows a loading card, an error card with retry, or `FlashcardWidget`
  with the real cards. Appends a "Grounded in:" footer listing distinct
  source document titles.
- `frontend/src/components/QuizView.tsx` — mirror of the above for
  `generateQuiz` + `QuizWidget`.

`page.tsx` renders these instead of the original widgets in the
`"flashcards"` / `"quiz"` view-states, passing the user's command text in
as `prompt`. The same `prompt` is captured whether the user invoked the
verb from the command bar or from inside the chat (see
[in-chat-command-routing.md](./in-chat-command-routing.md)).

### API client

`frontend/src/lib/sage-api.ts` exposes:

- `generateFlashcards(opts)` → `FlashcardGeneration`
- `generateQuiz(opts)` → `QuizGeneration`

Both share `GenerateOpts = { topic?, tomeId?, count?, provider?, model? }`
and `GeneratedSource` shape.

## Limitations

- Generation latency depends entirely on the configured provider/model. The
  defaults (`ollama` + `llama3.1:8b`) need a local Ollama server running;
  if it's unreachable the error surfaces in the view's error card.
- The "topic" is currently the verbatim command string ("make flashcards on
  attention"). The model is told what to do via the system prompt, so this
  works, but a smarter parse (e.g., stripping the verb) would tighten the
  retrieval query.
- No persistence yet — generated flashcards and quizzes only live in the
  view's React state and are regenerated on every visit.

## Files touched

### Backend

- `backend/api/generate.py` (new) — router with both endpoints.
- `backend/main.py` — import + `include_router(generate.router)`.

### Frontend

- `frontend/src/lib/sage-api.ts` — added `generateFlashcards`,
  `generateQuiz`, and matching types.
- `frontend/src/components/FlashcardsView.tsx` (new).
- `frontend/src/components/QuizView.tsx` (new).
- `frontend/src/app/page.tsx` — uses the new view wrappers; tracks
  `generationPrompt`; added `\btest(s|ing)?\b` to the quiz route.
