# arXivSage → "Sage" — Direction Overhaul Brainstorm

> **Goal**: Transform from a RAG-only arXiv summarizer into a local "NotebookLM-like" knowledge app with BYOA (Bring Your Own Agent) and a skill/tool system.

---

## Current State (What We Have)

**Architecture**: Tauri desktop app (Next.js + Tailwind frontend, FastAPI backend)
**What it does**: Search arXiv → download PDFs → extract text → summarize with DeepSeek → Instagram-style feed
**Strengths**: 
- Working Tauri desktop app (cross-platform)
- Clean FastAPI backend with caching
- PDF extraction pipeline (pdfplumber)
- Decent React component structure

**Limitations**:
- Hardcoded to DeepSeek API (single provider)
- RAG IS the entire workflow, not a tool in a larger system
- No local data persistence (in-memory caches only)
- No agent/tool paradigm
- Limited to arXiv papers only
- No concept of a "knowledge base" — papers are transient

---

## The Vision: "Sage" — Local Knowledge Agent

### Core Idea
A local-first desktop app where users:
1. **Import documents** (PDFs, markdown, Obsidian vault, web clips, etc.) into a local knowledge store
2. **Connect any agent provider** (OpenAI, Anthropic, local Ollama, DeepSeek, etc.) via BYOA config
3. **Use skills/tools** that the app supplies to the agent, enabling: quizzes, flashcards, reports, Q&A, comparisons, timelines, and more
4. **Interact via chat UI** — the agent uses tools to read from the knowledge store and produce outputs

### Analogy
Think of it as **NotebookLM** (Google's "your data, AI-powered") but:
- **Local-first** (no cloud dependency)
- **BYOA** (not locked to one LLM provider)
- **Extensible** (skill/plugin system for new capabilities)
- **Knowledge-agnostic** (not just PDFs — any data source)

---

## Architecture Proposal

```
┌─────────────────────────────────────────────────────────────┐
│                     Tauri Desktop App                       │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │   Next.js UI     │    │       FastAPI Backend        │   │
│  │                  │    │                              │   │
│  │  ┌────────────┐  │    │  ┌────────────────────────┐  │   │
│  │  │ Chat Panel │◄─┼────┼─►│    Agent Orchestrator  │  │   │
│  │  └────────────┘  │    │  │  (BYOA config + loop)  │  │   │
│  │                  │    │  └────────┬───────────────┘  │   │
│  │  ┌────────────┐  │    │           │                  │   │
│  │  │ Doc Browser│  │    │  ┌────────▼───────────────┐  │   │
│  │  └────────────┘  │    │  │     Skill Registry     │  │   │
│  │                  │    │  │  (tools exposed to AI)  │  │   │
│  │  ┌────────────┐  │    │  └────────┬───────────────┘  │   │
│  │  │  Settings  │  │    │           │                  │   │
│  │  └────────────┘  │    │  ┌────────▼───────────────┐  │   │
│  └──────────────────┘    │  │   Knowledge Store API   │  │   │
│                          │  │  (docs, chunks, meta)   │  │   │
│                          │  └────────┬───────────────┘  │   │
│                          │           │                  │   │
│                          └───────────┼──────────────────┘   │
│                                      │                      │
│                          ┌───────────▼──────────────────┐   │
│                          │      Local Storage Layer      │   │
│                          │  ┌─────────┐  ┌────────────┐ │   │
│                          │  │ SQLite  │  │ File Store │ │   │
│                          │  │ (meta,  │  │ (PDFs, MD, │ │   │
│                          │  │ chunks, │  │  images,   │ │   │
│                          │  │ vectors)│  │  vaults)   │ │   │
│                          │  └─────────┘  └────────────┘ │   │
│                          └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Knowledge Store (Local Data)

### Storage Options

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **SQLite + sqlite-vss** | Single file, zero config, vector search built-in | Limited to ~100K docs practically | ★ **Default** — perfect for local-first |
| **ChromaDB** | Purpose-built for embeddings, simple API | Another dependency, heavier | Optional extension |
| **DuckDB + pgvector compat** | Fast analytics, columnar | Overkill for this use case | Skip |
| **Obsidian vault** | User already has notes there | Read-heavy, we shouldn't write to it | **Integration source** |

### Data Model (SQLite)

```sql
-- Documents (papers, notes, web clips, etc.)
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT,           -- 'arxiv', 'obsidian', 'upload', 'url'
    source_id TEXT,        -- arXiv ID, file path, URL
    doc_type TEXT,         -- 'pdf', 'markdown', 'web', 'note'
    metadata JSON,         -- authors, date, tags, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunks (for RAG / search)
CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id),
    chunk_index INTEGER,
    content TEXT NOT NULL,
    embedding BLOB,        -- stored as binary (sqlite-vss or manual)
    metadata JSON
);

