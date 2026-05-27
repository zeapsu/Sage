# Sage

> A local-first desktop knowledge agent for turning your own sources into chat, reports, quizzes, flashcards, and audio reviews.

Sage is a Tauri + Next.js + FastAPI app for working with a personal knowledge base. The current default UI is **Tome Home**: a source-first workspace where you add knowledge, choose or create Tomes, and route explicit actions to focused learning/research views.

## Product Truth

Sage is no longer centered on an Instagram-style arXiv summarizer. arXiv search and paper summarization remain useful discovery/import paths, but the main product is user-owned local knowledge:

- **Bring your own sources**: text, Markdown, PDFs, pasted notes, and eventually web/vault syncs.
- **Tomes**: focused workspaces that group source sets and provide a home for chat history and generated artifacts.
- **Bring your own agent/provider (BYOA)**: local and hosted providers through a small backend abstraction; the next likely roadmap emphasis is deeper BYOA / bring-your-own-agent integration.
- **Grounded outputs**: chat, reports, quizzes, flashcards, and audio reviews tied to the selected sources.
- **Explicit command routing**: slash commands and first-party capability chips open generated views; ordinary natural-language questions stay in chat.
- **Ethereal Console direction**: the interface should keep the lightweight, luminous desktop-command feel while Tome Home remains the default landing experience.

## Current Features

- **Tome Home default UI** with source, report, quiz, flashcard, audio, chat, history, Tome, and settings navigation.
- **Local user profile setup** that stores a name and user-specific details in browser `localStorage` for owner-specific greetings and editable settings.
- **Tauri v2 desktop shell** with a Next.js 15 / React 19 frontend.
- **FastAPI backend** for knowledge, chat, Tomes, skills, provider config, generation, audio, and legacy research endpoints.
- **Local knowledge store** under `~/.sage/` with documents, chunks, sessions, and Tome/source links.
- **Typed frontend API client** that can use a browser backend (`NEXT_PUBLIC_API_URL`) or a Tauri sidecar backend (`NEXT_PUBLIC_DESKTOP_API_URL`).
- **Tailwind v4 design tokens** for the dark Ethereal Console visual system.
- **pytest backend suite** and GitHub Actions CI.

## Documentation

Root-level planning/spec Markdown has been organized under `docs/`:

- [`docs/product/vision.md`](docs/product/vision.md): product direction from arXiv summarizer to local knowledge agent.
- [`docs/design/ethereal-console.md`](docs/design/ethereal-console.md): Ethereal Console UI/UX specification.
- [`docs/design/stitch-prompt.md`](docs/design/stitch-prompt.md): original Stitch prompt/reference for the floating UI.
- [`docs/agent/skill-spec.md`](docs/agent/skill-spec.md): contract between backend skills and frontend UI/components.
- [`docs/planning/session-context.md`](docs/planning/session-context.md): current project state and next-session context.
- [`docs/planning/phase-1-plan.md`](docs/planning/phase-1-plan.md): historical implementation plan for the local knowledge foundation.
- [`docs/planning/legacy-todo.md`](docs/planning/legacy-todo.md): archived early project checklist.
- [`docs/archive/legacy-cleanup-plan.md`](docs/archive/legacy-cleanup-plan.md): cleanup notes for old pre-Ethereal components.

## Tech Stack

### Frontend

- Next.js 15
- React 19
- Tailwind CSS v4
- Tauri v2 desktop shell
- Framer Motion for interactive UI pieces

### Backend

- FastAPI
- Python 3.11+
- SQLite-backed local knowledge/session store
- sentence-transformers embeddings
- Provider abstraction for local and hosted LLMs
- `uv` for dependency management

## Getting Started

### Prerequisites

- Node.js 20+
- Rust, latest stable
- Python 3.11+
- `uv`

### Backend Setup

```bash
cd backend
uv sync --group dev
uv run uvicorn main:app --reload
```

The backend creates default local config and data under `~/.sage/` when needed.

Optional provider keys can be configured through environment variables or Sage config, for example:

```bash
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
DEEPSEEK_API_KEY=...
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Tauri Development

From `frontend/`:

```bash
npm run tauri:dev
```

### Tests

Backend:

```bash
cd backend
uv run --group dev pytest
```

Frontend production build:

```bash
cd frontend
npm run build
```

## Project Structure

```text
Sage/
├── backend/                 # FastAPI backend and local knowledge agent services
│   ├── api/                 # Chat, knowledge, skills, Tomes, generation, audio routes
│   ├── providers/           # LLM provider abstraction
│   ├── services/            # Legacy research/PDF services and shared helpers
│   ├── skills/              # Backend skill registry and built-in skills
│   ├── store/               # Local knowledge/session data models and SQLite store
│   ├── pyproject.toml       # uv-managed backend dependencies
│   └── main.py              # FastAPI application entry point
├── frontend/                # Next.js + Tauri frontend
│   ├── src/app/             # Tome Home app shell and routed views
│   ├── src/components/      # Ethereal Console / Tome Home UI components
│   ├── src/lib/             # Typed API client and explicit command routing
│   └── src-tauri/           # Tauri desktop configuration
├── designs/                 # Design references and generated visual artifacts
├── docs/                    # Product, design, agent, planning, and archive docs
└── README.md
```

## Near-Term Roadmap

- Deepen BYOA / bring-your-own-agent support without locking Sage to one provider or orchestration style.
- Preserve explicit slash-command routing so natural-language chat is not hijacked into generated views.
- Continue making Tomes first-class across upload, chat, retrieval, history, and generated artifacts.
- Keep Ethereal Console as the interaction/design direction while Tome Home remains the default UI.
- Improve generated artifact rendering/export and evaluation coverage for retrieval, grounding, and generation quality.
- Add explicit migrations for existing local Sage databases as schemas evolve.

## Contributing

Contributions are welcome. Smaller PRs are much easier to review and merge than large parallel rewrites. Good contribution slices include focused backend endpoints, one UI surface at a time, tests for existing behavior, schema migrations, and documentation updates.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
