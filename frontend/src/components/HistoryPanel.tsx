"use client";

import { useState } from "react";

// --- Types ---

interface HistoryItem {
  id: string;
  type: "chat" | "quiz" | "flashcard" | "audio" | "report";
  title: string;
  timestamp: string;
  tomeName?: string;
}

interface HistoryPanelProps {
  items?: HistoryItem[];
  onSelect?: (item: HistoryItem) => void;
}

// --- Sample data ---

const ICONS: Record<string, { icon: string; color: string }> = {
  chat: { icon: "chat_bubble", color: "text-blue-400" },
  quiz: { icon: "quiz", color: "text-emerald-400" },
  flashcard: { icon: "style", color: "text-amber-400" },
  audio: { icon: "headphones", color: "text-violet-400" },
  report: { icon: "description", color: "text-rose-400" },
};

export const SAMPLE_HISTORY: HistoryItem[] = [
  { id: "1", type: "report", title: "Attention Mechanisms", timestamp: "2:34 PM", tomeName: "Deep Learning Foundations" },
  { id: "2", type: "quiz", title: "Transformer Quiz", timestamp: "1:15 PM", tomeName: "Deep Learning Foundations" },
  { id: "3", type: "audio", title: "Audio: BERT Architecture", timestamp: "12:02 PM", tomeName: "NLP Papers" },
  { id: "4", type: "chat", title: "Explain backpropagation", timestamp: "11:30 AM", tomeName: "Deep Learning Foundations" },
  { id: "5", type: "flashcard", title: "GPT Architecture Cards", timestamp: "Yesterday", tomeName: "NLP Papers" },
  { id: "6", type: "report", title: "RLHF Overview", timestamp: "Yesterday", tomeName: "Alignment Research" },
  { id: "7", type: "quiz", title: "CNN Fundamentals", timestamp: "2 days ago", tomeName: "Computer Vision" },
  { id: "8", type: "chat", title: "Compare Adam vs SGD", timestamp: "2 days ago", tomeName: "Deep Learning Foundations" },
];

// --- Component ---

export default function HistoryPanel({ items = SAMPLE_HISTORY, onSelect }: HistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = items.filter((item) => {
    const matchesSearch = !searchQuery || item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || item.type === filterType;
    return matchesSearch && matchesType;
  });

  // Group by time
  const groups: { label: string; items: HistoryItem[] }[] = [];
  let currentGroup: { label: string; items: HistoryItem[] } | null = null;

  for (const item of filtered) {
    const label = item.timestamp.includes("PM") || item.timestamp.includes("AM") ? "Today" : item.timestamp;
    if (!currentGroup || currentGroup.label !== label) {
      currentGroup = { label, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(item);
  }

  return (
    <div className="w-full max-w-[640px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
      >
        {/* Header + Search */}
        <div className="p-5 pb-3 border-b border-outline-variant/10">
          <h2 className="text-headline-sm font-semibold text-on-surface mb-3">History</h2>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full h-9 bg-surface-container-low border border-outline-variant/10
                         rounded-lg pl-9 pr-4 text-body-md text-on-surface
                         placeholder:text-on-surface-variant/50
                         focus:border-primary/40 transition-colors duration-150"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 mt-3 overflow-x-auto">
            <button
              onClick={() => setFilterType(null)}
              className={`px-3 py-1 rounded-full text-label-sm whitespace-nowrap transition-all duration-150
                ${!filterType
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-on-surface-variant border border-outline-variant/10 hover:border-outline-variant/25"
                }`}
            >
              All
            </button>
            {Object.entries(ICONS).map(([type, { icon, color }]) => (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? null : type)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-label-sm whitespace-nowrap transition-all duration-150
                  ${filterType === type
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-on-surface-variant border border-outline-variant/10 hover:border-outline-variant/25"
                  }`}
              >
                <span className={`material-symbols-outlined text-sm ${filterType === type ? "text-primary" : color}`}>{icon}</span>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* History list */}
        <div className="max-h-[400px] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-8 text-center text-body-md text-on-surface-variant/50">
              No matching history
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-5 py-2 text-label-sm text-on-surface-variant/50 uppercase tracking-[0.05em]">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const { icon, color } = ICONS[item.type] || ICONS.chat;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect?.(item)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left
                                 hover:bg-surface-container-high/40 transition-colors duration-150"
                    >
                      <span className={`material-symbols-outlined text-xl flex-shrink-0 ${color}`}>{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface truncate">{item.title}</p>
                        {item.tomeName && (
                          <p className="text-label-sm text-on-surface-variant/50 mt-0.5">{item.tomeName}</p>
                        )}
                      </div>
                      <span className="text-label-sm text-on-surface-variant/40 flex-shrink-0">{item.timestamp}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
