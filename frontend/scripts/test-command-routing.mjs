import assert from "node:assert/strict";
import { detectView } from "../src/lib/command-routing.ts";

const routes = [
  ["/quiz", "quiz"],
  ["/quiz attention mechanisms", "quiz"],
  ["/flashcards transformers", "flashcards"],
  ["/flashcard transformers", "flashcards"],
  ["/audio chapter 2", "audio"],
  ["/report diffusion notes", "report"],
  ["/history", "history"],
  ["/tomes", "tomes"],
  ["/knowledge", "knowledge"],
  ["/sources", "knowledge"],
];

for (const [input, expected] of routes) {
  assert.equal(detectView(input), expected, `${input} should route to ${expected}`);
}

const naturalLanguagePrompts = [
  "history of transformers",
  "which library does this use",
  "summary of my notes",
  "can you quiz me conversationally first?",
  "tell me about audio transformers",
  "what collection did this paper come from?",
  "show me documents about attention",
];

for (const input of naturalLanguagePrompts) {
  assert.equal(detectView(input), null, `${input} should stay in chat`);
}

console.log("command routing tests passed");