-- Collections (grouping docs — like NotebookLM "notebooks")
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_docs (
    collection_id TEXT REFERENCES collections(id),
    document_id TEXT REFERENCES documents(id),
    PRIMARY KEY (collection_id, document_id)
);

-- Agent sessions & history
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    collection_id TEXT REFERENCES collections(id),
    provider TEXT,         -- 'openai', 'anthropic', 'ollama', etc.
    model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    role TEXT,             -- 'user', 'assistant', 'tool'
    content TEXT,
    tool_calls JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Data Sources (Ingestion)

| Source | How | Priority |
|--------|-----|----------|
| **PDF upload** | Existing pdfplumber pipeline + new embedding step | P0 |
| **arXiv search** | Keep existing ArxivService, auto-ingest results | P0 |
| **Obsidian vault** | Read .md files from vault path, index as documents | P1 |
| **URL/web clip** | Fetch URL → extract text → ingest | P1 |
| **Markdown file** | Direct upload | P0 |
| **YouTube transcript** | Leverage existing yt-dlp/transcript tools | P2 |
| **Notion export** | Import from Notion markdown export | P3 |

---

## Layer 2: BYOA — Agent Provider System

### Provider Interface

```python
class AgentProvider(ABC):
    """Abstract interface for any LLM provider."""
    
    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],    # Sage's skill tools
        model: str,
        **kwargs
    ) -> AgentResponse:
        ...
```

### Supported Providers (initial)

| Provider | Config | Notes |
|----------|--------|-------|
| **OpenAI** | `OPENAI_API_KEY` | GPT-4o, o3-mini, etc. Native tool calling |
| **Anthropic** | `ANTHROPIC_API_KEY` | Claude models. Native tool use |
| **DeepSeek** | `DEEPSEEK_API_KEY` | Keep existing. OpenAI-compatible API |
| **Ollama** | `http://localhost:11434` | Local models. Free. Tool support varies |
| **OpenRouter** | `OPENROUTER_API_KEY` | Access 100+ models via one key |
| **LiteLLM** | `LITELLM_BASE_URL` | Self-hosted proxy to any provider |

### Config Storage

```yaml
# ~/.sage/config.yaml
providers:
  default: "ollama"
  
  ollama:
    base_url: "http://localhost:11434"
    default_model: "llama3.1:8b"
    
  openai:
    api_key: "${OPENAI_API_KEY}"
    default_model: "gpt-4o-mini"
    
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"
    default_model: "claude-sonnet-4-20250514"

knowledge_store:
  path: "~/.sage/knowledge.db"
  
obsidian:
  vault_path: "~/Documents/ObsidianVault"
  sync_interval: 300  # seconds
```

---

## Layer 3: Skill System (Tools for the Agent)

### Concept
The app provides "skills" (tools) that the agent can call during conversations. These tools interface with the Knowledge Store and the UI to produce outputs.

### Core Skills (Built-in)

| Skill | Description | Output |
|-------|-------------|--------|
| **search_docs** | Semantic search across knowledge base | Relevant chunks with citations |
| **read_document** | Read full document content by ID | Full text |
| **list_documents** | List/filter documents in collection | Document metadata list |
| **generate_quiz** | Create quiz questions from document(s) | Interactive quiz in UI |
| **generate_flashcards** | Create flashcard deck from content | Flashcard deck (Anki-compatible export?) |
| **generate_report** | Write structured report from multiple sources | Formatted report (MD/PDF) |
| **generate_audio_review** | Generate conversational audio review of document(s) | .mp3/.wav playable in UI |
| **compare_documents** | Side-by-side comparison of documents | Comparison table/matrix |
| **create_timeline** | Extract dates/events into timeline | Visual timeline |
| **extract_citations** | Pull references and citations | Citation list |
| **summarize** | Generate summary of document(s) | Summary (various styles) |

### Skill Definition Format

```python
# skills/quiz.py
SKILL_DEFINITION = {
    "name": "generate_quiz",
    "description": "Generate a quiz from one or more documents in the knowledge base.",
    "parameters": {
        "type": "object",
        "properties": {
            "document_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of document IDs to generate quiz from"
            },
            "num_questions": {
                "type": "integer",
                "default": 5,
                "description": "Number of quiz questions"
            },
            "difficulty": {
                "type": "string",
                "enum": ["easy", "medium", "hard"],
                "default": "medium"
            },
            "style": {
                "type": "string",
                "enum": ["multiple_choice", "true_false", "short_answer", "mixed"],
                "default": "mixed"
            }
        },
        "required": ["document_ids"]
    }
}

async def execute(params: dict, context: SkillContext) -> SkillResult:
    """Quiz generation logic — reads docs, calls LLM, formats output."""
    docs = await context.store.get_documents(params["document_ids"])
    # ... generate quiz via LLM
    return SkillResult(
        content=quiz_text,
        ui_component="QuizWidget",  # Frontend renders interactive quiz
        data={"questions": [...]}    # Structured data for UI
    )
```

