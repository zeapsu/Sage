# Audio (TTS) generation

The audio view used to render a hard-coded `SAMPLE_TRACK` and fake playback
with a `setInterval` timer. It now generates a real, KB-grounded narration
script and plays actual audio.

## End-to-end flow

1. User types something containing `audio`, `listen`, or `podcast` (in the
   command bar or in chat). The prompt is captured as `generationPrompt`.
2. `<AudioView prompt={generationPrompt} />` renders a loading card and
   `POST`s to `/api/generate/audio`.
3. Backend retrieves KB chunks (semantic search if a topic is given, random
   sample otherwise — same helper as flashcards/quiz), prompts the configured
   provider for a spoken-style script, and splits it into sentence segments
   with estimated timings (~2.5 words/sec).
4. If an OpenAI API key is configured, the backend also synthesizes the
   script to an MP3 via OpenAI TTS (`tts-1`) and caches it to disk; the
   response includes `audio_url: "/api/audio/{id}.mp3"`.
5. If no key is configured, `audio_url` is `null` and the frontend falls
   back to the browser's `SpeechSynthesis` API for playback.
6. `AudioPlayerWidget` plays the real `<audio>` element or speaks via
   `SpeechSynthesis`, advances the transcript highlight in lockstep, and
   updates the "Download" affordance accordingly.

## Backend

### `POST /api/generate/audio`

Request:

```json
{
  "topic": "string | null",
  "tome_id": "string | null",
  "voice": "alloy | echo | fable | onyx | nova | shimmer | null",
  "provider": "string | null",
  "model":    "string | null"
}
```

Response:

```json
{
  "id":       "<audio_id or local-…>",
  "title":   "Audio: <topic>",
  "voice":    "alloy" | "Browser",
  "provider": "<resolved>",
  "model":    "<resolved>",
  "script":   "Full narration…",
  "segments": [{"id":"s1","text":"…","startTime":0.0,"endTime":4.4}, …],
  "duration": 217.8,
  "audio_url": "/api/audio/<id>.mp3" | null,
  "sources":  [{"document_id":"…","document_title":"…","chunk_index":3,
                "similarity":0.81}, …],
  "topic":    "<echoed>"
}
```

- Segments are produced by a simple sentence regex; durations are
  proportional to word count. They are not word-accurate but are good
  enough for transcript scroll-lock.
- `voice` is the OpenAI TTS voice that was used. Defaults to `alloy`.
  Unknown voices are coerced to `alloy`. When no OpenAI key is present,
  the response labels it `Browser` so the UI can show a "Browser TTS"
  badge in place of the Download button.

### `GET /api/audio/{audio_id}.mp3`

Streams a previously-synthesized file from
`SAGE_AUDIO_CACHE` (defaults to `/tmp/sage_audio`). The id is validated
against `[a-f0-9-]{8,}` to keep the route from being abused as a
directory traversal.

### Empty KB

Same behavior as the other generation endpoints: if the user's KB (or the
scoped tome) has no chunks, the endpoint returns `400` with a pointer to
the upload button.

### Helper reuse

`backend/api/audio.py` imports `_gather_context` and `_empty_kb_error`
from `backend/api/generate.py` (the underscore is a hint, not a hard
boundary). A new `llm_text(...)` helper in `generate.py` does a plain
content-only completion (no JSON-mode), used by audio for the narration
script.

## Frontend

### `AudioPlayerWidget`

Two new props:

- `audioUrl?: string | null` — when set, a hidden `<audio>` element is
  rendered and used as the playback source of truth (`timeupdate` /
  `ended` events drive `currentTime` and `isPlaying`).
- `script?: string` — full narration text. Used by the
  `SpeechSynthesis` fallback so it can speak the remaining text after a
  seek (it can't restart mid-utterance).

Playback semantics differ a bit between the two modes:

|                   | `<audio>` mode                  | SpeechSynthesis mode              |
|-------------------|---------------------------------|------------------------------------|
| Play / pause      | `el.play()` / `el.pause()`      | `synth.speak()` / `synth.cancel()` |
| Seek bar          | Sets `el.currentTime`           | Cancels and restarts speech from the nearest segment |
| ±15s buttons      | Same as seek                    | Same as seek                       |
| Transcript timing | Driven by `timeupdate`          | Driven by a 100ms interval and word-count-based segment times |
| Footer affordance | `<a download>` for the MP3      | "Browser TTS" pill                 |

### `AudioView`

Same shape as the existing `FlashcardsView` / `QuizView` — loading,
error-with-retry, and success states. The sources footer lists distinct
source document titles.

### API client

`generateAudio({ topic, tomeId, voice, provider, model })` in
`frontend/src/lib/sage-api.ts` returns an `AudioGeneration`. A small
`resolveAudioUrl(path)` helper joins the relative audio path with the
active API base (so it works both from the Next.js dev server hitting
`http://localhost:8000` and the Tauri sidecar on `http://127.0.0.1:8080`).

## Limitations

- Word-level subtitle accuracy isn't possible from `/v1/audio/speech`;
  segment timings are an estimate. They're tightly correlated to the
  actual playback rate for `tts-1`, but a long sentence with technical
  jargon will lag slightly.
- The MP3 cache is on local disk (`/tmp/sage_audio` by default). Nothing
  evicts it — fine for dev, but a long-running deployment will want a
  TTL / size cap.
- No streaming yet: the user waits for the script to finish generating
  *and* the MP3 to finish synthesizing before playback can start. Could
  be split into "play once script is ready (SpeechSynthesis)" while the
  MP3 synthesizes in the background, but that's a follow-up.

## Files touched

### Backend

- `backend/api/audio.py` (new) — narration + TTS endpoints.
- `backend/api/generate.py` — added `llm_text(...)` helper.
- `backend/api/chat.py` — updated the "audio" capability description in
  the system prompt so the agent stops calling it a sample track.
- `backend/main.py` — `include_router(audio.router)`.

### Frontend

- `frontend/src/components/AudioPlayerWidget.tsx` — added `audioUrl` and
  `script` props, real `<audio>` mode, SpeechSynthesis fallback,
  conditional Download / Browser-TTS badge.
- `frontend/src/components/AudioView.tsx` (new) — fetch wrapper with
  loading/error states and source footer.
- `frontend/src/lib/sage-api.ts` — added `generateAudio`, `AudioGeneration`,
  `AudioSegment`, `resolveAudioUrl`.
- `frontend/src/app/page.tsx` — uses `<AudioView />` in the audio view-state;
  audio prompts are stored in `generationPrompt` like flashcards/quiz.

## How to enable server-side TTS

Set `OPENAI_API_KEY` in the backend's environment (or `openai.api_key` in
`SageConfig`). The endpoint will automatically synthesize MP3s; otherwise
playback uses the browser voice with no extra setup.
