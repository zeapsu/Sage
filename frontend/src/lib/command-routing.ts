export type RoutedView = "quiz" | "flashcards" | "audio" | "report" | "history" | "tomes" | "knowledge" | "settings";

const slashCommands: Record<string, RoutedView> = {
  "/quiz": "quiz",
  "/test": "quiz",
  "/flashcard": "flashcards",
  "/flashcards": "flashcards",
  "/audio": "audio",
  "/listen": "audio",
  "/podcast": "audio",
  "/report": "report",
  "/study-guide": "report",
  "/history": "history",
  "/tomes": "tomes",
  "/tome": "tomes",
  "/knowledge": "knowledge",
  "/sources": "knowledge",
  "/docs": "knowledge",
  "/settings": "settings",
  "/profile": "settings",
};

const chipPrompts: Record<string, RoutedView> = {
  "generate a report for this tome": "report",
  "create a quiz for this tome": "quiz",
  "create flashcards for this tome": "flashcards",
  "generate an audio review for this tome": "audio",
};

/**
 * Map an explicit command/action to a Sage view.
 *
 * Natural-language questions must stay in chat. Routing is intentionally
 * limited to slash commands and first-party capability chip prompts so phrases
 * like "history of transformers" or "which library does this use" are not
 * hijacked away from the assistant.
 */
export function detectView(text: string): RoutedView | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;

  const [command] = lower.split(/\s+/, 1);
  if (command && slashCommands[command]) {
    return slashCommands[command];
  }

  return chipPrompts[lower] ?? null;
}
