"use client";

import { useState } from "react";

// --- Types ---

interface QuizOption {
  id: string;
  text: string;
}

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

// --- Sample data for prototyping ---

export const SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: "q1",
    question:
      "What mechanism allows transformers to process sequences in parallel rather than sequentially?",
    options: [
      { id: "a", text: "Recurrent connections" },
      { id: "b", text: "Self-attention mechanism" },
      { id: "c", text: "Convolutional layers" },
      { id: "d", text: "Pooling operations" },
    ],
    correctOptionId: "b",
    explanation:
      "Self-attention computes relationships between all positions simultaneously, eliminating the need for sequential recurrence.",
  },
  {
    id: "q2",
    question:
      "Which paper introduced the concept of 'Attention Is All You Need'?",
    options: [
      { id: "a", text: "LeCun et al. 2015" },
      { id: "b", text: "Devlin et al. 2019" },
      { id: "c", text: "Vaswani et al. 2017" },
      { id: "d", text: "Radford et al. 2018" },
    ],
    correctOptionId: "c",
    explanation:
      "Vaswani et al. introduced the transformer architecture in their 2017 paper 'Attention Is All You Need'.",
  },
  {
    id: "q3",
    question: "What is the primary function of multi-head attention?",
    options: [
      { id: "a", text: "Reduce model parameters" },
      { id: "b", text: "Speed up training convergence" },
      { id: "c", text: "Attend to information from different representation subspaces" },
      { id: "d", text: "Prevent overfitting during training" },
    ],
    correctOptionId: "c",
    explanation:
      "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.",
  },
  {
    id: "q4",
    question: "What positional encoding technique does the original transformer use?",
    options: [
      { id: "a", text: "Learned positional embeddings" },
      { id: "b", text: "Sinusoidal positional encoding" },
      { id: "c", text: "Rotary position embedding (RoPE)" },
      { id: "d", text: "Relative position bias" },
    ],
    correctOptionId: "b",
    explanation:
      "The original transformer used fixed sinusoidal positional encodings to inject position information into the model.",
  },
  {
    id: "q5",
    question: "What is the purpose of the feed-forward network in each transformer block?",
    options: [
      { id: "a", text: "To compute attention weights" },
      { id: "b", text: "To apply a position-wise nonlinear transformation" },
      { id: "c", text: "To normalize layer activations" },
      { id: "d", text: "To create residual connections" },
    ],
    correctOptionId: "b",
    explanation:
      "The feed-forward network applies the same position-wise transformation independently to each position, introducing nonlinearity.",
  },
];

// --- Component ---

type AnswerState = "unanswered" | "selected" | "correct" | "incorrect";

