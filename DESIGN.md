# DESIGN.md — Sage UI/UX Specification

> Based on Stitch.io output "Ethereal Console" — refined and expanded for implementation.

---

## Design Philosophy: "The Ethereal Console"

The UI feels less like a fixed application and more like **a luminous layer of intelligence floating above the operating system**. Key principle: **Tactile Transparency** — clinical rigor of a code editor meets editorial design sophistication.

### The "No-Line" Rule
No 1px solid borders for internal sectioning. Boundaries are defined through **background color shifts** and **depth** (elevation), not lines.

---

## Design Tokens

### Color Palette (Dark Only)

```css
/* Surfaces (depth hierarchy) */
--surface-container-lowest: #0e0e0e;  /* Most recessed areas */
--surface-container-low:    #1c1b1b;  /* Lists, backgrounds */
--surface:                  #131313;  /* Primary floating bar */
--surface-container:        #201f1f;  /* Cards */
--surface-container-high:   #2a2a2a;  /* Elevated cards, inputs */
--surface-container-highest:#353534;  /* Active selections */
--surface-bright:           #3a3939;  /* Hover states */

/* Primary */
--primary:              #adc6ff;  /* Accent — use sparingly ("laser pointer") */
--primary-container:    #4d8eff;  /* Active/energized states */
--on-primary:           #002e6a;
--on-primary-container: #00285d;

/* Text */
--on-surface:         #e5e2e1;  /* Primary text (never pure white!) */
--on-surface-variant: #c2c6d6;  /* Secondary/metadata text */

/* Borders */
--outline:          #8c909f;
--outline-variant:  #424754;  /* Ghost borders at 15% opacity */

/* Semantic */
--error:              #ffb4ab;
--error-container:    #93000a;
--tertiary:           #ffb786;  /* Warm accent for highlights */
--tertiary-container: #df7412;
```

### Typography

| Token | Size | Usage |
|-------|------|-------|
| `headline-sm` | 1.5rem (24px) | Section headers, palette titles |
| `title-md` | 1.125rem (18px) | Floating bar input text |
| `body-md` | 0.875rem (14px) | Standard content, results |
| `label-sm` | 0.6875rem (11px) | Citations, pills, badges |

- **Font:** Inter (system fallback: `-apple-system, sans-serif`)
- **Letter-spacing:** `-0.02em` for headlines (tight/bespoke), `+0.05em` for labels (authoritative)
- **Line height:** `1.5` for body text

### Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4px | Tight gaps (icon to text) |
| `space-sm` | 8px | Standard gaps |
| `space-md` | 16px | Section padding (sides) |
| `space-lg` | 24px | Section padding (top/bottom) |
| `space-xl` | 32px | Major section breaks |

**Asymmetrical padding rule:** More room top/bottom (24px) than sides (16px) for editorial feel.

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 0.5rem (8px) | Cards, inputs |
| `md` | 1rem (16px) | Default, containers |
| `lg` | 2rem (32px) | Major containers |
| `xl` | 3rem (48px) | Special elements |
| `full` | 9999px | Pills, badges, floating bar |

---

## The Card Stack — Window States

The floating window is a **card stack**. The input bar is always the bottom layer; content cards stack on top based on interaction.

### State 1: Compact Input (Default)

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
└──────────────────────────────────────────────────────────┘
```

- **Size:** 600px × 48px
- **Position:** Centered horizontally, **upper third** of screen (~20–25% from top)
- **Shape:** Full rounded (pill)
- **Background:** `surface` at 80% opacity + `backdrop-blur: 32px` — slightly lighter than the deepest background to create floating effect
- **Shadow:** Dual — tight dark shadow + wide blue-tinted ambient glow (60px, 4% primary opacity)
- **Border:** Ghost border `outline-variant` at 15% opacity; on hover brightens to 30%
- **Visual hierarchy:** Background is solid `#0e0e0e` (dark charcoal, near-black) — bar "floats" above it through subtle fill difference + border + shadow

