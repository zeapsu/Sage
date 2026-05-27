# Sage — Session Context (May 26, 2026)

> Current product/development context for humans and coding agents. Main at commit `53b83e0` is the source of truth for this branch.

## Current Product Truth

**Sage** is a local-first desktop knowledge agent built with Tauri + Next.js 15 / React 19 / Tailwind v4 and a FastAPI backend.

The product is no longer an arXiv-first social/feed summarizer. Legacy arXiv search and paper summarization endpoints still exist as discovery/import paths, but the center of the product is **user-owned sources organized into Tomes**.

Current default UI: **Tome Home** (`frontend/src/app/page.tsx`). It presents a source-first workspace with capability buttons for Sources, Report, Quiz, Flashcards, Audio, and Chat.

## Important Directional Constraints

- Preserve **Tome Home as the default landing UI**.
- Preserve the **Ethereal Console** design direction: dark, luminous, desktop-command interface with depth/soft surfaces rather than old blue/white feed UI.
- Preserve **explicit slash-command routing**. `frontend/src/lib/command-routing.ts` intentionally routes only slash commands and first-party capability chip prompts; natural-language questions should stay in chat.
- Next likely roadmap: **BYOA / bring-your-own-agent integration**, while keeping provider flexibility and local-first storage.
- Keep PR #41 unrelated to this docs housekeeping branch.

## Architecture Snapshot

### Frontend

- `frontend/src/app/page.tsx`: Tome Home app shell, local setup/profile loading, and routed views.
- `frontend/src/lib/command-routing.ts`: explicit routing for `/quiz`, `/flashcards`, `/audio`, `/report`, `/history`, `/tomes`, `/knowledge`, `/settings`, etc.
- `frontend/src/lib/user-profile.ts`: local user profile contract and `localStorage` key for owner-specific greetings/settings.
- `frontend/src/lib/sage-api.ts`: typed API client, browser backend URL, and Tauri sidecar backend startup.
- Current routed views/components include:
  - `KnowledgeBaseWidget`
  - `TomeSelector`
  - `ChatWidget`
  - `QuizView` / `QuizWidget`
  - `FlashcardsView` / `FlashcardWidget`
  - `AudioView` / `AudioPlayerWidget`
  - `ReportView` / `ReportViewWidget`
  - `HistoryPanel`
  - `ProfileSetup`
  - `SettingsPanel`
  - `UploadModal`

### Backend

- `backend/main.py`: FastAPI app setup, Sage routers, legacy arXiv endpoints.
- `backend/api/`: knowledge, chat, Tomes, skills, generate, audio routes.
- `backend/store/`: SQLite-backed local knowledge/session store.
- `backend/skills/`: skill registry plus built-in `search_docs` and `read_document`.
- `backend/providers/`: provider abstraction direction for local/hosted LLMs.
- Runtime config/data is created under `~/.sage/` when needed.

## Documentation Map

- Product vision: [`../product/vision.md`](../product/vision.md)
- UI/design spec: [`../design/ethereal-console.md`](../design/ethereal-console.md)
- Original Stitch prompt: [`../design/stitch-prompt.md`](../design/stitch-prompt.md)
- Agent/frontend skill contract: [`../agent/skill-spec.md`](../agent/skill-spec.md)
- Historical phase plan: [`phase-1-plan.md`](phase-1-plan.md)
- Early legacy TODO: [`legacy-todo.md`](legacy-todo.md)
- Archived legacy cleanup notes: [`../archive/legacy-cleanup-plan.md`](../archive/legacy-cleanup-plan.md)

## Known Legacy / Historical Areas

- Old feed-oriented components still exist (`Feed`, `Post`, `KeywordSearch`, `SearchBar`, `TableOfContents`, `LoadingSpinner`, `TomeList`) and are documented in the archive cleanup note. Do not remove them in docs-only work.
- Some historical docs still contain implementation-plan language from earlier phases. Treat them as planning/archive unless they conflict with this file or README.
- The backend still includes legacy arXiv summarization paths and DeepSeek-specific service code; describe this as legacy/discovery support, not as the product center.

## Near-Term Follow-Up Notes

1. BYOA/bring-your-own-agent design should clarify provider/tool-call capabilities, local vs hosted execution, and how Sage exposes skills safely.
2. Tome/source flows should remain first-class across chat, retrieval, generated artifacts, and history.
3. Generated artifact views need continued grounding/export polish.
4. Database schema changes should include explicit migration handling for existing `~/.sage/` stores.
