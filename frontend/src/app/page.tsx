"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CommandBar from "@/components/CommandBar";
import QuizWidget, { SAMPLE_QUESTIONS } from "@/components/QuizWidget";
import FlashcardWidget, { SAMPLE_FLASHCARDS } from "@/components/FlashcardWidget";
import AudioPlayerWidget, { SAMPLE_TRACK } from "@/components/AudioPlayerWidget";
import ReportViewWidget, { SAMPLE_REPORT } from "@/components/ReportViewWidget";
import HistoryPanel from "@/components/HistoryPanel";
import TomeSelector from "@/components/TomeSelector";
import ChatWidget from "@/components/ChatWidget";

type ViewState = "idle" | "quiz" | "flashcards" | "audio" | "report" | "history" | "tomes" | "chat";

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>("idle");

  const handleSubmit = (text: string) => {
    const lower = text.toLowerCase().trim();

    if (lower.includes("quiz")) {
      setViewState("quiz");
    } else if (lower.includes("flashcard") || lower.includes("flash card")) {
      setViewState("flashcards");
    } else if (lower.includes("audio") || lower.includes("listen") || lower.includes("podcast")) {
      setViewState("audio");
    } else if (lower.includes("report") || lower.includes("study guide") || lower.includes("summary")) {
      setViewState("report");
    } else if (lower.includes("history")) {
      setViewState("history");
    } else if (lower.includes("tome") || lower.includes("collection") || lower.includes("library")) {
      setViewState("tomes");
    } else {
      setViewState("chat");
    }
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

  return (
    <main className="relative w-full min-h-screen flex flex-col items-center pt-24 pb-12 gap-5">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* Command bar — always visible, shifts up when content appears */}
      <div
        className={`relative z-10 transition-all duration-500 ease-out ${
          viewState !== "idle" ? "pt-0" : "pt-8"
        }`}
      >
        <CommandBar onSubmit={handleSubmit} />
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {viewState === "quiz" && (
          <motion.div key="quiz" {...cardVariants} transition={cardTransition}
            className="relative z-10 w-full flex flex-col items-center gap-4">
            <QuizWidget title="Transformers Quiz" questions={SAMPLE_QUESTIONS} />
            <BackButton onClick={handleBack} />
          </motion.div>
        )}

        {viewState === "flashcards" && (
          <motion.div key="flashcards" {...cardVariants} transition={cardTransition}
            className="relative z-10 w-full flex flex-col items-center gap-4">
            <FlashcardWidget title="Transformer Concepts" cards={SAMPLE_FLASHCARDS} />
            <BackButton onClick={handleBack} />
          </motion.div>
        )}

        {viewState === "audio" && (
          <motion.div key="audio" {...cardVariants} transition={cardTransition}
            className="relative z-10 w-full flex flex-col items-center gap-4">
            <AudioPlayerWidget track={SAMPLE_TRACK} />
            <BackButton onClick={handleBack} />
          </motion.div>
        )}

        {viewState === "report" && (
          <motion.div key="report" {...cardVariants} transition={cardTransition}
            className="relative z-10 w-full flex flex-col items-center gap-4">
            <ReportViewWidget report={SAMPLE_REPORT} />
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

        {viewState === "chat" && (
          <motion.div key="chat" {...cardVariants} transition={cardTransition}
            className="relative z-10 w-full flex flex-col items-center gap-4">
            <ChatWidget />
            <BackButton onClick={handleBack} />
          </motion.div>
        )}
      </AnimatePresence>
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
