from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Optional

from .models import Document, Chunk, Collection, Session, Message

DEFAULT_DB_PATH = Path.home() / ".sage" / "knowledge.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT,
    source_id TEXT,
    doc_type TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding BLOB,
    metadata TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_docs (
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, document_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    collection_id TEXT REFERENCES collections(id),
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
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(SCHEMA)
        self.conn.commit()

    def add_document(self, doc: Document) -> Document:
        self.conn.execute(
            "INSERT INTO documents (id,title,source,source_id,doc_type,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
            (doc.id, doc.title, doc.source, doc.source_id, doc.doc_type,
             json.dumps(doc.metadata), doc.created_at, doc.updated_at),
        )
        self.conn.commit()
        return doc

    def get_document(self, doc_id: str) -> Optional[Document]:
        row = self.conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        if not row:
            return None
        return Document(id=row["id"], title=row["title"], source=row["source"],
                        source_id=row["source_id"], doc_type=row["doc_type"],
                        metadata=json.loads(row["metadata"]),
                        created_at=row["created_at"], updated_at=row["updated_at"])

    def list_documents(self, limit: int = 100, offset: int = 0) -> list[Document]:
        rows = self.conn.execute(
            "SELECT * FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)).fetchall()
        return [Document(id=r["id"], title=r["title"], source=r["source"],
                         source_id=r["source_id"], doc_type=r["doc_type"],
                         metadata=json.loads(r["metadata"]),
                         created_at=r["created_at"], updated_at=r["updated_at"])
                for r in rows]

    def delete_document(self, doc_id: str) -> bool:
        cur = self.conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        self.conn.commit()
        return cur.rowcount > 0

    def add_chunks(self, chunks: list[Chunk]) -> None:
        self.conn.executemany(
            "INSERT INTO chunks (id,document_id,chunk_index,content,embedding,metadata) VALUES (?,?,?,?,?,?)",
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

    def create_collection(self, name: str, description: str = "") -> Collection:
        col = Collection(name=name, description=description)
        self.conn.execute(
            "INSERT INTO collections (id,name,description,created_at) VALUES (?,?,?,?)",
            (col.id, col.name, col.description, col.created_at))
        self.conn.commit()
        return col

    def add_to_collection(self, collection_id: str, document_id: str) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO collection_docs (collection_id,document_id) VALUES (?,?)",
            (collection_id, document_id))
        self.conn.commit()

    def get_collection_docs(self, collection_id: str) -> list[Document]:
        rows = self.conn.execute(
            """SELECT d.* FROM documents d JOIN collection_docs cd ON d.id=cd.document_id
               WHERE cd.collection_id=? ORDER BY d.created_at DESC""",
            (collection_id,)).fetchall()
        return [Document(id=r["id"], title=r["title"], source=r["source"],
                         source_id=r["source_id"], doc_type=r["doc_type"],
                         metadata=json.loads(r["metadata"]),
                         created_at=r["created_at"], updated_at=r["updated_at"])
                for r in rows]

    def create_session(self, provider: str, model: str,
                       collection_id: Optional[str] = None) -> Session:
        s = Session(provider=provider, model=model, collection_id=collection_id)
        self.conn.execute(
            "INSERT INTO sessions (id,collection_id,provider,model,created_at) VALUES (?,?,?,?,?)",
            (s.id, s.collection_id, s.provider, s.model, s.created_at))
        self.conn.commit()
        return s

    def add_message(self, message: Message) -> Message:
        tc = json.dumps(message.tool_calls) if message.tool_calls else None
        self.conn.execute(
            "INSERT INTO messages (id,session_id,role,content,tool_calls,created_at) VALUES (?,?,?,?,?,?)",
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
