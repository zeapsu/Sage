"""Data models for the Sage knowledge store."""
from __future__ import annotations
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


def new_id() -> str:
    return str(uuid.uuid4())


@dataclass
class Document:
    id: str = field(default_factory=new_id)
    title: str = ""
    source: str = ""           # 'arxiv', 'upload', 'url', 'obsidian'
    source_id: str = ""        # arXiv ID, file path, URL
    doc_type: str = ""         # 'pdf', 'markdown', 'web', 'note'
    content_hash: str = ""     # SHA-256 of file content for dedup
    metadata: dict = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Chunk:
    id: str = field(default_factory=new_id)
    document_id: str = ""
    chunk_index: int = 0
    content: str = ""
    embedding: Optional[bytes] = None
    metadata: dict = field(default_factory=dict)


@dataclass
class Tome:
    id: str = field(default_factory=new_id)
    name: str = ""
    description: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Session:
    id: str = field(default_factory=new_id)
    tome_id: Optional[str] = None
    provider: str = ""
    model: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Message:
    id: str = field(default_factory=new_id)
    session_id: str = ""
    role: str = ""
    content: str = ""
    tool_calls: Optional[list] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
