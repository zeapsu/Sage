# Sage Product Surfaces

This note is shared context for humans and agents working on Sage UI/product direction.

## Current decision

Sage is **macOS desktop-first** for the near term. The app is implemented with Tauri + Next.js + FastAPI, but product decisions should optimize for the macOS desktop experience before hosted web or other desktop targets.

## Surface hierarchy

Sage has three complementary UI layers:

1. **Tome Home**
   - Default in-app landing surface after opening Sage or selecting a Tome.
   - Calm, centered, composer-first, and Tome-aware.
   - Shows selected Tome context, a large composer, and capability chips.
   - Routes users to focused work without opening on a dense dashboard.

2. **Global Command Bar**
   - Future Spotlight/Raycast-style macOS overlay.
   - Invoked by global hotkey or tray/menu affordance.
   - Used for quick capture, search, opening Tomes, and launching skills from anywhere on the OS.
   - It should be transient and lightweight. Deeper work should route into Tome Home or focused views.

3. **Focused Views**
   - Deep-work surfaces for Chat, Report, Quiz, Flashcards, Audio, History, Sources/Tomes, and future skills.
   - These are the main targets for backend skill results.

## Tome Dashboard role

The expanded Tome Dashboard is still useful, but it is **secondary**. Use it for artifact status, source freshness, generated output management, and overview tasks. It should not be the first impression.

## Web scope

A browser-rendered Next.js frontend is useful for development, but a hosted or user-facing web product is out of scope for now. A real web version would require separate decisions around auth, sync, privacy, file access, local runtime/model integration, and deployment.

## Agent guidance

When changing Sage UI:

- Preserve Tome Home as the default app surface.
- Do not collapse the command-bar idea into Tome Home. Treat the command bar as a separate macOS overlay layer.
- Keep the dashboard reachable but secondary.
- Prefer small, focused PRs. `frontend/src/app/page.tsx` is an overlap-prone file, so coordinate on PRs that touch it.
- Use `npm run build` from `frontend/` after frontend changes.
