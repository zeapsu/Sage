# Sage

> A local-first desktop knowledge agent for turning your own sources into chat, reports, quizzes, flashcards, and audio reviews.

Sage is a Tauri + Next.js + FastAPI app for working with a personal knowledge base. The core workflow is simple: bring documents into a local store, organize focused source sets as Tomes, then ask Sage to synthesize grounded outputs from those sources.

## Vision

Sage is moving toward a NotebookLM-like experience that stays local-first and provider-flexible:

- **Bring your own sources**: PDFs, Markdown, notes, pasted text, and eventually web captures or vault syncs.
- **Tomes**: focused workspaces that isolate source sets and chat history.
- **Bring your own agent/provider**: local models, Ollama, OpenAI-compatible APIs, Anthropic, DeepSeek, and other providers through a small backend abstraction.
- **Grounded outputs**: chat, reports, quizzes, flashcards, and audio reviews that cite or otherwise remain tied to the selected sources.
- **Floating desktop UX**: an Ethereal Console style interface that feels like a lightweight intelligence layer over the OS.

arXiv support and paper summarization remain useful discovery paths, but they are no longer the center of the product. The main direction is user-owned local knowledge.

## Current Features

- **Tauri desktop shell** with a Next.js 15 frontend.
- **FastAPI backend** for knowledge, chat, Tomes, providers, and research discovery endpoints.
- **Local knowledge store** with document chunks, embeddings, sessions, and Tome/source links.
- **Floating command UI** with chat, report, quiz, flashcard, audio, history, and Tome-oriented components.
- **Tailwind v4 design tokens** for the dark Ethereal Console visual system.
- **pytest backend suite** and GitHub Actions CI.

## Project Direction Docs

Several planning/specification files in the repo describe where Sage is headed:

- `BRAINSTORM.md`: product direction from arXiv summarizer to local knowledge agent.
- `DESIGN.md`: Ethereal Console UI/UX specification.
- `PLAN.md`: implementation plan for the local knowledge agent foundation.
- `AGENT_SKILL_SPEC.md`: contract between backend skills and frontend UI components.
- `STITCH_PROMPT.md`: original design prompt/reference for the floating UI.
- `SESSION_CONTEXT.md`: current project state and next-session context.
- `LEGACY_CLEANUP_PLAN.md`: notes for removing old pre-Ethereal components.

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

The backend creates default local config under `~/.sage/` when needed.

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
│   ├── api/                 # Chat, knowledge, skills, Tomes, and related routes
│   ├── providers/           # LLM provider abstraction
│   ├── services/            # Legacy research/PDF services and shared helpers
│   ├── skills/              # Backend skill registry and built-in skills
│   ├── store/               # Local knowledge/session data models and SQLite store
│   ├── pyproject.toml       # uv-managed backend dependencies
│   └── main.py              # FastAPI application entry point
├── frontend/                # Next.js + Tauri frontend
│   ├── src/app/             # Next.js app shell
│   ├── src/components/      # Ethereal Console UI components
│   ├── src/lib/             # Typed API client and frontend utilities
│   └── src-tauri/           # Tauri desktop configuration
├── designs/                 # Design references and generated visual artifacts
├── *.md                     # Product, design, agent, and implementation docs
└── README.md
```

## Near-Term Roadmap

- Finish replacing old pre-Ethereal UI paths with the Ethereal Console components.
- Make Tomes first-class across upload, chat, retrieval, history, and generated artifacts.
- Improve report rendering and exports, likely moving toward an HTML-friendly artifact model.
- Add explicit schema migrations for existing local Sage databases.
- Expand evaluation coverage for retrieval quality, grounding, and generated artifact correctness.

## Contributing

Contributions are welcome. Smaller PRs are much easier to review and merge than large parallel rewrites. Good contribution slices include focused backend endpoints, one UI surface at a time, tests for existing behavior, schema migrations, and documentation updates.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
