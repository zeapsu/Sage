# Sage Agent Skill Specification

> The contract between backend skills and frontend UI/components.
> Product truth: Tome Home is the default UI, ordinary questions stay in chat, and only explicit slash commands / first-party capability chips route to generated views.

---

## 1. Architecture Overview

Sage's current implementation is a hybrid of direct routed UI views and backend skills. The next likely roadmap is deeper BYOA / bring-your-own-agent integration, where an external or local agent can call Sage-provided skills while Sage keeps control of source access, grounding, and UI rendering.

```text
Tome Home / Chat input
        ↓
Explicit command routing (`frontend/src/lib/command-routing.ts`)
        ↓                         ↘
Focused UI view               Chat / agent loop
        ↓                         ↓
Frontend API client       Backend skill registry
        ↓                         ↓
Generated artifact        SkillResult / structured data
        ↓                         ↓
Ethereal/Tome Home UI renders grounded output
```

Historical/target agent loop:

```text
User Query → Agent Orchestrator → LLM selects tool → Skill executes → SkillResult
                                                                    ↓
                                                         ┌─────────────────────┐
                                                         │  ui_component: str   │
                                                         │  data: dict          │
                                                         │  content: str (MD)   │
                                                         └──────────┬──────────┘
                                                                    ↓
                                                         Frontend renders the
                                                         matching React card/view
```

### SkillResult Contract

```python
@dataclass
class SkillResult:
    content: str              # Markdown text shown in chat/log
    ui_component: str | None  # Component name to render (e.g. "QuizWidget")
    data: dict | None         # Structured data passed as props to the component
    metadata: dict | None     # Skill execution metadata (tokens, timing, etc.)
```

### Frontend Dispatch

The frontend maintains a component registry mapping `ui_component` names to React components:

```typescript
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  "ChatWidget": ChatWidget,
  "QuizWidget": QuizWidget,
  "FlashcardWidget": FlashcardWidget,
  "AudioPlayerWidget": AudioPlayerWidget,
  "ReportViewWidget": ReportViewWidget,
  "HistoryPanel": HistoryPanel,
  "TomeSelector": TomeSelector,
  "CommandBar": CommandBar,
};
```

When a `SkillResult` arrives:
1. If `ui_component` is set → render the matching card with `data` as props
2. If `ui_component` is null → append `content` as a markdown chat message

---

## 2. Component Inventory

### 2.1 Current Tome Home / Ethereal Components

These components are the current user-facing direction. Tome Home (`frontend/src/app/page.tsx`) routes to focused views directly; backend skills should target these surfaces rather than the old arXiv feed.

| Component | File | Current role |
|-----------|------|--------------|
| **Tome Home shell** | `frontend/src/app/page.tsx` | Default UI, capability chips, explicit routing, top-level navigation. |
| **KnowledgeBaseWidget** | `KnowledgeBaseWidget.tsx` | Sources/documents surface and upload entry point. |
| **TomeSelector** | `TomeSelector.tsx` | Tome selection/management surface. |
| **ChatWidget** | `ChatWidget.tsx` | Natural-language chat surface; can hand explicit slash commands back to router. |
| **QuizView / QuizWidget** | `QuizView.tsx`, `QuizWidget.tsx` | Generated quiz artifact view and interactive card component. |
| **FlashcardsView / FlashcardWidget** | `FlashcardsView.tsx`, `FlashcardWidget.tsx` | Generated flashcard artifact view and card component. |
| **AudioView / AudioPlayerWidget** | `AudioView.tsx`, `AudioPlayerWidget.tsx` | Generated audio review/narration view and player component. |
| **ReportView / ReportViewWidget** | `ReportView.tsx`, `ReportViewWidget.tsx` | Generated report artifact view and markdown/report component. |
| **HistoryPanel** | `HistoryPanel.tsx` | History surface. |
| **UploadModal** | `UploadModal.tsx` | Source upload modal. |
| **CommandBar** | `CommandBar.tsx` | Earlier compact command bar component; still aligned with Ethereal Console direction. |

### 2.2 Legacy Components (pre-Ethereal / arXiv-feed design ⚠️)

These components exist in the tree but are not the current product center. Do not treat them as the target architecture.

