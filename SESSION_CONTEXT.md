# Sage — Session Context (April 23, 2026)

> Auto-generated context file for session continuity. Contains full project state, decisions made, and pending work.

---

## Project Overview

**Sage** (renamed from "arXivSage") — a local-first desktop knowledge agent. Tauri + Next.js 15 frontend (Tailwind v4), FastAPI backend. Near-term product target is macOS desktop.

**Core concept:** User-uploads sources as the primary workflow (like NotebookLM). arXiv search is a secondary "discover more" feature. "Tomes" = isolated sessions with focused sources, each with their own chat history. Sources can belong to multiple tomes (many-to-many).

**Database:** LanceDB (vector-native) — preferred over SQLite+vector hybrid. Supports metadata filtering (e.g., `notebook_id`) and vector search in one system.

**Upload formats:** PDF, plain text, markdown, URLs (Firecrawl/Jina for scraping)

---

## Design Vision: "The Ethereal Console"

Current direction is **Tome Home + command overlay**, not “only a floating palette.”

- **Tome Home**: default in-app surface implemented in `frontend/src/app/page.tsx`; calm, composer-first, selected-Tome aware, with capability chips.
- **Tome Dashboard**: secondary overview for artifact/source status and generated work management.
- **Global command bar**: future Spotlight/Raycast-style macOS overlay for quick capture, search, Tome opening, and skill launch from anywhere.
- **Focused views**: Chat, Quiz, Flashcards, Audio, Report, History, and Tomes/Sources.

Core principles remain: no heavy chrome, dark charcoal palette, depth over hard dividers, and sparse accent use. Full spec: `DESIGN.md`; current product-surface context: `docs/PRODUCT_SURFACES.md`.

---

## Component Inventory (15 components)

### ✅ Ethereal Console Components and Surfaces — Production-ready

Focused components follow `DESIGN.md` glassmorphic spec. `page.tsx` also owns app-level surfaces: `TomeHome`, `TomeDashboard`, `TopBar`, and `FocusShell`.

| Component | File | Description |
|-----------|------|-------------|
| **CommandBar** | `CommandBar.tsx` | Pill input bar. Keep for future global overlay / focused command input patterns. |
| **ChatWidget** | `ChatWidget.tsx` | Chat card with message bubbles, typing indicator, auto-scroll |
| **QuizWidget** | `QuizWidget.tsx` | Interactive quiz with progress dots, confirm/skip, completion ring |
| **FlashcardWidget** | `FlashcardWidget.tsx` | 3D flip cards (Framer Motion), shuffle/reset, keyboard nav |
| **AudioPlayerWidget** | `AudioPlayerWidget.tsx` | Audio controls, gradient progress bar, transcript with word-highlight |
| **ReportViewWidget** | `ReportViewWidget.tsx` | Markdown report with sidebar TOC, KaTeX math, copy/MD/PDF export |
| **HistoryPanel** | `HistoryPanel.tsx` | Searchable history with type filter pills, grouped by time |
| **TomeSelector** | `TomeSelector.tsx` | Tome picker with search, active state, color-coded icons |

### ⚠️ Legacy Components (7) — ALL ORPHANED (not imported anywhere)

| Component | File | Issue | Action |
|-----------|------|-------|--------|
| **TomeList** | `TomeList.tsx` | Old UI, but has real API CRUD (`sage-api.ts`) | **Merge API logic into TomeSelector, then delete** |
| **KeywordSearch** | `KeywordSearch.tsx` | Old blue/white, uses axios | **Delete** |
| **SearchBar** | `SearchBar.tsx` | Hardcoded colors, redundant (CommandBar replaces) | **Delete** |
| **TableOfContents** | `TableOfContents.tsx` | Hardcoded `text-white` | **Delete** (ReportViewWidget has its own TOC) |
| **Feed** | `Feed.tsx` | Old gray-900 cards | **Delete** |
| **Post** | `Post.tsx` | Old gray-900 cards with Like/Comment | **Delete** |
| **LoadingSpinner** | `LoadingSpinner.tsx` | Hardcoded blue-400 | **Delete** |

---

