"use client";

import { useEffect, useRef, useState } from "react";
import { ingestDocument } from "@/lib/sage-api";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  tomeId?: string;
}

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; title: string; chunks: number; deduplicated: boolean }
  | { kind: "error"; message: string };

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".rst", ".csv", ".json", ".log"];

export default function UploadModal({ open, onClose, tomeId }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setFilename("");
      setStatus({ kind: "idle" });
      setDragOver(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const readFile = async (file: File) => {
    const name = file.name;
    const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
    if (!TEXT_EXTENSIONS.includes(ext) && !file.type.startsWith("text/")) {
      setStatus({
        kind: "error",
        message: `Unsupported file type "${ext || file.type}". Use plain text (.txt, .md, .csv, .json) or paste content directly.`,
      });
      return;
    }
    const text = await file.text();
    setContent(text);
    setFilename(name);
    if (!title.trim()) setTitle(name.replace(/\.[^.]+$/, ""));
    setStatus({ kind: "idle" });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const handleSubmit = async () => {
    const finalTitle = title.trim() || filename || "Untitled";
    const finalContent = content.trim();
    if (!finalContent) {
      setStatus({ kind: "error", message: "Add some content first." });
      return;
    }
    setStatus({ kind: "uploading" });
    try {
      const res = await ingestDocument(finalTitle, finalContent, {
        docType: filename ? "file" : "text",
        sourceId: filename || "",
        tomeId,
      });
      setStatus({
        kind: "success",
        title: res.title,
        chunks: res.chunks,
        deduplicated: res.deduplicated,
      });
      setContent("");
      setTitle("");
      setFilename("");
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] mx-4 bg-surface border border-outline-variant/20 rounded-2xl
                   shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">upload_file</span>
            <h2 className="text-title-md font-medium text-on-surface">Add to knowledge base</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="bg-surface-container-low border border-outline-variant/10 rounded-xl px-3 py-2
                       text-body-md text-on-surface placeholder:text-on-surface-variant/50
                       outline-none focus:border-primary/40 transition-colors"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`rounded-xl border border-dashed transition-colors p-4 flex flex-col gap-2 ${
              dragOver
                ? "border-primary/60 bg-primary/5"
                : "border-outline-variant/25 bg-surface-container-low"
            }`}
          >
            <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
              <span>
                {filename
                  ? `Loaded: ${filename}`
                  : "Drop a text file here, or paste content below"}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md border border-outline-variant/15
                           hover:border-primary/30 hover:text-on-surface transition-colors"
              >
                Choose file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,.rst,.csv,.json,.log,text/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste document content..."
              rows={10}
              className="bg-transparent text-body-md text-on-surface placeholder:text-on-surface-variant/50
                         outline-none resize-y leading-relaxed"
            />
          </div>

          {status.kind === "error" && (
            <div className="text-label-md text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
              {status.message}
            </div>
          )}
          {status.kind === "success" && (
            <div className="text-label-md text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
              {status.deduplicated
                ? `Already in knowledge base: "${status.title}" (${status.chunks} chunks).`
                : `Ingested "${status.title}" — ${status.chunks} chunks indexed.`}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-outline-variant/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-label-md text-on-surface-variant
                       border border-outline-variant/15 hover:border-outline-variant/30
                       hover:text-on-surface transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={status.kind === "uploading" || !content.trim()}
            className="px-4 py-1.5 rounded-full text-label-md bg-primary/20 border border-primary/30
                       text-primary hover:bg-primary/30 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {status.kind === "uploading" ? "Uploading..." : "Add to knowledge base"}
          </button>
        </div>
      </div>
    </div>
  );
}
