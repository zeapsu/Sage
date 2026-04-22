"use client";

import { useState, useEffect, useCallback } from "react";
import { listTomes, createTome, deleteTome, type Tome } from "@/lib/sage-api";

interface TomeListProps {
  activeTomeId?: string;
  onSelectTome: (tome: Tome | null) => void;
}

export function TomeList({ activeTomeId, onSelectTome }: TomeListProps) {
  const [tomes, setTomes] = useState<Tome[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadTomes = useCallback(async () => {
    try {
      const data = await listTomes();
      setTomes(data);
    } catch (err) {
      console.error("Failed to load tomes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTomes();
  }, [loadTomes]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const tome = await createTome(newName.trim(), newDesc.trim());
      setTomes((prev) => [tome, ...prev]);
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      onSelectTome(tome);
    } catch (err) {
      console.error("Failed to create tome:", err);
    }
  };

  const handleDelete = async (tomeId: string) => {
    try {
      await deleteTome(tomeId);
      setTomes((prev) => prev.filter((t) => t.id !== tomeId));
      if (activeTomeId === tomeId) {
        onSelectTome(null);
      }
    } catch (err) {
      console.error("Failed to delete tome:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-on-surface-variant text-body-md">Loading tomes...</div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-headline-sm text-on-surface">Tomes</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-label-sm text-primary hover:text-primary-container transition-colors"
        >
          {showCreate ? "Cancel" : "+ New Tome"}
        </button>
      </div>

      {showCreate && (
        <div className="flex flex-col gap-2 p-3 rounded-md bg-surface-container-high">
          <input
            type="text"
            placeholder="Tome name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="bg-surface-container-highest text-on-surface text-body-md px-3 py-2 rounded-sm placeholder:text-on-surface-variant/60"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="bg-surface-container-highest text-on-surface text-body-md px-3 py-2 rounded-sm placeholder:text-on-surface-variant/60"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="bg-primary-container text-on-primary-container text-label-sm py-2 rounded-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Create Tome
          </button>
        </div>
      )}

      {tomes.length === 0 ? (
        <p className="text-on-surface-variant text-body-md py-4">
          No tomes yet. Create one to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {tomes.map((tome) => (
            <button
              key={tome.id}
              onClick={() => onSelectTome(tome)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-sm text-left transition-colors ${
                activeTomeId === tome.id
                  ? "bg-surface-container-highest text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-body-md truncate">{tome.name}</span>
                {tome.description && (
                  <span className="text-label-sm text-on-surface-variant/60 truncate">
                    {tome.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-label-sm text-on-surface-variant/40">
                  {tome.source_count} src{tome.source_count !== 1 ? "s" : ""}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(tome.id);
                  }}
                  className="text-label-sm text-error/60 hover:text-error cursor-pointer"
                >
                  ✕
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