### Audio Review Skill (Detail)

```python
# skills/audio_review.py
SKILL_DEFINITION = {
    "name": "generate_audio_review",
    "description": (
        "Generate a conversational audio review of one or more documents. "
        "The agent writes a natural, engaging script (like a podcast discussion) "
        "covering key findings, insights, and takeaways. Then converts it to audio "
        "using local TTS (Piper). Think NotebookLM-style audio overview."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "document_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Document IDs to review"
            },
            "style": {
                "type": "string",
                "enum": ["podcast", "lecture", "briefing", "eli5"],
                "default": "podcast",
                "description": "Audio style: podcast (two-host chat), lecture (monologue), briefing (concise), eli5 (simple)"
            },
            "duration_hint": {
                "type": "string",
                "enum": ["short", "medium", "long"],
                "default": "medium",
                "description": "Approximate target length: short (~2min), medium (~5min), long (~10min)"
            },
            "focus": {
                "type": "string",
                "description": "Optional specific angle or topic to emphasize"
            }
        },
        "required": ["document_ids"]
    }
}

async def execute(params: dict, context: SkillContext) -> SkillResult:
    """
    Two-stage pipeline:
    1. LLM generates a conversational script from document content
    2. Piper TTS converts script → audio file
    """
    docs = await context.store.get_documents(params["document_ids"])
    combined_content = "\n\n---\n\n".join(d.content for d in docs)

    # Stage 1: Agent writes the script
    script = await context.agent.chat(
        messages=[{
            "role": "user",
            "content": build_script_prompt(combined_content, params)
        }],
        tools=[],  # No tools needed for scriptwriting
    )

    # Stage 2: Piper TTS → audio
    audio_path = await piper_tts.synthesize(
        text=script,
        voice=context.config.tts.default_voice,  # e.g. "en_US-lessac-medium"
        output_dir=context.workspace / "audio",
    )

    return SkillResult(
        content=f"🎧 Audio review generated: {audio_path.name}",
        ui_component="AudioPlayer",  # Frontend renders inline audio player
        data={
            "audio_path": str(audio_path),
            "script": script,       # Show transcript too
            "style": params["style"],
            "duration_hint": params["duration_hint"],
        }
    )
```

**TTS Configuration:**
```yaml
# ~/.sage/config.yaml
tts:
  engine: "piper"              # default: piper (local, free)
  fallback: "edge-tts"         # optional: higher quality, needs internet
  default_voice: "en_US-lessac-medium"
  voices:
    - id: "en_US-lessac-medium"
      name: "Lessac (Natural)"
      lang: "en"
    - id: "en_US-ryan-high"
      name: "Ryan (Energetic)"
      lang: "en"
```

**UI Component — AudioPlayer:**
- Inline waveform/progress bar
- Play/pause, speed control (0.5x–2x)
- Show transcript side-by-side (highlight word as it plays)
- Download button for .mp3
- "Generate new" with different style/voice

### Extension Point (User Skills)

Eventually users could add custom skills via a simple plugin directory:
```
~/.sage/skills/
├── my_custom_skill/
│   ├── SKILL.md      # Definition + description
│   └── execute.py    # Implementation
```

---

## Layer 4: Frontend UI

> **📋 Full design spec:** See `DESIGN.md` — generated from Stitch.io "Ethereal Console" mockup.

### The Raycast-Style Floating UI

Instead of a traditional multi-page app, Sage uses a **floating command palette** (like Raycast/Spotlight):
- Compact pill bar (600×48px) activates via global hotkey
- Dynamically expands into "cards" based on skill output
- No window chrome — glassmorphic, dark, floating above everything
- History accessible via Cmd+K or tray icon

### Key Views (Card States)

1. **Compact Input** — Pill bar with search/chat input + provider badge
2. **Chat Response** — Streaming markdown + source citations
3. **Quiz Mode** — Interactive multiple-choice cards with feedback
4. **Flashcards** — Flip animation, progress dots
5. **Audio Player** — Controls + transcript (generate_audio_review skill)
6. **Report View** — Scrollable markdown + export buttons
7. **History Panel** — Searchable past interactions

### UI Tech Stack
- **Tailwind CSS** — Design tokens mapped 1:1 (colors, spacing, radius)
- **shadcn/ui** — Accessible primitives, fully customizable, no runtime
- **Framer Motion** — Spring animations, card expand/collapse, flashcard flip
- **Material Symbols** — Icons (auto_awesome, etc.)
- **react-markdown** — Already in project, for chat/reports
- **Zustand** — Lightweight state management for card stack + history