## Pending Work: Legacy Cleanup

### Step 1: Merge TomeList API logic into TomeSelector

**What TomeList has that TomeSelector doesn't:**
- Real API integration: `listTomes()`, `createTome()`, `deleteTome()` from `sage-api.ts`
- State management: `useEffect` to fetch on mount, `useState` for tomes array
- Create Tome flow: inline form with name + description inputs
- Delete Tome: with confirmation via stopPropagation
- Loading state

**What TomeSelector has that TomeList doesn't:**
- Ethereal Console glassmorphic design (640px card, backdrop-blur, design tokens)
- Search/filter functionality
- Color-coded tome icons (hardcoded per-tome colors like `bg-blue-500/15`)
- Active state indicator
- "New Tome" button (decorative — no onClick handler yet)

**Merge plan:**
1. Add `useEffect` to fetch real tomes on mount
2. Wire up "New Tome" button → inline create form (name + description)
3. Wire up delete (✕ icon with stopPropagation)
4. Add loading state
5. Keep TomeSelector's search, color-coded icons, glassmorphic design

**Open question:** How to handle per-tome colors?
- Currently sample data has hardcoded colors (`bg-blue-500/15`, `bg-emerald-500/15`, etc.)
- Real API tomes don't have a color field
- Options: (1) rotate through a palette dynamically, (2) drop colors, (3) add color to API

### Step 2: Delete all 7 legacy files

```bash
rm frontend/src/components/TomeList.tsx
rm frontend/src/components/KeywordSearch.tsx
rm frontend/src/components/SearchBar.tsx
rm frontend/src/components/TableOfContents.tsx
rm frontend/src/components/Feed.tsx
rm frontend/src/components/Post.tsx
rm frontend/src/components/LoadingSpinner.tsx
```

### Step 3: Verify

- Run `npm run build` to catch any broken imports
- Confirm `sage-api.ts` exports are intact

---

## Agent Skill Spec

Full spec written at `AGENT_SKILL_SPEC.md` (632 lines). Covers:
- `SkillResult` contract (`ui_component` + `data` → frontend dispatch)
- 10 skill definitions with YAML schemas and TypeScript prop interfaces
- Interaction flow diagrams
- Pending work (AudioPlayerWidget needs real `<audio>`, ChatWidget needs streaming, backend integration)

---

## Tech Stack

- **Frontend:** Next.js 15 + Tailwind v4 + shadcn/ui + Framer Motion + Material Symbols
- **Backend:** FastAPI + uv (pyproject.toml + uv.lock)
- **Database:** LanceDB
- **Desktop:** Tauri
- **Font:** Inter
- **Tests:** pytest (41 tests) + GitHub Actions CI

## Key Conventions

- Tailwind v4: tokens go in `@theme` block in `globals.css`, NOT `tailwind.config.js`
- No `--turbopack` (`.next` cache corruption risk)
- Parent flex containers need `w-full`
- CSS: use `surface-container` contrast instead of dividers
- Primary color `#adc6ff` used sparingly ("laser pointer, not paint bucket")
- All components use `"use client"` (Next.js app router)

---

## Git State

~12+ commits ahead of origin. Last commit: `feat: History, TomeSelector, ChatWidget + Report KaTeX fix`

---

## What's Next

| Priority | Item |
|----------|------|
| 🔴 | **Global command bar overlay** — design macOS Spotlight/Raycast-style layer separately from Tome Home |
| 🔴 | **AudioPlayerWidget** — needs `audio_url` prop + real `<audio>` element (currently simulated with setInterval) |
| 🔴 | **ChatWidget** — needs streaming support (SSE/WebSocket, currently static) |
| 🔴 | **Backend integration** — wire up `/api/agent/chat` → Agent Orchestrator → Skill Registry |
| 🟡 | **Piper TTS setup** — voice models + pipeline for `generate_audio_review` |
| 🟡 | **Responsive/viewport testing** |
| 🟡 | **Web scope** — keep hosted/browser product out of scope; browser mode is for development only |
| 🟢 | **ComparisonWidget** / **TimelineWidget** — future dedicated components |
