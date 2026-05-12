"use client";

import { useEffect, useState } from "react";
import ReportViewWidget from "./ReportViewWidget";
import {
  generateReport,
  type GeneratedSource,
  type ReportGeneration,
} from "@/lib/sage-api";

interface ReportViewProps {
  prompt: string;
  tomeId?: string;
}

export default function ReportView({ prompt, tomeId }: ReportViewProps) {
  const [report, setReport] = useState<ReportGeneration | null>(null);
  const [sources, setSources] = useState<GeneratedSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setError(null);
    setSources([]);
    generateReport({ topic: prompt || undefined, tomeId })
      .then((res) => {
        if (cancelled) return;
        setReport(res);
        setSources(res.sources);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [prompt, tomeId, reloadKey]);

  if (error) {
    return (
      <StatusCard
        icon="error"
        title="Couldn't generate report"
        detail={error}
        onRetry={() => setReloadKey((k) => k + 1)}
      />
    );
  }

  if (!report) {
    return (
      <StatusCard
        icon="hourglass_top"
        title="Generating report…"
        detail="Synthesizing your knowledge base into a structured report."
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <ReportViewWidget
        report={{
          title: report.title,
          subtitle: report.subtitle ?? undefined,
          sourceDocs: report.sourceDocs ?? undefined,
          toc: report.toc,
          content: report.content,
        }}
      />
      {sources.length > 0 && <SourcesFooter sources={sources} />}
    </div>
  );
}

function StatusCard({
  icon, title, detail, onRetry,
}: { icon: string; title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="w-full max-w-[640px] px-4">
      <div className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15 rounded-2xl px-6 py-8
                      shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col items-center gap-2 text-center">
        <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
        <div className="text-title-md text-on-surface">{title}</div>
        {detail && <div className="text-body-md text-on-surface-variant max-w-[480px]">{detail}</div>}
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-3 py-1 rounded-full text-label-md border border-outline-variant/20
                       text-on-surface-variant hover:border-primary/40 hover:text-on-surface transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function SourcesFooter({ sources }: { sources: GeneratedSource[] }) {
  const unique = Array.from(new Map(sources.map((s) => [s.document_id, s])).values());
  return (
    <div className="w-full max-w-[800px] px-4 text-label-sm text-on-surface-variant flex flex-wrap gap-1.5 justify-center">
      <span className="text-on-surface-variant/60">Grounded in:</span>
      {unique.map((s) => (
        <span
          key={s.document_id}
          className="bg-surface-container-low border border-outline-variant/10 rounded-full px-2.5 py-0.5"
        >
          {s.document_title}
        </span>
      ))}
    </div>
  );
}