---

## Migration Path (What to Keep vs Rewrite)

### Keep ✅
- Tauri desktop shell + config
- FastAPI backend structure (endpoints, CORS, etc.)
- `ArxivService` — becomes one ingestion source
- `PDFService` — becomes part of ingestion pipeline
- Frontend layout structure (header, sidebar concepts)
- React Markdown + Tailwind setup

### Modify 🔄
- `DeepSeekService` → becomes one AgentProvider implementation
- `main.py` → restructure endpoints around new architecture
- In-memory caches → SQLite-backed persistence
- Search/Feed components → adapt for Library/Chat views

### New 🔨
- SQLite schema + migration system
- Agent Orchestrator (tool-calling loop)
- Provider abstraction layer
- Skill registry + built-in skills
- Embedding pipeline (for semantic search)
- **Piper TTS integration** (local voice synthesis for audio reviews)
- Obsidian integration
- Chat UI components
- Quiz/Flashcard/Report/AudioPlayer UI components
- Config management (~/.sage/config.yaml)

---

## Suggested Phase Plan

### Phase 1: Foundation (Core Plumbing)
- [ ] SQLite knowledge store with documents + chunks tables
- [ ] Embedding generation (use local model or API — sentence-transformers, OpenAI embeddings)
- [ ] Vector search (sqlite-vss or brute-force for <10K docs)
- [ ] Provider abstraction (AgentProvider ABC + OpenAI + Ollama implementations)
- [ ] Agent orchestrator (tool-calling loop)
- [ ] Basic skill registry with `search_docs` and `read_document`

### Phase 2: Core Skills + Chat UI
- [ ] Chat view with streaming responses
- [ ] `summarize` skill
- [ ] `generate_quiz` skill with QuizWidget UI
- [ ] `generate_flashcards` skill with FlashcardViewer UI
- [ ] `generate_report` skill
- [ ] PDF ingestion pipeline (reuse existing + add embedding step)
- [ ] **Piper TTS setup** (download voice model, wrap as Python module)
- [ ] **`generate_audio_review` skill** with AudioPlayer UI component
- [ ] edge-tts fallback for higher quality audio (internet-dependent)

### Phase 3: Library + Data Sources
- [ ] Library view (browse collections/documents)
- [ ] arXiv auto-ingest (existing search + auto-add to knowledge store)
- [ ] Obsidian vault integration (read + index .md files)
- [ ] File upload (PDF, Markdown)
- [ ] URL/web clipping

### Phase 4: Polish + Advanced
- [ ] Anthropic + DeepSeek + OpenRouter providers
- [ ] More skills (compare, timeline, citations)
- [ ] Export capabilities (PDF report, Anki deck, Markdown)
- [ ] User custom skills (plugin system)
- [ ] Flashcard spaced repetition tracking

---

## Open Questions

1. **Embeddings**: Use local (sentence-transformers on CPU — ~80MB model) or API-based (OpenAI)?
   - Local = free, private, works offline
   - API = better quality, but costs money + requires key
   - Recommendation: Local default, API as option

2. **Naming**: Keep "arXiv Sage" or rebrand to just "Sage"?
   - "arXiv Sage" is specific to arXiv
   - "Sage" is broader, fits the new vision
   - Could be "Sage" with arXiv as a featured integration

3. **Chat vs NotebookLM-style**: Should chat be the PRIMARY interface, or should it be more like NotebookLM where you select docs and get structured outputs (quiz, summary, etc.) without explicit chat?
   - Recommendation: Hybrid — NotebookLM-style "guided" flows for specific outputs, full chat for power users

4. **Scope for v1**: Which skills are must-have for initial release?
   - IMO: `search_docs`, `summarize`, `generate_quiz`, `generate_flashcards`, `generate_report`, `generate_audio_review`
   - These cover the "NotebookLM killer features" — **audio review is the differentiator**
   - TTS engine: Piper (default, local/free) with edge-tts fallback

---

## Competitive Landscape

| App | Local? | BYOA? | Skills? | Notes |
|-----|--------|-------|---------|-------|
| **NotebookLM** | ❌ Cloud | ❌ Gemini only | Limited | Google lock-in, great UX |
| **AnythingLLM** | ✅ | ✅ | Limited | More RAG-focused, less structured outputs |
| **LMStudio** | ✅ | Local only | ❌ | Model runner, not knowledge app |
| **Ollama + Open WebUI** | ✅ | ✅ | Basic | Powerful but not focused on structured learning |
| **Sage (us)** | ✅ | ✅ | ✅ | Unique: local + BYOA + structured skill outputs |

Our differentiator: **The skill system that turns any agent into a structured learning tool** (quizzes, flashcards, reports) on top of your personal knowledge base.
