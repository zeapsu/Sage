"""SQLite knowledge store for Sage — Tomes, documents, chunks, sessions."""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Optional

from .models import Document, Chunk, Tome, Session, Message

DEFAULT_DB_PATH = Path.home() / ".sage" / "knowledge.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT,
    source_id TEXT,
    doc_type TEXT,
    content_hash TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

CREATE TABLE IF NOT EXISTS tomes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tome_sources (
    tome_id TEXT NOT NULL REFERENCES tomes(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (tome_id, document_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tome_id TEXT REFERENCES tomes(id),
    provider TEXT,
    model TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
"""


class KnowledgeStore:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DEFAULT_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def _row_to_doc(self, row) -> Document:
        return Document(
            id=row["id"], title=row["title"], source=row["source"],
            source_id=row["source_id"], doc_type=row["doc_type"],
            content_hash=row["content_hash"] or "",
            metadata=json.loads(row["metadata"]),
            created_at=row["created_at"], updated_at=row["updated_at"],
        )

    # ── Documents ──────────────────────────────────────────────

    def add_document(self, doc: Document) -> Document:
        self.conn.execute(
            """INSERT INTO documents
               (id, title, source, source_id, doc_type, content_hash, metadata, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (doc.id, doc.title, doc.source, doc.source_id, doc.doc_type,
             doc.content_hash, json.dumps(doc.metadata), doc.created_at, doc.updated_at),
        )
        self.conn.commit()
        return doc

    def get_document(self, doc_id: str) -> Optional[Document]:
        row = self.conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        return self._row_to_doc(row) if row else None

    def get_document_by_hash(self, content_hash: str) -> Optional[Document]:
        """Find an existing document by its content hash (for dedup)."""
        row = self.conn.execute(
            "SELECT * FROM documents WHERE content_hash=?", (content_hash,)
        ).fetchone()
        return self._row_to_doc(row) if row else None

    def list_documents(self, limit: int = 100, offset: int = 0) -> list[Document]:
        rows = self.conn.execute(
            "SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)).fetchall()
        return [self._row_to_doc(r) for r in rows]

    def delete_document(self, doc_id: str) -> bool:
        cur = self.conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        self.conn.commit()
        return cur.rowcount > 0

    # ── Chunks ─────────────────────────────────────────────────

    def add_chunks(self, chunks: list[Chunk]) -> None:
        self.conn.executemany(
            "INSERT INTO chunks (id, document_id, chunk_index, content, embedding, metadata) VALUES (?,?,?,?,?,?)",
            [(c.id, c.document_id, c.chunk_index, c.content, c.embedding,
              json.dumps(c.metadata)) for c in chunks])
        self.conn.commit()

    def get_chunks(self, document_id: str) -> list[Chunk]:
        rows = self.conn.execute(
            "SELECT * FROM chunks WHERE document_id=? ORDER BY chunk_index",
            (document_id,)).fetchall()
        return [Chunk(id=r["id"], document_id=r["document_id"],
                      chunk_index=r["chunk_index"], content=r["content"],
                      embedding=r["embedding"], metadata=json.loads(r["metadata"]))
                for r in rows]

    def get_all_chunks_with_embeddings(self) -> list[Chunk]:
        rows = self.conn.execute("SELECT * FROM chunks WHERE embedding IS NOT NULL").fetchall()
        return [Chunk(id=r["id"], document_id=r["document_id"],
                      chunk_index=r["chunk_index"], content=r["content"],
                      embedding=r["embedding"], metadata=json.loads(r["metadata"]))
                for r in rows]

    # ── Tomes ──────────────────────────────────────────────────

    def create_tome(self, name: str, description: str = "") -> Tome:
        tome = Tome(name=name, description=description)
        self.conn.execute(
            "INSERT INTO tomes (id, name, description, created_at) VALUES (?,?,?,?)",
            (tome.id, tome.name, tome.description, tome.created_at))
        self.conn.commit()
        return tome

    def get_tome(self, tome_id: str) -> Optional[Tome]:
        row = self.conn.execute("SELECT * FROM tomes WHERE id=?", (tome_id,)).fetchone()
        if not row:
            return None
        return Tome(id=row["id"], name=row["name"], description=row["description"],
                    created_at=row["created_at"])

    def list_tomes(self) -> list[Tome]:
        rows = self.conn.execute("SELECT * FROM tomes ORDER BY created_at DESC").fetchall()
        return [Tome(id=r["id"], name=r["name"], description=r["description"],
                     created_at=r["created_at"]) for r in rows]

    def delete_tome(self, tome_id: str) -> bool:
        cur = self.conn.execute("DELETE FROM tomes WHERE id=?", (tome_id,))
        self.conn.commit()
        return cur.rowcount > 0

    # ── Tome ↔ Source linking ─────────────────────────────────

    def link_to_tome(self, tome_id: str, document_id: str) -> None:
        """Link an existing document to a tome (no-op if already linked)."""
        self.conn.execute(
            "INSERT OR IGNORE INTO tome_sources (tome_id, document_id) VALUES (?,?)",
            (tome_id, document_id))
        self.conn.commit()

    def unlink_from_tome(self, tome_id: str, document_id: str) -> None:
        """Remove a document from a tome (does NOT delete the document)."""
        self.conn.execute(
            "DELETE FROM tome_sources WHERE tome_id=? AND document_id=?",
            (tome_id, document_id))
        self.conn.commit()

    def get_tome_documents(self, tome_id: str) -> list[Document]:
        """Get all documents linked to a tome."""
        rows = self.conn.execute(
            """SELECT d.* FROM documents d
               JOIN tome_sources ts ON d.id = ts.document_id
               WHERE ts.tome_id = ?
               ORDER BY d.created_at DESC""",
            (tome_id,)).fetchall()
        return [self._row_to_doc(r) for r in rows]

    def get_tome_document_ids(self, tome_id: str) -> list[str]:
        """Get just the document IDs for a tome (for vector search filtering)."""
        rows = self.conn.execute(
            "SELECT document_id FROM tome_sources WHERE tome_id=?",
            (tome_id,)).fetchall()
        return [r["document_id"] for r in rows]

    def get_document_tomes(self, document_id: str) -> list[Tome]:
        """Get all tomes that contain a given document."""
        rows = self.conn.execute(
            """SELECT t.* FROM tomes t
               JOIN tome_sources ts ON t.id = ts.tome_id
               WHERE ts.document_id = ?
               ORDER BY t.created_at DESC""",
            (document_id,)).fetchall()
        return [Tome(id=r["id"], name=r["name"], description=r["description"],
                     created_at=r["created_at"]) for r in rows]

    # ── Sessions ───────────────────────────────────────────────

    def create_session(self, provider: str, model: str,
                       tome_id: Optional[str] = None) -> Session:
        s = Session(provider=provider, model=model, tome_id=tome_id)
        self.conn.execute(
            "INSERT INTO sessions (id, tome_id, provider, model, created_at) VALUES (?,?,?,?,?)",
            (s.id, s.tome_id, s.provider, s.model, s.created_at))
        self.conn.commit()
        return s

    def get_tome_session(self, tome_id: str) -> Optional[Session]:
        """Get the most recent session for a tome."""
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE tome_id=? ORDER BY created_at DESC LIMIT 1",
            (tome_id,)).fetchone()
        if not row:
            return None
        return Session(id=row["id"], tome_id=row["tome_id"],
                       provider=row["provider"], model=row["model"],
                       created_at=row["created_at"])

    # ── Messages ───────────────────────────────────────────────

    def add_message(self, message: Message) -> Message:
        tc = json.dumps(message.tool_calls) if message.tool_calls else None
        self.conn.execute(
            "INSERT INTO messages (id, session_id, role, content, tool_calls, created_at) VALUES (?,?,?,?,?,?)",
            (message.id, message.session_id, message.role, message.content, tc, message.created_at))
        self.conn.commit()
        return message

    def get_session_messages(self, session_id: str) -> list[Message]:
        rows = self.conn.execute(
            "SELECT * FROM messages WHERE session_id=? ORDER BY created_at",
            (session_id,)).fetchall()
        return [Message(id=r["id"], session_id=r["session_id"], role=r["role"],
                        content=r["content"],
                        tool_calls=json.loads(r["tool_calls"]) if r["tool_calls"] else None,
                        created_at=r["created_at"])
                for r in rows]

    def close(self):
        self.conn.close()