export default function QuizWidget({
  title = "Transformers Quiz",
  questions,
  onComplete,
}: QuizWidgetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>("unanswered");
  const [score, setScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const question = questions[currentIndex];
  const total = questions.length;

  const handleSelect = (optionId: string) => {
    if (answerState !== "unanswered" && answerState !== "selected") return;
    setSelectedOptionId(optionId);
    setAnswerState("selected");
  };

  const handleConfirm = () => {
    if (!selectedOptionId || answerState !== "selected") return;

    const isCorrect = selectedOptionId === question.correctOptionId;
    setAnswerState(isCorrect ? "correct" : "incorrect");
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (currentIndex + 1 >= total) {
      setIsComplete(true);
      onComplete?.(score + (answerState === "correct" ? 0 : 0), total);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedOptionId(null);
    setAnswerState("unanswered");
  };

  const handleSkip = () => {
    if (currentIndex + 1 >= total) {
      setIsComplete(true);
      onComplete?.(score, total);
      return;
    }
    setCurrentIndex((i) => i + 1);
    setSelectedOptionId(null);
    setAnswerState("unanswered");
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setAnswerState("unanswered");
    setScore(0);
    setIsComplete(false);
  };

  // --- Completion screen ---
  if (isComplete) {
    const pct = Math.round((score / total) * 100);
    return (
      <div className="w-full max-w-[600px] px-4">
        <div
          className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                     rounded-2xl p-8
                     shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                     flex flex-col items-center gap-6"
        >
          {/* Header */}
          <div className="text-center">
            <h2 className="text-headline-sm font-semibold text-on-surface mb-1">
              Quiz Complete!
            </h2>
            <p className="text-body-md text-on-surface-variant">{title}</p>
          </div>

          {/* Score ring */}
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                className="text-surface-container-highest"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="currentColor"
                className={pct >= 70 ? "text-primary" : "text-tertiary"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 264} 264`}
              />
            </svg>
            <span className="text-headline-sm font-bold text-on-surface">{pct}%</span>
          </div>

          <p className="text-body-md text-on-surface-variant">
            {score} of {total} correct
          </p>

          {/* Restart button */}
          <button
            onClick={handleRestart}
            className="px-6 py-2.5 rounded-full text-body-md font-medium
                       border border-outline-variant/20 text-on-surface
                       hover:border-primary/40 hover:text-primary
                       transition-all duration-150"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // --- Question screen ---
  const getOptionStyle = (optionId: string) => {
    const isSelected = selectedOptionId === optionId;
    const isCorrectAnswer = question.correctOptionId === optionId;

    // After confirming (answered)
    if (answerState === "correct" || answerState === "incorrect") {
      if (isCorrectAnswer) {
        return "bg-emerald-500/15 border-emerald-400/30 text-emerald-300";
      }
      if (isSelected && !isCorrectAnswer) {
        return "bg-red-500/15 border-red-400/30 text-red-300";
      }
      return "bg-surface-container-low border-outline-variant/10 text-on-surface-variant/50";
    }

    // Selected (before confirming)
    if (isSelected) {
      return "bg-primary-container/20 border-primary/40 text-on-surface shadow-[inset_0_0_0_2px_rgba(173,198,255,0.2)]";
    }

    // Default
    return "bg-surface-container-low border-outline-variant/10 text-on-surface hover:border-outline-variant/25 hover:bg-surface-container/80";
  };

  const showFeedback =
    answerState === "correct" || answerState === "incorrect";

  return (
    <div className="w-full max-w-[600px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl p-6
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   flex flex-col gap-5"
      >
        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">
            {title}
          </h2>
          <span className="text-label-sm text-on-surface-variant tracking-[0.05em] uppercase">
            Question {currentIndex + 1} of {total}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i === currentIndex
                  ? "bg-primary"
                  : i < currentIndex
                    ? "bg-primary/40"
                    : "bg-surface-container-highest"
              }`}
            />
          ))}
        </div>

        {/* Question text */}
        <p className="text-body-md text-on-surface leading-relaxed">
          {question.question}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              disabled={showFeedback}
              className={`
                w-full text-left px-4 py-3 rounded-lg border
                transition-all duration-150
                text-body-md font-medium
                disabled:cursor-default
                ${getOptionStyle(option.id)}
              `}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`text-label-sm uppercase tracking-[0.05em] ${
                    selectedOptionId === option.id
                      ? "text-primary"
                      : "text-on-surface-variant/60"
                  }`}
                >
                  {option.id}.
                </span>
                {option.text}
              </span>
            </button>
          ))}
        </div>

        {/* Feedback message */}
        {showFeedback && question.explanation && (
          <div
            className={`text-body-md px-4 py-3 rounded-lg border ${
              answerState === "correct"
                ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                : "bg-red-500/10 border-red-400/20 text-red-200"
            }`}
          >
            {answerState === "correct" ? "✓ " : "✗ "}
            {question.explanation}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-1">
          {/* Skip */}
          <button
            onClick={handleSkip}
            className="px-5 py-2 rounded-full text-body-md
                       border border-outline-variant/20 text-on-surface-variant
                       hover:border-outline-variant/40 hover:text-on-surface
                       transition-all duration-150"
          >
            Skip
          </button>

          {/* Confirm / Next */}
          {answerState === "selected" ? (
            <button
              onClick={handleConfirm}
              className="px-5 py-2 rounded-full text-body-md font-medium
                         bg-primary-container/20 border border-primary/30 text-primary
                         hover:bg-primary-container/30
                         transition-all duration-150"
            >
              Confirm
            </button>
          ) : showFeedback ? (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-full text-body-md font-medium
                         bg-primary-container/20 border border-primary/30 text-primary
                         hover:bg-primary-container/30
                         transition-all duration-150"
            >
              {currentIndex + 1 >= total ? "See Results" : "Next →"}
            </button>
          ) : (
            <div className="px-5 py-2 text-body-md text-on-surface-variant/30">
              Select an answer
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
