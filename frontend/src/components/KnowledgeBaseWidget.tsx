"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteDocument,
  getDocument,
  listDocuments,
  type DocumentDetail,
  type DocumentSummary,
} from "@/lib/sage-api";
import UploadModal from "./UploadModal";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function KnowledgeBaseWidget() {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDocuments({ limit: 200 });
      setDocs(data);
      setSelectedId((prev) => (prev && data.some((d) => d.id === prev) ? prev : data[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    getDocument(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setDetail(null);
        console.error("Failed to load document detail:", err);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleDelete = async (docId: string) => {
    setPendingDelete(docId);
    try {
      await deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (selectedId === docId) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="w-full max-w-[960px] px-4">
      <div
        className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15
                   rounded-2xl overflow-hidden flex flex-col
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]"
        style={{ height: "560px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">database</span>
            <h2 className="text-title-md font-medium text-on-surface">Knowledge base</h2>
            <span className="text-label-sm text-on-surface-variant ml-1">
              {loading ? "…" : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUploadOpen(true)}
              className="px-3 py-1 rounded-full text-label-sm text-primary
                         border border-primary/30 hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">upload_file</span>
              Add document
            </button>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="px-3 py-1 rounded-full text-label-sm text-on-surface-variant
                         border border-outline-variant/15 hover:border-outline-variant/30
                         hover:text-on-surface transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">refresh</span>
              Refresh
            </button>
          </div>
        </div>

        <UploadModal
          open={uploadOpen}
          onClose={() => {
            setUploadOpen(false);
            void refresh();
          }}
        />

        {error && (
          <div className="mx-5 mt-3 text-label-md text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Body — two-pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* List */}
          <div className="w-[340px] border-r border-outline-variant/10 overflow-y-auto">
            {loading && (
              <div className="p-5 text-body-md text-on-surface-variant">Loading…</div>
            )}
            {!loading && docs.length === 0 && (
              <div className="p-5 text-body-md text-on-surface-variant">
                Nothing here yet. Click &ldquo;Add document&rdquo; above to upload one.
              </div>
            )}
            {!loading &&
              docs.map((doc) => {
                const isActive = doc.id === selectedId;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedId(doc.id)}
                    className={`w-full text-left px-4 py-3 border-b border-outline-variant/10 transition-colors ${
                      isActive
                        ? "bg-primary/10 border-l-2 border-l-primary/60"
                        : "hover:bg-surface-container-low"
                    }`}
                  >
                    <div className="text-body-md text-on-surface truncate">{doc.title}</div>
                    <div className="text-label-sm text-on-surface-variant mt-0.5 flex items-center gap-2">
                      <span className="uppercase tracking-wide">{doc.doc_type}</span>
                      <span>·</span>
                      <span>{doc.source}</span>
                    </div>
                    <div className="text-label-sm text-on-surface-variant/60 mt-0.5">
                      {formatDate(doc.created_at)}
                    </div>
                  </button>
                );
              })}
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedId && !loading && (
              <div className="text-body-md text-on-surface-variant">
                Select a document to view details.
              </div>
            )}
            {selectedId && detailLoading && (
              <div className="text-body-md text-on-surface-variant">Loading details…</div>
            )}
            {detail && !detailLoading && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="text-headline-sm text-on-surface">{detail.title}</div>
                  <div className="text-label-sm text-on-surface-variant mt-1">
                    {formatDate(detail.created_at)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Source" value={detail.source} />
                  <Stat label="Type" value={detail.doc_type} />
                  <Stat label="Chunks" value={String(detail.chunks)} />
                  <Stat
                    label="Content hash"
                    value={detail.content_hash.slice(0, 12) + "…"}
                    mono
                  />
                </div>

                <div>
                  <div className="text-label-md text-on-surface-variant mb-1">Tomes</div>
                  {detail.tomes.length === 0 ? (
                    <div className="text-body-md text-on-surface-variant/70">
                      Not linked to any tome.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.tomes.map((t) => (
                        <span
                          key={t.id}
                          className="text-label-sm bg-surface-container-low border border-outline-variant/15
                                     rounded-full px-2.5 py-1 text-on-surface-variant"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-label-md text-on-surface-variant mb-1">Preview</div>
                  <div
                    className="text-body-md text-on-surface whitespace-pre-wrap bg-surface-container-low
                               border border-outline-variant/10 rounded-xl px-3 py-2 leading-relaxed"
                  >
                    {detail.content_preview || "(empty)"}
                  </div>
                </div>

                <div className="pt-2 border-t border-outline-variant/10 flex justify-end">
                  <button
                    onClick={() => void handleDelete(detail.id)}
                    disabled={pendingDelete === detail.id}
                    className="px-3 py-1.5 rounded-full text-label-md text-error
                               border border-error/30 hover:bg-error/10
                               disabled:opacity-40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm align-middle mr-1">
                      delete
                    </span>
                    {pendingDelete === detail.id ? "Deleting…" : "Delete document"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-surface-container-low border border-outline-variant/10 rounded-lg px-3 py-2">
      <div className="text-label-sm text-on-surface-variant">{label}</div>
      <div className={`text-body-md text-on-surface truncate ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