**Components:**
- Left: `auto_awesome` Material icon in `primary` (filled variant)
- Center: Text input, `body-md`, placeholder `on-surface-variant/60`
- Right: Provider badge — pill with emoji + model name, `label-sm` uppercase, `surface-container-high` background

### State 2: Chat Response

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  The transformer architecture [1] was introduced in      │
│  2017 and fundamentally changed how sequence-to-sequence │
│  models process data...                                  │
│                                                          │
│  [1] Vaswani et al. 2017    [2] Devlin et al. 2019      │
│      ▸ Attention Is All...       ▸ BERT                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Size:** 600px × 400–600px (content-dependent)
- **Content:** Streaming markdown rendered with `react-markdown`
- **Citations:** Pill-shaped source labels, `surface-container-high` + 10% outline stroke, hover turns `primary`
- **Animation:** Content fades in with spring physics (200ms)

### State 3: Quiz Mode

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│  Transformers Quiz                 Question 2 of 5       │
│  ──────────────────────────────────────────────          │
│  ●●○○○                                                     │
│                                                          │
│  What mechanism allows transformers to process           │
│  sequences in parallel rather than sequentially?         │
│                                                          │
│  ┌────────────────────────────────────────┐              │
│  │  A. Recurrent connections              │              │
│  └────────────────────────────────────────┘              │
│  ┌────────────────────────────────────────┐              │
│  │  B. Self-attention mechanism  ✓        │ ← primary   │
│  │     inner glow (box-shadow inset)      │   container │
│  └────────────────────────────────────────┘              │
│  ┌────────────────────────────────────────┐              │
│  │  C. Convolutional layers               │              │
│  └────────────────────────────────────────┘              │
│  ┌────────────────────────────────────────┐              │
│  │  D. Pooling operations                 │              │
│  └────────────────────────────────────────┘              │
│                                                          │
│          [ Skip ]                    [ Next → ]          │
└──────────────────────────────────────────────────────────┘
```

- **Cards:** `surface-container-low` + `sm` radius, no checkboxes
- **Selected:** `primary-container` bg + `on-primary-container` text + 2px inset glow (`primary`)
- **Correct:** Green-tinted card
- **Incorrect:** Red-tinted card with correct answer highlighted
- **Progress:** Dot indicators
- **Buttons:** Ghost button style (no fill, 1px outline-variant/20%)

### State 4: Flashcards

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│        ┌────────────────────────────────────┐            │
│        │                                    │            │
│        │  What is the key innovation of     │            │
│        │  the transformer architecture?     │            │
│        │                                    │            │
│        │         ── click to flip ──        │            │
│        │                                    │            │
│        └────────────────────────────────────┘            │
│                                                          │
│              ●  ●  ○  ○  ○                                │
│                                                          │
│           [ ↺ Shuffle ]           [ Reset ]              │
└──────────────────────────────────────────────────────────┘
```

- **Card:** Large centered, `surface-container-high` + `lg` radius, 3D flip CSS transform
- **Progress:** Dot indicators
- **Controls:** Ghost buttons

### State 5: Audio Player

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│  🎧  Audio Review: Transformer Architecture              │
│                                                          │
│        ▮▮──────────────────────────────── 2:34 / 5:12    │
│                                                          │
│           [ ⏮ ]     [ ▶ ]     [ ⏭ ]                     │
│                                                          │
│  ── Transcript ──────────────────────────────            │
│  "So the key insight behind transformers is              │
│   that you don't need recurrence at all..."              │
│                                                          │
│         [ 🎙️ Podcast — Lessac ]    [ 📥 Download ]      │
└──────────────────────────────────────────────────────────┘
```

- **Progress bar:** `surface-container-highest` track (4px, full radius) + gradient indicator (`primary` → `primary-container`)
- **Controls:** Previous, Play/Pause, Next
- **Transcript:** Expandable, scrollable, word-highlight during playback
- **Voice badge:** Current style + voice name

### State 6: Report View

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Ask about your knowledge base...         ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│  Report: Attention Mechanisms              [Copy][MD][PDF]│
│  ──────────────────────────────────────────              │
│  │ │                                                 │   │
│  │ │  ## Executive Summary                           │   │
│  │ │                                                 │   │
│  │ │  The attention mechanism is a core component... │   │
│  │ │                                                 │   │
│  │ │  ## Key Findings                                │   │
│  │ │                                                 │   │
│  │ │  1. Self-attention enables...                   │   │
│  │ │                                                 │   │
└──────────────────────────────────────────────────────────┘
```

