"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface FlashcardWidgetProps {
  title?: string;
  cards: Flashcard[];
}

// --- Sample data for prototyping ---

export const SAMPLE_FLASHCARDS: Flashcard[] = [
  {
    id: "f1",
    front: "What is the key innovation of the transformer architecture?",
    back: "Self-attention mechanism — allows processing all positions in a sequence simultaneously, eliminating recurrence entirely.",
  },
  {
    id: "f2",
    front: "What is 'multi-head attention'?",
    back: "Running multiple attention operations in parallel, each learning different relationships (syntactic, semantic, positional) between tokens.",
  },
  {
    id: "f3",
    front: "What role does the feed-forward network play in a transformer block?",
    back: "Applies a position-wise nonlinear transformation independently to each position, introducing representational capacity after attention.",
  },
  {
    id: "f4",
    front: "Why are residual connections important in transformers?",
    back: "They allow gradients to flow directly through the network during backpropagation, enabling training of very deep models without vanishing gradients.",
  },
  {
    id: "f5",
    front: "What is the purpose of layer normalization in transformers?",
    back: "Normalizes activations across the feature dimension for each example, stabilizing training and enabling higher learning rates.",
  },
  {
    id: "f6",
    front: "How does positional encoding work in the original transformer?",
    back: "Uses fixed sinusoidal functions at different frequencies to encode position — sine for even dimensions, cosine for odd dimensions.",
  },
];

// --- Component ---

export default function FlashcardWidget({
  title = "Flashcards",
  cards,
}: FlashcardWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [shuffledCards, setShuffledCards] = useState(cards);
  const [direction, setDirection] = useState(0); // -1 prev, 0 initial, 1 next

  const current = shuffledCards[currentIndex];
  const total = shuffledCards.length;

  const handleFlip = useCallback(() => {
    setIsFlipped((f) => !f);
  }, []);

  const handleNext = useCallback(() => {
    if (currentIndex >= total - 1) return;
    setIsFlipped(false);
    setDirection(1);
    setTimeout(() => setCurrentIndex((i) => i + 1), 50);
  }, [currentIndex, total]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setIsFlipped(false);
    setDirection(-1);
    setTimeout(() => setCurrentIndex((i) => i - 1), 50);
  }, [currentIndex]);

  const handleShuffle = useCallback(() => {
    const shuffled = [...shuffledCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setDirection(0);
  }, [shuffledCards]);

  const handleReset = useCallback(() => {
    setShuffledCards(cards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setDirection(0);
  }, [cards]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        handleNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        handlePrev();
      }
    },
    [handleFlip, handleNext, handlePrev]
  );

  return (
    <div
      className="w-full max-w-[640px] px-4"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl p-6
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   flex flex-col items-center gap-6"
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">
            {title}
          </h2>
          <span className="text-label-sm text-on-surface-variant tracking-[0.05em] uppercase">
            {currentIndex + 1} / {total}
          </span>
        </div>

        {/* Flashcard — 3D flip container */}
        <div
          className="w-full perspective-[1000px] cursor-pointer"
          onClick={handleFlip}
        >
          <motion.div
            className="relative w-full min-h-[300px]"
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Front face */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center
                         bg-surface-container-high rounded-2xl border border-outline-variant/10
                         px-10 py-12 text-center"
              style={{ backfaceVisibility: "hidden" }}
            >
              <p className="text-title-md text-on-surface leading-relaxed font-medium">
                {current.front}
              </p>
              <p className="text-label-sm text-on-surface-variant/50 mt-6 tracking-[0.05em] uppercase">
                click to flip
              </p>
            </div>

            {/* Back face */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center
                         bg-surface-container-high rounded-2xl border border-primary/20
                         px-10 py-12 text-center"
              style={{
                backfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
              }}
            >
              <p className="text-body-md text-on-surface leading-relaxed">
                {current.back}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {shuffledCards.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setIsFlipped(false);
                setDirection(i > currentIndex ? 1 : -1);
                setTimeout(() => setCurrentIndex(i), 50);
              }}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === currentIndex
                  ? "bg-primary scale-125"
                  : i < currentIndex
                    ? "bg-primary/40"
                    : "bg-surface-container-highest"
              }`}
            />
          ))}
        </div>

        {/* Navigation + Controls */}
        <div className="w-full flex items-center justify-between">
          {/* Shuffle */}
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-body-md
                       border border-outline-variant/15 text-on-surface-variant
                       hover:border-outline-variant/30 hover:text-on-surface
                       transition-all duration-150"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
              shuffle
            </span>
            Shuffle
          </button>

          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="w-9 h-9 rounded-full border border-outline-variant/15
                         flex items-center justify-center
                         text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= total - 1}
              className="w-9 h-9 rounded-full border border-outline-variant/15
                         flex items-center justify-center
                         text-on-surface-variant hover:border-outline-variant/30 hover:text-on-surface
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-body-md
                       border border-outline-variant/15 text-on-surface-variant
                       hover:border-outline-variant/30 hover:text-on-surface
                       transition-all duration-150"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
              restart_alt
            </span>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