| Component | File | Status | Description |
|-----------|------|--------|-------------|
| **TomeList** | `TomeList.tsx` | ⚠️ Legacy | Older tome manager with real API integration (`sage-api.ts`). Superseded visually by TomeSelector. |
| **KeywordSearch** | `KeywordSearch.tsx` | ⚠️ Legacy | Keyword search → backend summarize endpoint. Uses old styling. |
| **SearchBar** | `SearchBar.tsx` | ⚠️ Legacy | Generic old search input. |
| **TableOfContents** | `TableOfContents.tsx` | ⚠️ Legacy | Simple old paper TOC. |
| **Feed** | `Feed.tsx` | ⚠️ Legacy | Old paper feed. |
| **Post** | `Post.tsx` | ⚠️ Legacy | Old paper/social post card. |
| **LoadingSpinner** | `LoadingSpinner.tsx` | ⚠️ Legacy | Old spinner styling. |

---

## 3. Skill-to-Component Mapping

Each skill below defines its `ui_component` and the `data` schema it passes. The names are a target contract for BYOA/agent integration; the current frontend may wrap these widgets in routed `*View` components.

### 3.1 `search_docs`

```yaml
name: search_docs
description: Semantic search across the knowledge base
ui_component: ChatWidget
parameters:
  query:
    type: string
    required: true
    description: Search query
  collection_id:
    type: string
    description: Scope search to a specific collection/tome
  max_results:
    type: integer
    default: 5
    description: Maximum number of chunks to return
```

**Data → ChatWidget props:**
```typescript
{
  messages: [
    {
      id: string,
      role: "assistant",
      content: string,        // Markdown response with citations
      timestamp: string,
    }
  ]
}
```

**Behavior:** Returns relevant chunks as a chat-style response with inline pill citations linking to source documents.

---

### 3.2 `read_document`

```yaml
name: read_document
description: Read full document content by ID
ui_component: ChatWidget
parameters:
  document_id:
    type: string
    required: true
  section:
    type: string
    description: Optional specific section to read
```

**Data → ChatWidget props:** Same as `search_docs` — returns full content as assistant message.

---

### 3.3 `generate_quiz`

```yaml
name: generate_quiz
description: Generate interactive quiz from document(s)
ui_component: QuizWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  num_questions:
    type: integer
    default: 5
  difficulty:
    type: string
    enum: [easy, medium, hard]
    default: medium
  style:
    type: string
    enum: [multiple_choice, true_false, mixed]
    default: multiple_choice
```

**Data → QuizWidget props:**
```typescript
{
  title: string,                    // e.g. "Transformers Quiz"
  questions: [
    {
      id: string,
      question: string,
      options: [
        { id: string, text: string }  // id like "a", "b", "c", "d"
      ],
      correctOptionId: string,
      explanation?: string,           // Shown after answer
    }
  ],
  onComplete?: (score: number, total: number) => void,
}
```

**Behavior:** LLM generates questions from document content. Frontend handles all interactivity (select → confirm → feedback → next). Score reported back to backend via `onComplete` for session tracking.

---

### 3.4 `generate_flashcards`

```yaml
name: generate_flashcards
description: Generate flashcard deck from document(s)
ui_component: FlashcardWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  num_cards:
    type: integer
    default: 10
  focus:
    type: string
    description: Specific topic/concept to focus cards on
```

**Data → FlashcardWidget props:**
```typescript
{
  title: string,                    // e.g. "Transformer Architecture Cards"
  cards: [
    {
      id: string,
      front: string,                // Question/prompt
      back: string,                 // Answer/explanation
    }
  ],
}
```

**Behavior:** Frontend handles flip animation, shuffle, keyboard nav. Backend just generates the card content.

---

### 3.5 `generate_audio_review`

```yaml
name: generate_audio_review
description: >
  Generate a conversational audio review (podcast-style) from document(s).
  Two-stage pipeline: LLM writes script → Piper TTS converts to audio.
ui_component: AudioPlayerWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  style:
    type: string
    enum: [podcast, lecture, briefing, eli5]
    default: podcast
  duration_hint:
    type: string
    enum: [short, medium, long]
    default: medium
    description: "short=~2min, medium=~5min, long=~10min"
  focus:
    type: string
    description: Optional specific angle to emphasize
```

**Data → AudioPlayerWidget props:**
```typescript
{
  track: {
    id: string,
    title: string,                    // e.g. "Audio Review: Transformer Architecture"
    voice: string,                    // e.g. "Lessac"
    duration: number,                 // Total seconds
    audio_url: string,                // URL/path to generated .mp3
    transcript: [
      {
        id: string,
        text: string,
        startTime: number,            // seconds
        endTime: number,
      }
    ],
  },
}
```

**Behavior:** This is the key differentiator skill. Backend: (1) LLM writes conversational script from document content, (2) Piper TTS generates audio, (3) script is chunked into timed segments for transcript highlighting. Frontend: simulated playback with progress bar, 15s skip, expandable transcript with active-segment highlighting, download button.

