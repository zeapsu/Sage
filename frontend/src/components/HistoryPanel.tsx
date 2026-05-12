"use client";

import { useEffect, useMemo, useState } from "react";
import { listChatSessions, type ChatSessionSummary } from "@/lib/sage-api";

interface HistoryItem {
  id: string;
  type: "chat";
  title: string;
  timestamp: string;
  rawTimestamp: string;
  tomeName?: string;
}

interface HistoryPanelProps {
  onSelect?: (item: HistoryItem) => void;
}

const ICONS: Record<HistoryItem["type"], { icon: string; color: string; label: string }> = {
  chat: { icon: "chat_bubble", color: "text-blue-400", label: "Chat" },
};

function deriveTitle(session: ChatSessionSummary): string {
  const raw = (session.first_user_message ?? "").trim();
  if (!raw) return "(empty session)";
  const firstLine = raw.split("\n", 1)[0]!;
  return firstLine.length > 90 ? firstLine.slice(0, 87) + "…" : firstLine;
}

/** Render a timestamp relative-ish: today → time, otherwise short date. */
function formatTimestamp(iso: string): { display: string; bucket: string } {
  if (!iso) return { display: "", bucket: "Older" };
  // SQLite "datetime('now')" returns "YYYY-MM-DD HH:MM:SS" in UTC without a Z suffix.
  // The Document.created_at default uses ISO format. Handle both.
  const normalized = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return { display: iso, bucket: "Older" };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);

  if (d >= startOfToday) {
    return {
      display: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      bucket: "Today",
    };
  }
  if (d >= startOfYesterday) {
    return {
      display: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      bucket: "Yesterday",
    };
  }
  if (d >= startOfWeek) {
    return {
      display: d.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" }),
      bucket: "Earlier this week",
    };
  }
  return {
    display: d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }),
    bucket: "Older",
  };
}

export default function HistoryPanel({ onSelect }: HistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listChatSessions(200)
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo<HistoryItem[]>(
    () =>
      sessions
        // Skip sessions that never received a user message — they're noise.
        .filter((s) => s.message_count > 0 && s.first_user_message)
        .map((s) => {
          const ts = formatTimestamp(s.last_message_at);
          return {
            id: s.id,
            type: "chat" as const,
            title: deriveTitle(s),
            timestamp: ts.display,
            rawTimestamp: s.last_message_at,
            tomeName: s.tome_name ?? undefined,
          };
        }),
    [sessions],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.tomeName ?? "").toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const bucket = formatTimestamp(item.rawTimestamp).bucket;
      const list = map.get(bucket);
      if (list) list.push(item);
      else map.set(bucket, [item]);
    }
    const order = ["Today", "Yesterday", "Earlier this week", "Older"];
    return order
      .filter((label) => map.has(label))
      .map((label) => ({ label, items: map.get(label)! }));
  }, [filtered]);

  return (
    <div className="w-full max-w-[640px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
      >
        <div className="p-5 pb-3 border-b border-outline-variant/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-headline-sm font-semibold text-on-surface">History</h2>
            <span className="text-label-sm text-on-surface-variant/60">
              {loading ? "…" : `${items.length} session${items.length === 1 ? "" : "s"}`}
            </span>
          </div>
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
        </div>

        {error && (
          <div className="mx-5 mt-3 text-label-md text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto">
          {loading && (
            <div className="p-8 text-center text-body-md text-on-surface-variant/60">
              Loading history…
            </div>
          )}
          {!loading && groups.length === 0 && (
            <div className="p-8 text-center text-body-md text-on-surface-variant/50">
              {searchQuery
                ? "No matching history"
                : "No conversations yet. Ask Sage something to start one."}
            </div>
          )}
          {!loading &&
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-5 py-2 text-label-sm text-on-surface-variant/50 uppercase tracking-[0.05em]">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const { icon, color } = ICONS[item.type];
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelect?.(item)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left
                                 hover:bg-surface-container-high/40 transition-colors duration-150"
                    >
                      <span className={`material-symbols-outlined text-xl flex-shrink-0 ${color}`}>
                        {icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface truncate">{item.title}</p>
                        {item.tomeName && (
                          <p className="text-label-sm text-on-surface-variant/50 mt-0.5">
                            {item.tomeName}
                          </p>
                        )}
                      </div>
                      <span className="text-label-sm text-on-surface-variant/40 flex-shrink-0">
                        {item.timestamp}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
