"use client";

import { useState, useRef, useEffect } from "react";

interface CommandBarProps {
  onSubmit: (response: string) => void;
}

export default function CommandBar({ onSubmit }: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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
    <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[600px] px-4">
      <div
        className="h-12 w-full bg-surface/80 backdrop-blur-[32px] rounded-full border border-outline-variant/15
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
          <span className="text-label-sm text-primary leading-none">⚡</span>
          <span className="text-label-sm text-on-surface-variant font-medium uppercase leading-none mt-[1px]">
            GPT-4o
          </span>
        </div>
      </div>
    </form>
  );
}
