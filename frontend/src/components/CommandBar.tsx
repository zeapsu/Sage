"use client";

import { useState, useRef, useEffect } from "react";
import { getRuntimeConfig } from "@/lib/sage-api";

interface CommandBarProps {
  onSubmit: (response: string) => void;
  /** When true, the side button shows close and returns to idle on click. */
  isKnowledgeBaseOpen?: boolean;
  onKnowledgeBaseToggle?: () => void;
}

export default function CommandBar({
  onSubmit,
  isKnowledgeBaseOpen = false,
  onKnowledgeBaseToggle,
}: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modelLabel, setModelLabel] = useState("…");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRuntimeConfig()
      .then((cfg) => {
        if (!cancelled) setModelLabel(cfg.model || cfg.provider || "unknown");
      })
      .catch(() => {
        if (!cancelled) setModelLabel("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    // Pass the raw query up — parent decides what to do with it
    onSubmit(query.trim());
    setQuery("");
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[660px] px-4 flex items-center gap-2">
      <div
        className="h-12 flex-1 bg-surface/80 backdrop-blur-[32px] rounded-full border border-outline-variant/15
                   flex items-center px-4
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   transition-all duration-300 hover:border-outline-variant/30
                   focus-within:border-primary/40"
      >
        {/* Sparkle icon */}
        <span
          className="material-symbols-outlined text-primary text-xl flex-shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          auto_awesome
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your knowledge base..."
          disabled={isLoading}
          className="flex-1 h-full bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/60 text-body-md px-3 w-full"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Provider badge */}
        <div className="flex items-center gap-1 bg-surface-container-high rounded-full px-2.5 py-1 border border-outline-variant/10 flex-shrink-0 cursor-default hover:border-primary/40 transition-colors">
          <span className="text-label-sm text-on-surface-variant font-medium uppercase leading-none mt-[1px]">
            {modelLabel}
          </span>
        </div>
      </div>

      {/* Knowledge base: open (library) or close (X) when already open */}
      <button
        type="button"
        onClick={() => onKnowledgeBaseToggle?.()}
        title={
          isKnowledgeBaseOpen
            ? "Close knowledge base"
            : "Browse and upload knowledge base documents"
        }
        aria-label={isKnowledgeBaseOpen ? "Close knowledge base" : "Open knowledge base"}
        className="h-12 w-12 flex-shrink-0 rounded-full bg-surface/80 backdrop-blur-[32px]
                   border border-outline-variant/15
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   flex items-center justify-center text-on-surface-variant
                   hover:border-primary/40 hover:text-primary
                   transition-all duration-300"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden>
          {isKnowledgeBaseOpen ? "close" : "library_add"}
        </span>
      </button>
    </form>
  );
}
