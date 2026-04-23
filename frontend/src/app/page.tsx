"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CommandBar from "@/components/CommandBar";
import QuizWidget, { SAMPLE_QUESTIONS } from "@/components/QuizWidget";
import FlashcardWidget, { SAMPLE_FLASHCARDS } from "@/components/FlashcardWidget";
import AudioPlayerWidget, { SAMPLE_TRACK } from "@/components/AudioPlayerWidget";

type ViewState = "idle" | "quiz" | "flashcards" | "audio" | "chat";

export default function Home() {
  const [response, setResponse] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>("idle");

  const handleSubmit = (text: string) => {
    const lower = text.toLowerCase().trim();

    // Simple intent detection (placeholder for real agent)
    if (lower.includes("quiz")) {
      setViewState("quiz");
    } else if (lower.includes("flashcard") || lower.includes("flash card")) {
      setViewState("flashcards");
    } else if (lower.includes("audio") || lower.includes("listen") || lower.includes("podcast")) {
      setViewState("audio");
    } else {
      setViewState("chat");
      setResponse(text);
      return;
    }
    setResponse(null);
  };

  const handleBack = () => {
    setViewState("idle");
    setResponse(null);
  };

  return (
    <main className="relative w-full min-h-screen flex flex-col items-center pt-24 pb-12 gap-5">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* Command bar — always visible */}
      <div className={`relative z-10 transition-all duration-500 ease-out ${viewState !== "idle" ? "pt-0" : "pt-8"}`}>
        <CommandBar onSubmit={handleSubmit} />
      </div>

      {/* Content area — animated cards */}
      <AnimatePresence mode="wait">
        {viewState === "quiz" && (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative z-10 w-full flex flex-col items-center gap-4"
          >
            <QuizWidget
              title="Transformers Quiz"
              questions={SAMPLE_QUESTIONS}
              onComplete={(score, total) => {
                console.log(`Quiz complete: ${score}/${total}`);
              }}
            />
            <button
              onClick={handleBack}
              className="px-4 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {viewState === "flashcards" && (
          <motion.div
            key="flashcards"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative z-10 w-full flex flex-col items-center gap-4"
          >
            <FlashcardWidget
              title="Transformer Concepts"
              cards={SAMPLE_FLASHCARDS}
            />
            <button
              onClick={handleBack}
              className="px-4 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {viewState === "audio" && (
          <motion.div
            key="audio"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative z-10 w-full flex flex-col items-center gap-4"
          >
            <AudioPlayerWidget track={SAMPLE_TRACK} />
            <button
              onClick={handleBack}
              className="px-4 py-1.5 rounded-full text-label-sm
                         border border-outline-variant/15 text-on-surface-variant
                         hover:border-outline-variant/30 hover:text-on-surface
                         transition-all duration-150"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {viewState === "chat" && response && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative z-10 w-full max-w-[640px] px-4"
          >
            <div
              className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                         p-6 text-body-md text-on-surface rounded-2xl
                         shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
            >
              {response}
            </div>
            <div className="flex justify-center mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-1.5 rounded-full text-label-sm
                           border border-outline-variant/15 text-on-surface-variant
                           hover:border-outline-variant/30 hover:text-on-surface
                           transition-all duration-150"
              >
                ← Back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
