# Stitch.io Prompt — Sage Floating UI

Use this as the initial prompt for stitch.io. Paste directly into the tool.
Adjust based on what Stitch outputs — this is a starting point, iterate from here.

---

## Prompt (copy this ↓)

Design a floating command palette UI for a macOS/Linux desktop knowledge assistant app called "Sage". The app lives in the system tray and is activated by a global keyboard shortcut (like Raycast or Spotlight). It's a Tauri desktop app.

### Core Interaction Model

The UI starts as a compact floating search/chat bar centered on screen with a dark, blurred-glass aesthetic. As the user interacts, the window **dynamically expands vertically** to reveal different content views based on the type of interaction. The window always has rounded corners and a subtle shadow, floating above all other windows.

### States to Design

**State 1: Compact Input (Initial)**
- Small floating pill/bar, ~600px wide, ~48px tall
- Left side: small Sage sparkle icon
- Center: text input with placeholder "Ask about your knowledge base..."
- Right side: provider badge (tiny, e.g. "⚡ GPT-4o" or "🦙 Llama 3")
- Dark background (#0a0a0a) with backdrop blur, subtle 1px border (#222)
- Appears centered horizontally, ~20% from top of screen

**State 2: Chat Response (Expanded)**
- Window expands to ~600px wide, ~400-600px tall
- Input bar stays at top, becomes a persistent header
- Below: streaming chat response in markdown
- Left gutter shows source citations as small pills [1] [2] [3]
- Minimal, no chrome — just content floating in glass
- Fades in smoothly with spring animation

**State 3: Quiz Mode (Expanded)**
- Window expands to ~600px wide, ~500px tall
- Header shows "Quiz: [Topic]" with progress (Question 2/5)
- Question text in clean typography
- Multiple choice options as clickable cards (not radio buttons)
- Selected answer highlights with green/red feedback
- Bottom bar: "Skip" and "Next Question" buttons
- Completion state: score summary with "Review Mistakes" button

**State 4: Flashcards (Expanded)**
- Window expands to ~600px wide, ~450px tall
- Large centered card with flip animation (3D CSS transform)
- Front shows question/concept, click to reveal back
- Bottom: progress dots (●●○○○) and navigation arrows
- "Shuffle" and "Reset" as small ghost buttons

**State 5: Audio Player (Expanded)**
- Window expands to ~600px wide, ~300px tall
- Top: document title / "Audio Review"
- Center: playback controls (prev, play/pause, next) in a row
- Below: progress bar with timestamp
- Below that: expandable transcript panel (scrollable)
- Voice/style badge (e.g. "🎙️ Podcast — Lessac")

**State 6: Report View (Expanded)**
- Window expands to ~600px wide, ~600px tall
- Scrollable markdown content with good typography
- Top-right: export buttons (Copy, Markdown, PDF)
- Sections with anchor links in a mini sidebar

**State 7: History Panel**
- Accessed via Cmd+K or clicking tray icon → "History"
- Window expands to ~600px wide, ~500px tall
- Search/filter bar at top
- Chronological list of past interactions
- Each item: icon (💬🎧📝🃏❓) + title + timestamp + source docs
- Click to re-open that interaction's view

### Design Language

- **Dark mode only** (this is a developer/researcher tool)
- Color palette: blacks (#0a0a0a, #111), grays (#666, #999), accent blue (#3b82f6), success green (#22c55e), error red (#ef4444)
- Typography: Inter or system font stack, clean and readable
- Glassmorphism: subtle backdrop blur on the floating window
- Animations: smooth expand/collapse (200ms spring), content fades in
- NO traditional window chrome (no title bar, no close button visible)
- Small X button top-right appears on hover (like Raycast)
- Drag handle at top of expanded state for repositioning

### Layout Principle

The window is always anchored to the same position (user can drag to reposition, position persists). Think of it as a **card stack** — the input bar is always visible, and content cards stack below it based on the current interaction. Going "back" collapses the top card.

### System Tray Integration

Show a small mockup of the tray menu:
- 🔮 Sage
- ─────────
- 📚 Open Library
- 💬 New Chat
- ❓ New Quiz
- 🎧 Generate Audio
- ─────────
- ⚙️ Settings
- 🚪 Quit

---

## Notes for Iteration

After Stitch generates initial mockups:
1. Check if the expand/collapse transitions feel right
2. Verify the compact state is minimal enough
3. See if the quiz/flashcard states look interactive
4. Decide if we want the window to be full-width or floating-pod style
5. Consider adding a "pin" button to keep the window visible