- **Mini sidebar:** Anchor links to sections
- **Content:** Scrollable, rendered markdown with good typography
- **Export:** Copy, Markdown, PDF buttons (top-right)

### State 7: History Panel

```
┌──────────────────────────────────────────────────────────┐
│  ✨  Search history...                        ⚡ GPT-4o  │
├──────────────────────────────────────────────────────────┤
│  Today                                                   │
│  💬 Transformer attention mechanisms         2:34 PM     │
│  ❓ Quiz: Neural networks basics             1:15 PM     │
│  🎧 Audio review: BERT paper                 12:02 PM    │
│                                                          │
│  Yesterday                                               │
│  📝 Report: RLHF overview                    4:20 PM     │
│  🃏 Flashcards: GPT architecture             3:11 PM     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Trigger:** `Cmd+K` or tray icon → "History"
- **Search:** Input becomes a filter
- **Items:** Icon (💬🎧📝🃏❓) + title + timestamp + source docs
- **Click:** Re-opens that interaction's view

---

## Animation & Motion

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Window expand | Height spring | 200ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Content fade-in | Opacity 0→1 | 150ms | ease-out |
| Quiz card select | Background + glow | 150ms | ease-out |
| Flashcard flip | 3D rotateY 180° | 400ms | ease-in-out |
| Hover states | Color/opacity | 150ms | ease |

---

## System Tray Menu

```
  🔮 Sage
  ─────────────────────
  📚  Open Library
  💬  New Chat
  ❓  New Quiz
  🎧  Generate Audio
  ─────────────────────
  ⚙️  Settings
  🚪  Quit
```

---

## Interaction Rules

1. **Window position** persists across sessions (user can drag to reposition)
2. **Going back** collapses the top card (Esc key or back gesture)
3. **Pin mode** (optional): Click pin icon to keep window visible
4. **Global hotkey** activates the palette (configurable, default: `Cmd+Shift+S`)
5. **X button** appears on hover (top-right, like Raycast)
6. **No window chrome** — no title bar, no system decorations

---

## "Do's and Don'ts"

### ✅ Do
- Use asymmetrical padding (more top/bottom than sides)
- Increase `surface-container` contrast instead of adding dividers
- Use `primary` sparingly — it's a "laser pointer," not a paint bucket
- Tint shadows with `primary` or `surface` color (never pure black)

### ❌ Don't
- Use 100% opaque borders (breaks ethereal illusion)
- Use pure black `#000` for backgrounds (kills glass depth)
- Use standard drop shadows with `#000` (always tint)
- Add 1px solid borders for sectioning (use color shifts instead)

---

## Component Library Decision

Based on this design system, recommended stack:

| Layer | Choice | Why |
|-------|--------|-----|
| **CSS Framework** | Tailwind CSS (already in project) | Token system maps 1:1 to Tailwind config |
| **Component Base** | **shadcn/ui** | Copy-paste, fully customizable, Tailwind-native, no runtime |
| **Icons** | Material Symbols (already in Stitch output) | Consistent with design |
| **Animations** | Framer Motion | Spring physics, layout animations, AnimatePresence |
| **Markdown** | react-markdown + remark-gfm (already have) | For chat/reports |

shadcn/ui is ideal here because we need **full control** over every pixel (the "Ethereal" look requires custom styling that component libraries like Radix/Chakra would fight against). shadcn gives us the accessibility primitives without the styling baggage.
