"use client";

import { useState } from "react";

// --- Types ---

interface Tome {
  id: string;
  name: string;
  description: string;
  docCount: number;
  lastAccessed: string;
  color: string;
}

interface TomeSelectorProps {
  tomes?: Tome[];
  activeTomeId?: string | null;
  onSelect?: (tome: Tome) => void;
}

// --- Sample data ---

export const SAMPLE_TOMES: Tome[] = [
  {
    id: "t1",
    name: "Deep Learning Foundations",
    description: "Core papers on neural networks, optimization, and regularization",
    docCount: 24,
    lastAccessed: "2 hours ago",
    color: "bg-blue-500/15 text-blue-400 border-blue-400/20",
  },
  {
    id: "t2",
    name: "NLP Papers",
    description: "Transformers, BERT, GPT, and language modeling advances",
    docCount: 18,
    lastAccessed: "Yesterday",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20",
  },
  {
    id: "t3",
    name: "Computer Vision",
    description: "CNNs, ViT, object detection, and image segmentation",
    docCount: 12,
    lastAccessed: "3 days ago",
    color: "bg-violet-500/15 text-violet-400 border-violet-400/20",
  },
  {
    id: "t4",
    name: "Alignment Research",
    description: "RLHF, constitutional AI, and safety research",
    docCount: 8,
    lastAccessed: "Last week",
    color: "bg-amber-500/15 text-amber-400 border-amber-400/20",
  },
];

// --- Component ---

export default function TomeSelector({ tomes = SAMPLE_TOMES, activeTomeId, onSelect }: TomeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = tomes.filter(
    (t) => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-[640px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
      >
        {/* Header */}
        <div className="p-5 pb-3 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-headline-sm font-semibold text-on-surface">Tomes</h2>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-label-sm
                         bg-primary/10 border border-primary/25 text-primary
                         hover:bg-primary/15 transition-all duration-150"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              New Tome
            </button>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tomes..."
              className="w-full h-9 bg-surface-container-low border border-outline-variant/10
                         rounded-lg pl-9 pr-4 text-body-md text-on-surface
                         placeholder:text-on-surface-variant/50
                         focus:border-primary/40 transition-colors duration-150"
            />
          </div>
        </div>

        {/* Tome list */}
        <div className="max-h-[400px] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-body-md text-on-surface-variant/50">
              No tomes found
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((tome) => {
                const isActive = tome.id === activeTomeId;
                return (
                  <button
                    key={tome.id}
                    onClick={() => onSelect?.(tome)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-150
                      ${isActive
                        ? "bg-primary/10 border-primary/30"
                        : "bg-surface-container-low/50 border-outline-variant/10 hover:border-outline-variant/20 hover:bg-surface-container/60"
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Tome icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${tome.color}`}>
                        <span className="material-symbols-outlined text-lg">auto_stories</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-body-md font-medium text-on-surface truncate">{tome.name}</h3>
                          {isActive && (
                            <span className="text-label-sm text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Active</span>
                          )}
                        </div>
                        <p className="text-label-sm text-on-surface-variant mt-0.5 truncate">{tome.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-label-sm text-on-surface-variant/50">
                            <span className="material-symbols-outlined text-xs align-text-bottom mr-0.5">description</span>
                            {tome.docCount} docs
                          </span>
                          <span className="text-label-sm text-on-surface-variant/50">{tome.lastAccessed}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
