# Sage docs

Reference notes for changes made on this branch (`add-backend-requirements-txt`)
since the last commit on `main` (`92b46c8 build: add backend/requirements.txt`).
Each file documents one feature area: what was added, where it lives, and how
to use it.

## Contents

- [agentation-install.md](./agentation-install.md) — installing the Agentation
  dev panel in the Next.js app.
- [chat-backend-integration.md](./chat-backend-integration.md) — wiring
  `ChatWidget` to the live `/api/chat` endpoint (replaces the simulated reply).
- [knowledge-base-ui.md](./knowledge-base-ui.md) — the upload modal next to the
  command bar and the `KnowledgeBaseWidget` for browsing ingested documents.
- [in-chat-command-routing.md](./in-chat-command-routing.md) — shared verb
  detection so the command bar *and* the chat input both route "quiz",
  "flashcards", "knowledge", etc. to the right view.
- [generation-endpoints.md](./generation-endpoints.md) — backend
  `/api/generate/flashcards` and `/api/generate/quiz` plus the
  `FlashcardsView` / `QuizView` wrappers that consume them.
- [audio-generation.md](./audio-generation.md) — `/api/generate/audio`
  narration scripts, OpenAI TTS synthesis, and the dual-mode
  `AudioPlayerWidget` (`<audio>` element when TTS is available, browser
  `SpeechSynthesis` otherwise).

## Conventions used here

- File paths are relative to the repository root.
- Code snippets are illustrative — read the actual files for current source of
  truth; this folder documents intent and shape, not exhaustive APIs.
- Each doc has a **Files touched** list at the bottom so reviewers can map
  features to diffs quickly.