**TTS Configuration:**
```yaml
tts:
  engine: "piper"
  fallback: "edge-tts"
  default_voice: "en_US-lessac-medium"
```

---

### 3.6 `generate_report`

```yaml
name: generate_report
description: Generate a structured report from multiple documents
ui_component: ReportViewWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  title:
    type: string
    description: Custom report title
  style:
    type: string
    enum: [academic, executive, technical, eli5]
    default: technical
  sections:
    type: array
    items: string
    description: Specific sections to include (auto-generated if omitted)
```

**Data → ReportViewWidget props:**
```typescript
{
  report: {
    title: string,
    subtitle?: string,
    sourceDocs?: string,              // e.g. "Based on 12 documents in 'DL Foundations'"
    content: string,                  // Full markdown (supports KaTeX math)
    toc: [
      { id: string, title: string }   // Auto-generated from h2/h3 headings
    ],
  },
}
```

**Behavior:** LLM generates structured report in markdown. `rehype-slug` auto-generates heading IDs for sidebar TOC navigation. Export buttons (Copy, Markdown, PDF) are handled client-side. Supports LaTeX math via KaTeX.

---

### 3.7 `summarize`

```yaml
name: summarize
description: Generate summary of document(s)
ui_component: ChatWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  style:
    type: string
    enum: [brief, detailed, bullet_points, key_takeaways]
    default: brief
  max_length:
    type: integer
    default: 500
    description: Target word count
```

**Data → ChatWidget props:** Same format — returns summary as assistant chat message.

---

### 3.8 `compare_documents`

```yaml
name: compare_documents
description: Side-by-side comparison of documents
ui_component: ChatWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
    minItems: 2
  aspects:
    type: array
    items: string
    description: Specific aspects to compare (auto-detected if omitted)
```

**Data → ChatWidget props:** Returns comparison as formatted markdown table in chat. (Future: dedicated ComparisonWidget with split-panel layout.)

---

### 3.9 `list_documents`

```yaml
name: list_documents
description: List/filter documents in a collection
ui_component: TomeSelector
parameters:
  collection_id:
    type: string
  search:
    type: string
    description: Filter by title/content
  doc_type:
    type: string
    enum: [pdf, markdown, web, note, all]
    default: all
```

**Data → TomeSelector props:** Populates the tome/document list with search results.

---

### 3.10 `create_timeline`

```yaml
name: create_timeline
description: Extract dates/events into a timeline
ui_component: ChatWidget
parameters:
  document_ids:
    type: array
    items: string
    required: true
  granularity:
    type: string
    enum: [year, month, day]
    default: month
```

**Data → ChatWidget props:** Returns timeline as formatted markdown. (Future: dedicated TimelineWidget.)

---

## 4. Interaction Flow

### 4.1 User Submits Query (CommandBar)

```
1. User types in CommandBar → onSubmit(query)
2. Frontend sends POST /api/agent/chat { query, collection_id, provider }
3. Agent Orchestrator receives query
4. LLM decides: direct answer OR tool call
   ├─ Direct answer → ChatWidget (streaming markdown)
   └─ Tool call → Skill executes → SkillResult
5. Frontend receives response:
   ├─ { ui_component: "QuizWidget", data: {...} } → render QuizWidget
   ├─ { ui_component: "AudioPlayerWidget", data: {...} } → render AudioPlayerWidget
   └─ { content: "..." } → append to ChatWidget messages
6. HistoryPanel gets new entry appended
```

### 4.2 History Navigation (HistoryPanel)

```
1. User opens HistoryPanel (Cmd+K)
2. Clicks history item → onSelect(item)
3. Frontend fetches session data from GET /api/sessions/{id}
4. Re-renders the original ui_component with stored data
```

### 4.3 Tome Management (TomeSelector + TomeList)

```
TomeSelector: UI-only picker (sample data, for the CommandBar card flow)
TomeList: Real API integration (CRUD with sage-api.ts)

Future: Merge TomeList's API logic into TomeSelector's UI, deprecate TomeList.
```

---

## 5. Component Props Reference (TypeScript)

### CommandBar
```typescript
interface CommandBarProps {
  onSubmit: (response: string) => void;
}
```

### ChatWidget
```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
interface ChatWidgetProps {
  tomeName?: string;
  providerName?: string;
  messages?: ChatMessage[];
  onSend?: (message: string) => void;
  isLoading?: boolean;
}
```

### QuizWidget
```typescript
interface QuizOption { id: string; text: string; }
interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correctOptionId: string;
  explanation?: string;
}
interface QuizWidgetProps {
  title?: string;
  questions: QuizQuestion[];
  onComplete?: (score: number, total: number) => void;
}
```

