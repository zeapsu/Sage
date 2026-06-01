# Sage — Agent Handoff (May 26, 2026)

> Fast handoff context for humans and coding agents. Main at commit `53b83e0` is the baseline product truth; this branch layers local owner-profile setup/settings work on top.

## Current Product Truth

**Sage** is a local-first desktop knowledge agent built with Tauri + Next.js 15 / React 19 / Tailwind v4 and a FastAPI backend.

The product is no longer an arXiv-first social/feed summarizer. Legacy arXiv search and paper summarization endpoints still exist as discovery/import paths, but the center of the product is **user-owned sources organized into Tomes**.

Current default UI: **Tome Home** (`frontend/src/app/page.tsx`). It presents a source-first workspace with capability buttons for Sources, Report, Quiz, Flashcards, Audio, and Chat.

## Current Branch Context

This branch keeps the owner-specific greeting and adds the local profile flow needed to make that greeting work for new users:

- New users see an initial setup flow to enter their name and user-specific details.
- Profile data lives locally on the user's device via the browser `localStorage` contract in `frontend/src/lib/user-profile.ts`.
- Returning users keep the owner-specific Tome Home greeting.
- Users can edit their local profile details from Settings.
- `ProfileSetup` and `SettingsPanel` are part of the current Tome Home surface, not legacy UI.
- `/settings` is an explicit slash-command route; natural-language prompts still stay in chat.
- Local profile persistence has a focused Node test script (`frontend/scripts/test-user-profile.mjs`) wired into `npm test`.

## Completed In This Branch

- Implemented first-run local profile setup and editable settings while preserving the Tome Home default UI.
- Added a small local profile utility layer for loading, saving, validating, and normalizing owner profile data.
- Preserved owner-specific greetings through locally stored setup data instead of a built-in owner profile.
- Fixed the Tauri config schema issue found during validation.
- Updated the Tauri desktop window from the old compact command-bar dimensions to a resizable Tome Home-sized window, and enabled macOS transparent-window support.
- Documented the frontend Node runtime range and added `frontend/.nvmrc` so macOS/dev environments can use Node 22 LTS instead of newer current Node releases that emit upstream `DEP0205` dev warnings.
- Organized project documentation under `docs/` with purpose-based subdirectories.
- Moved agent onboarding/contract docs into `docs/agents/` and added `docs/agents/README.md` as the coding-agent entrypoint.
- Refreshed README/doc links so current product truth points at Tome Home, local-first storage, and the agent onboarding context instead of old root-level or planning paths.

## Important Directional Constraints

- Preserve **Tome Home as the default landing UI**.
- Preserve the **Ethereal Console** design direction: dark, luminous, desktop-command interface with depth/soft surfaces rather than old blue/white feed UI.
- Preserve **explicit slash-command routing**. `frontend/src/lib/command-routing.ts` intentionally routes only slash commands and first-party capability chip prompts; natural-language questions should stay in chat.
- Preserve owner-specific/local-first behavior: profile details should remain on-device unless a future design explicitly asks otherwise.
- Next likely roadmap: **BYOA / bring-your-own-agent integration**, while keeping provider flexibility and local-first storage.
- Keep PR #41 unrelated to this docs housekeeping branch.

## Architecture Snapshot

### Frontend

- `frontend/src/app/page.tsx`: Tome Home app shell, local setup/profile loading, owner greeting, and routed views.
- `frontend/src/lib/command-routing.ts`: explicit routing for `/quiz`, `/flashcards`, `/audio`, `/report`, `/history`, `/tomes`, `/knowledge`, `/settings`, etc.
- `frontend/src/lib/user-profile.ts`: local user profile contract, validation/normalization helpers, and `localStorage` key for owner-specific greetings/settings.
- `frontend/src/components/ProfileSetup.tsx`: first-run local profile setup flow.
- `frontend/src/components/SettingsPanel.tsx`: editable local profile/settings surface.
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
- Agent/frontend skill contract: [`skill-spec.md`](skill-spec.md)
- Historical phase plan: [`../planning/phase-1-plan.md`](../planning/phase-1-plan.md)
- Early legacy TODO: [`../planning/legacy-todo.md`](../planning/legacy-todo.md)
- Archived legacy cleanup notes: [`../archive/legacy-cleanup-plan.md`](../archive/legacy-cleanup-plan.md)

## Known Legacy / Historical Areas

- Old feed-oriented components still exist (`Feed`, `Post`, `KeywordSearch`, `SearchBar`, `TableOfContents`, `LoadingSpinner`, `TomeList`) and are documented in the archive cleanup note. Do not remove them in docs-only work.
- Some historical docs still contain implementation-plan language from earlier phases. Treat them as planning/archive unless they conflict with this file or README.
- The backend still includes legacy arXiv summarization paths and DeepSeek-specific service code; describe this as legacy/discovery support, not as the product center.

## Near-Term Follow-Up Notes

1. Next MVP step: design and implement BYOA / bring-your-own-agent settings and runtime wiring. Start with a local-first provider configuration surface, then connect it to the existing backend provider abstraction without weakening explicit slash-command routing.
2. Define the BYOA capability contract: provider/tool-call capabilities, local vs hosted execution, safe skill exposure, and how unavailable capabilities degrade in Tome Home.
3. Keep Tome/source flows first-class across chat, retrieval, generated artifacts, and history.
4. Continue grounding/export polish for generated artifact views.
5. Database schema changes should include explicit migration handling for existing `~/.sage/` stores.
