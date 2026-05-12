"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CommandBar from "@/components/CommandBar";
import FlashcardsView from "@/components/FlashcardsView";
import QuizView from "@/components/QuizView";
import AudioView from "@/components/AudioView";
import ReportView from "@/components/ReportView";
import HistoryPanel from "@/components/HistoryPanel";
import TomeSelector from "@/components/TomeSelector";
import ChatWidget from "@/components/ChatWidget";
import KnowledgeBaseWidget from "@/components/KnowledgeBaseWidget";

type ViewState = "idle" | "quiz" | "flashcards" | "audio" | "report" | "history" | "tomes" | "chat" | "knowledge";

/** Map a free-text prompt to a non-chat view, or null if it should go to chat. */
function detectView(text: string): Exclude<ViewState, "chat" | "idle"> | null {
  const lower = text.toLowerCase().trim();
  if (lower.includes("quiz") || /\btest(s|ing)?\b/.test(lower)) return "quiz";
  if (lower.includes("flashcard") || lower.includes("flash card")) return "flashcards";
  if (lower.includes("audio") || lower.includes("listen") || lower.includes("podcast")) return "audio";
  if (lower.includes("report") || lower.includes("study guide") || lower.includes("summary")) return "report";
  if (lower.includes("history")) return "history";
  if (lower.includes("tome") || lower.includes("collection") || lower.includes("library")) return "tomes";
  if (
    lower === "knowledge" ||
    lower === "kb" ||
    lower === "docs" ||
    lower === "documents" ||
    lower.includes("knowledge base") ||
    lower.includes("view documents") ||
    lower.includes("show documents") ||
    lower.includes("list documents")
  ) {
    return "knowledge";
  }
  return null;
}

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [chatQuery, setChatQuery] = useState<string>("");

  const [generationPrompt, setGenerationPrompt] = useState<string>("");

  const handleSubmit = (text: string) => {
    const route = detectView(text);
    if (route) {
      if (route === "quiz" || route === "flashcards" || route === "audio" || route === "report") {
        setGenerationPrompt(text);
      }
      setViewState(route);
    } else {
      setChatQuery(text);
      setViewState("chat");
    }
  };

  /** Called from inside ChatWidget. Returns true if it routed away from chat. */
  const handleChatCommand = (text: string): boolean => {
    const route = detectView(text);
    if (!route) return false;
    if (route === "quiz" || route === "flashcards" || route === "audio" || route === "report") {
      setGenerationPrompt(text);
    }
    setViewState(route);
    return true;
  };

  const handleBack = () => {
    setViewState("idle");
  };

  const cardVariants = {
    initial: { opacity: 0, y: 16, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.97 },
  };

  const cardTransition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] };

  const layoutTransition = { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const };

  return (
    <main className="relative w-full min-h-screen flex flex-col items-center">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* Top spacer: shares space with bottom when idle so the command bar sits on the vertical midline */}
      <div
        className={`w-full shrink-0 transition-all duration-500 ease-out ${viewState === "idle" ? "flex-1 min-h-0 basis-0" : "h-24 flex-none"
          }`}
        aria-hidden
      />

      <motion.div
        layout
        transition={{ layout: layoutTransition }}
        className={`relative z-10 w-full flex justify-center transition-[padding] duration-500 ease-out ${viewState === "idle" ? "pb-0" : "pb-8"
          }`}
      >
        <div className="flex w-full max-w-[660px] flex-col items-center gap-8 px-6">
          <header className="flex w-full flex-col items-center px-2 text-center">
            <p className="m-0 text-center font-headline text-2xl font-semibold leading-tight tracking-[0.28em] text-on-surface sm:text-3xl sm:tracking-[0.26em]">
              SAGE
            </p>
          </header>
          <CommandBar
            onSubmit={handleSubmit}
            isKnowledgeBaseOpen={viewState === "knowledge"}
            onKnowledgeBaseToggle={() =>
              setViewState((s) => (s === "knowledge" ? "idle" : "knowledge"))
            }
          />
          {viewState === "idle" && (
            <p className="m-0 max-w-md px-2 text-center text-xs leading-relaxed text-on-surface-variant">
              This project is based on{" "}
              <a
                href="https://arxiv.org/abs/2603.15255"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline-offset-2 hover:underline"
              >
                SAGE: Multi-Agent Self-Evolution for LLM Reasoning
              </a>{" "}
              (Peng et al., arXiv:2603.15255).
            </p>
          )}
        </div>
      </motion.div>

      {/* Content area — second flex-1 when idle balances the top spacer for vertical centering */}
      <div
        className="flex flex-col items-center gap-5 w-full pb-12 shrink-0 flex-1 min-h-0 basis-0"
      >
        <AnimatePresence mode="wait">
          {viewState === "quiz" && (
            <motion.div key="quiz" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <QuizView prompt={generationPrompt} />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "flashcards" && (
            <motion.div key="flashcards" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <FlashcardsView prompt={generationPrompt} />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "audio" && (
            <motion.div key="audio" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <AudioView prompt={generationPrompt} />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "report" && (
            <motion.div key="report" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <ReportView prompt={generationPrompt} />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "history" && (
            <motion.div key="history" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <HistoryPanel />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "tomes" && (
            <motion.div key="tomes" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <TomeSelector />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "knowledge" && (
            <motion.div key="knowledge" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <KnowledgeBaseWidget />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}

          {viewState === "chat" && (
            <motion.div key="chat" {...cardVariants} transition={cardTransition}
              className="relative z-10 w-full flex flex-col items-center gap-4">
              <ChatWidget initialQuery={chatQuery} onCommand={handleChatCommand} />
              <BackButton onClick={handleBack} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/** Shared back button */
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-full text-label-sm
                 border border-outline-variant/15 text-on-surface-variant
                 hover:border-outline-variant/30 hover:text-on-surface
                 transition-all duration-150"
    >
      ← Back
    </button>
  );
}