### FlashcardWidget
```typescript
interface Flashcard { id: string; front: string; back: string; }
interface FlashcardWidgetProps {
  title?: string;
  cards: Flashcard[];
}
```

### AudioPlayerWidget
```typescript
interface TranscriptSegment { id: string; text: string; startTime: number; endTime: number; }
interface AudioTrack {
  id: string;
  title: string;
  voice: string;
  duration: number;
  audio_url?: string;        // ← ADD: actual audio file URL (not yet in component)
  transcript: TranscriptSegment[];
}
interface AudioPlayerWidgetProps {
  track: AudioTrack;
}
```

### ReportViewWidget
```typescript
interface Report {
  title: string;
  subtitle?: string;
  sourceDocs?: string;
  content: string;           // Markdown with KaTeX math support
  toc: { id: string; title: string }[];
}
interface ReportViewWidgetProps {
  report: Report;
}
```

### HistoryPanel
```typescript
interface HistoryItem {
  id: string;
  type: "chat" | "quiz" | "flashcard" | "audio" | "report";
  title: string;
  timestamp: string;
  tomeName?: string;
}
interface HistoryPanelProps {
  items?: HistoryItem[];
  onSelect?: (item: HistoryItem) => void;
}
```

### TomeSelector
```typescript
interface Tome {
  id: string;
  name: string;
  description: string;
  docCount: number;
  lastAccessed: string;
  color: string;
}
interface TomeSelectorProps {
  tomes?: Tome[];
  activeTomeId?: string | null;
  onSelect?: (tome: Tome) => void;
}
```

---

## 6. Pending Work

### Component Gaps
- [ ] **AudioPlayerWidget**: Add `audio_url` prop, wire up real `<audio>` element (currently simulated with setInterval)
- [ ] **ChatWidget**: Support streaming markdown (currently static). Needs SSE or WebSocket.
- [ ] **QuizWidget**: Add `explanation` rendering for true/false and short_answer styles
- [ ] **ComparisonWidget**: Dedicated split-panel component for `compare_documents` (currently renders as chat markdown)
- [ ] **TimelineWidget**: Dedicated timeline visualization for `create_timeline`

### Legacy Migration
- [ ] **TomeList → TomeSelector**: Merge TomeList's API integration (`sage-api.ts` CRUD) into TomeSelector's Ethereal UI. Deprecate TomeList.
- [ ] **KeywordSearch**: Rewrite with Ethereal styling or fold into CommandBar's search flow
- [ ] **SearchBar**: Deprecate — CommandBar replaces this
- [ ] **TableOfContents**: Keep as internal sub-component of ReportViewWidget only
- [ ] **Feed + Post**: Rewrite with Ethereal styling for the arXiv browse feature, or deprecate if arXiv browsing moves to chat-based discovery
- [ ] **LoadingSpinner**: Rewrite with Ethereal styling (use design tokens instead of hardcoded colors)

### Backend Integration
- [ ] Wire up `/api/agent/chat` endpoint to Agent Orchestrator
- [ ] Implement Skill Registry (Python `skills/` package with `SKILL_DEFINITION` + `execute()`)
- [ ] Piper TTS setup (download voice models, configure pipeline)
- [ ] Session persistence (SQLite `sessions` + `messages` tables)
- [ ] Streaming response support (SSE for chat, pre-signed URLs for audio)

---

## 7. Design Token Quick Reference

All Ethereal Console components use these Tailwind tokens (defined in `globals.css` `@theme`):

| Token | Value | Usage |
|-------|-------|-------|
| `bg-surface/80` | `#131313` at 80% opacity | Card backgrounds |
| `bg-surface-container-low` | `#1c1b1b` | Input fields, message bubbles |
| `bg-surface-container-high` | `#2a2a2a` | Elevated elements, provider badges |
| `text-primary` | `#adc6ff` | Accent, icons, selected states |
| `text-on-surface` | `#e5e2e1` | Primary text (never pure white!) |
| `text-on-surface-variant` | `#c2c6d6` | Secondary/metadata text |
| `border-outline-variant/15` | `#424754` at 15% | Ghost borders |
| `backdrop-blur-[32px]` | 32px blur | Glassmorphism effect |
| `rounded-2xl` | 16px radius | Card corners |
| `rounded-full` | 9999px radius | Pills, badges |

**Shadow (all cards):**
```
shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
```

**Icons:** Material Symbols Outlined (`material-symbols-outlined` class)
**Font:** Inter (via `@font-face` or `next/font`)
**Animation:** Framer Motion (flashcard flip, layout transitions)
