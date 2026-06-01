# Sage — Phase 1 Implementation Plan

> **Goal:** Build the foundation: SQLite knowledge store, provider abstraction, agent orchestrator, skill registry, embeddings, and the floating window shell.

> **Status note (May 2026):** Historical implementation plan. The current branch should treat README and [`../agents/handoff.md`](../agents/handoff.md) as product truth. Do not replay these steps blindly; many files already exist and Tome Home is now the default UI.

> **For:** Claude Code, Codex, or any coding agent. Follow tasks sequentially. Each task is 2-5 minutes.

> **Read first:** [`../product/vision.md`](../product/vision.md), [`../design/ethereal-console.md`](../design/ethereal-console.md) — architecture direction and design spec.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Tauri v2 |
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |
| Animations | Framer Motion |
| Components | shadcn/ui (copy-paste, Tailwind-native) |
| Backend | FastAPI (Python 3.11) |
| DB | SQLite (stdlib, no extra dep) |
| Embeddings | sentence-transformers (local, all-MiniLM-L6-v2, ~80MB) |
| Providers | OpenAI, Anthropic, Ollama (OpenAI-compatible) |

---

## Prerequisites

```bash
# Backend
pip install sentence-transformers aiohttp pyyaml

# Frontend  
cd frontend && npm install framer-motion zustand clsx tailwind-merge
```

---

## Task 1: SQLite Knowledge Store

**Objective:** Create the SQLite database schema and data access layer.

**Files:**
- Create: `backend/store/__init__.py`
- Create: `backend/store/models.py`
- Create: `backend/store/db.py`

### Step 1: Create store package

```bash
mkdir -p ~/Projects/Sage/backend/store
touch ~/Projects/Sage/backend/store/__init__.py
```

### Step 2: Write `backend/store/models.py`

```python
"""Data models for the knowledge store."""
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
    source: str = ""
    source_id: str = ""
    doc_type: str = ""
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
class Collection:
    id: str = field(default_factory=new_id)
    name: str = ""
    description: str = ""
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Session:
    id: str = field(default_factory=new_id)
    collection_id: Optional[str] = None
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
```

### Step 3: Write `backend/store/db.py`

```python
"""SQLite knowledge store."""
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
```

### Step 4: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.store.db import KnowledgeStore
from backend.store.models import Document, Chunk
store = KnowledgeStore()
doc = store.add_document(Document(title='Test', source='test', doc_type='text'))
print(f'Created doc: {doc.id}')
store.add_chunks([Chunk(document_id=doc.id, chunk_index=0, content='hello world')])
chunks = store.get_chunks(doc.id)
print(f'Chunks: {len(chunks)}, content: {chunks[0].content}')
docs = store.list_documents()
print(f'Total docs: {len(docs)}')
store.delete_document(doc.id)
print('Deleted. All good!')
store.close()
"
```

Expected: `Created doc: ... Chunks: 1, content: hello world Total docs: 1 Deleted. All good!`

### Step 5: Commit

```bash
cd ~/Projects/Sage
git add backend/store/
git commit -m "feat: SQLite knowledge store (documents, chunks, collections, sessions)"
```

---

## Task 2: Design Tokens — Tailwind Config

**Objective:** Replace the generic Tailwind config with the Sage "Ethereal Console" design tokens from [`../design/ethereal-console.md`](../design/ethereal-console.md).

**Files:**
- Modify: `frontend/tailwind.config.js` (full rewrite)
- Modify: `frontend/src/app/globals.css` (full rewrite)

### Step 1: Rewrite `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces (depth hierarchy)
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        surface: "#131313",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "surface-bright": "#3a3939",
        "surface-dim": "#131313",
        "surface-tint": "#adc6ff",

        // Primary
        primary: "#adc6ff",
        "primary-container": "#4d8eff",
        "on-primary": "#002e6a",
        "on-primary-container": "#00285d",
        "primary-fixed": "#d8e2ff",
        "primary-fixed-dim": "#adc6ff",

        // Text
        "on-surface": "#e5e2e1",
        "on-surface-variant": "#c2c6d6",

        // Borders
        outline: "#8c909f",
        "outline-variant": "#424754",

        // Semantic
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        tertiary: "#ffb786",
        "tertiary-container": "#df7412",
        "on-tertiary": "#502400",
        "on-tertiary-container": "#461f00",

        // Secondary
        secondary: "#c8c6c5",
        "secondary-container": "#474746",
        "on-secondary": "#303030",
        "on-secondary-container": "#b7b5b4",
      },
      borderRadius: {
        DEFAULT: "1rem",
        sm: "0.5rem",
        md: "1rem",
        lg: "2rem",
        xl: "3rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "headline-sm": ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        "title-md": ["1.125rem", { lineHeight: "1.4" }],
        "body-md": ["0.875rem", { lineHeight: "1.5" }],
        "label-sm": ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.05em" }],
      },
    },
  },
  plugins: [],
};
```

### Step 2: Rewrite `frontend/src/app/globals.css`

```css
@import "tailwindcss";

@layer base {
  :root {
    --background: #0e0e0e;
    --foreground: #e5e2e1;
  }

  body {
    background: var(--background);
    color: var(--foreground);
    font-family: "Inter", system-ui, sans-serif;
  }

  /* No focus outlines on inputs (ethereal look) */
  input:focus {
    outline: none !important;
    box-shadow: none !important;
  }

  /* Ambient glow behind floating bar */
  .ambient-glow {
    position: absolute;
    top: 20%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    height: 100px;
    background: radial-gradient(
      ellipse at center,
      rgba(173, 198, 255, 0.08) 0%,
      rgba(13, 13, 13, 0) 70%
    );
    filter: blur(40px);
    pointer-events: none;
    z-index: 0;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #424754;
    border-radius: 9999px;
  }
}
```

### Step 3: Verify

```bash
cd ~/Projects/Sage/frontend && npm run build 2>&1 | tail -5
```

Expected: Build succeeds (or at least no Tailwind config errors).

### Step 4: Commit

```bash
cd ~/Projects/Sage
git add frontend/tailwind.config.js frontend/src/app/globals.css
git commit -m "feat: add Sage design tokens (Ethereal Console palette)"
```

---

## Task 3: Config System

**Objective:** Create `~/.sage/config.yaml` loader for providers, TTS, and store settings.

**Files:**
- Create: `backend/config.py`

### Step 1: Write `backend/config.py`

```python
"""Sage configuration — loads from ~/.sage/config.yaml with env var overrides."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Optional

import yaml

DEFAULT_CONFIG_PATH = Path.home() / ".sage" / "config.yaml"

DEFAULT_CONFIG = {
    "providers": {
        "default": "ollama",
        "ollama": {
            "base_url": "http://localhost:11434",
            "default_model": "llama3.1:8b",
        },
        "openai": {
            "api_key": "${OPENAI_API_KEY}",
            "default_model": "gpt-4o-mini",
        },
        "anthropic": {
            "api_key": "${ANTHROPIC_API_KEY}",
            "default_model": "claude-sonnet-4-20250514",
        },
    },
    "knowledge_store": {
        "path": "~/.sage/knowledge.db",
    },
    "embeddings": {
        "model": "all-MiniLM-L6-v2",
        "device": "cpu",
    },
    "tts": {
        "engine": "piper",
        "default_voice": "en_US-lessac-medium",
    },
    "obsidian": {
        "vault_path": "",
        "sync_interval": 300,
    },
    "ui": {
        "hotkey": "CommandOrControl+Shift+S",
    },
}


def _resolve_env_vars(value: Any) -> Any:
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        env_name = value[2:-1]
        return os.getenv(env_name, "")
    return value


def _resolve_env_recursive(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _resolve_env_recursive(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_resolve_env_recursive(v) for v in obj]
    return _resolve_env_vars(obj)


class SageConfig:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self._raw: dict = {}
        self._load()

    def _load(self):
        if self.config_path.exists():
            with open(self.config_path) as f:
                self._raw = yaml.safe_load(f) or {}
        else:
            self._raw = {}

        # Deep merge defaults with loaded config
        self._config = self._deep_merge(DEFAULT_CONFIG, self._raw)
        self._config = _resolve_env_recursive(self._config)

    def _deep_merge(self, base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get(self, dotpath: str, default: Any = None) -> Any:
        keys = dotpath.split(".")
        node = self._config
        for key in keys:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                return default
        return node

    def provider_config(self, name: Optional[str] = None) -> dict:
        name = name or self.get("providers.default", "ollama")
        return self.get(f"providers.{name}", {})

    @property
    def db_path(self) -> Path:
        return Path(os.path.expanduser(self.get("knowledge_store.path", "~/.sage/knowledge.db")))

    def save(self):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            yaml.dump(self._raw or DEFAULT_CONFIG, f, default_flow_style=False, sort_keys=False)

    def ensure_default_config(self):
        if not self.config_path.exists():
            self.save()
```

### Step 2: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.config import SageConfig
cfg = SageConfig()
print(f'Default provider: {cfg.get("providers.default")}')
print(f'Ollama URL: {cfg.get("providers.ollama.base_url")}')
print(f'DB path: {cfg.db_path}')
print('Config OK')
"
```

Expected: `Default provider: ollama
Ollama URL: http://localhost:11434
DB path: /home/zeapsu/.sage/knowledge.db
Config OK`

### Step 3: Commit

```bash
cd ~/Projects/Sage
git add backend/config.py
git commit -m "feat: add Sage config system (YAML + env var resolution)"
```


---

## Task 4: Provider Abstraction Layer

**Objective:** Create a pluggable provider interface that supports OpenAI, Anthropic, and Ollama with unified tool-calling.

**Files:**
- Create: `backend/providers/__init__.py`
- Create: `backend/providers/base.py`
- Create: `backend/providers/openai_provider.py`
- Create: `backend/providers/ollama_provider.py`
- Create: `backend/providers/anthropic_provider.py`
- Create: `backend/providers/factory.py`

### Step 1: Create providers package

```bash
mkdir -p ~/Projects/Sage/backend/providers
touch ~/Projects/Sage/backend/providers/__init__.py
```

### Step 2: Write `backend/providers/base.py`

```python
"""Abstract provider interface for LLM backends."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict  # JSON Schema


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class Message:
    role: str  # 'user', 'assistant', 'tool'
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: Optional[str] = None


@dataclass
class AgentResponse:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = ""  # 'stop', 'tool_calls', 'length'


class AgentProvider(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        ...

    @abstractmethod
    def list_models(self) -> list[str]:
        ...
```

### Step 3: Write `backend/providers/openai_provider.py`

```python
"""OpenAI provider — also works with any OpenAI-compatible API (DeepSeek, etc.)."""
from __future__ import annotations
import os
from typing import AsyncIterator, Optional

from openai import AsyncOpenAI

from .base import AgentProvider, AgentResponse, Message, ToolCall, ToolDefinition


class OpenAIProvider(AgentProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=base_url,
        )

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        oai_messages = [
            {"role": m.role, "content": m.content}
            + ({"tool_calls": [{"id": tc.id, "type": "function",
                                "function": {"name": tc.name, "arguments": __import__("json").dumps(tc.arguments)}}
                               for tc in m.tool_calls]} if m.tool_calls else {})
            + ({"tool_call_id": m.tool_call_id} if m.tool_call_id else {})
            for m in messages
        ]

        oai_tools = [
            {"type": "function", "function": {
                "name": t.name, "description": t.description, "parameters": t.parameters
            }}
            for t in tools
        ] if tools else None

        if stream:
            return self._stream_chat(oai_messages, oai_tools, model, **kwargs)

        response = await self.client.chat.completions.create(
            model=model, messages=oai_messages, tools=oai_tools, **kwargs,
        )
        choice = response.choices[0]
        tool_calls = []
        if choice.message.tool_calls:
            import json
            for tc in choice.message.tool_calls:
                tool_calls.append(ToolCall(
                    id=tc.id, name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                ))
        return AgentResponse(
            content=choice.message.content or "",
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
        )

    async def _stream_chat(self, messages, tools, model, **kwargs) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=model, messages=messages, tools=tools, stream=True, **kwargs,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def list_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "o3-mini"]
```

### Step 4: Write `backend/providers/ollama_provider.py`

```python
"""Ollama provider — uses the Ollama OpenAI-compatible API."""
from __future__ import annotations
from typing import AsyncIterator, Optional

from .openai_provider import OpenAIProvider


class OllamaProvider(OpenAIProvider):
    def __init__(self, base_url: str = "http://localhost:11434", api_key: str = "ollama"):
        super().__init__(api_key=api_key, base_url=f"{base_url}/v1")

    def list_models(self) -> list[str]:
        # Could dynamically query /api/tags, but static is fine for now
        return ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "mistral:7b", "deepseek-r1:8b"]
```

### Step 5: Write `backend/providers/anthropic_provider.py`

```python
"""Anthropic provider for Claude models."""
from __future__ import annotations
import json
import os
from typing import AsyncIterator, Optional

import httpx

from .base import AgentProvider, AgentResponse, Message, ToolCall, ToolDefinition


class AnthropicProvider(AgentProvider):
    BASE_URL = "https://api.anthropic.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        # Convert to Anthropic format
        system = ""
        anth_messages = []
        for m in messages:
            if m.role == "system":
                system = m.content
            elif m.role == "tool":
                anth_messages.append({
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": m.tool_call_id, "content": m.content}],
                })
            elif m.role == "assistant" and m.tool_calls:
                content = []
                if m.content:
                    content.append({"type": "text", "text": m.content})
                for tc in m.tool_calls:
                    content.append({"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.arguments})
                anth_messages.append({"role": "assistant", "content": content})
            else:
                anth_messages.append({"role": m.role, "content": m.content})

        anth_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.parameters}
            for t in tools
        ] if tools else None

        body = {"model": model, "max_tokens": kwargs.get("max_tokens", 4096), "messages": anth_messages}
        if system:
            body["system"] = system
        if anth_tools:
            body["tools"] = anth_tools

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.BASE_URL}/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json=body,
                timeout=120,
            )
            data = resp.json()

        content = ""
        tool_calls = []
        for block in data.get("content", []):
            if block["type"] == "text":
                content += block["text"]
            elif block["type"] == "tool_use":
                tool_calls.append(ToolCall(id=block["id"], name=block["name"], arguments=block["input"]))

        return AgentResponse(content=content, tool_calls=tool_calls, finish_reason=data.get("stop_reason", ""))

    def list_models(self) -> list[str]:
        return ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-35-20241022"]
```

### Step 6: Write `backend/providers/factory.py`

```python
"""Provider factory — create provider instances from config."""
from __future__ import annotations
from typing import Optional

from .base import AgentProvider
from .openai_provider import OpenAIProvider
from .ollama_provider import OllamaProvider
from .anthropic_provider import AnthropicProvider


def create_provider(name: str, config: dict) -> AgentProvider:
    if name == "openai" or name == "deepseek":
        return OpenAIProvider(
            api_key=config.get("api_key", ""),
            base_url=config.get("base_url"),
        )
    elif name == "ollama":
        return OllamaProvider(
            base_url=config.get("base_url", "http://localhost:11434"),
        )
    elif name == "anthropic":
        return AnthropicProvider(
            api_key=config.get("api_key", ""),
        )
    else:
        raise ValueError(f"Unknown provider: {name}")
```

### Step 7: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.providers.factory import create_provider
p = create_provider('ollama', {'base_url': 'http://localhost:11434'})
print(f'Ollama provider: {type(p).__name__}, models: {p.list_models()[:2]}')
p2 = create_provider('openai', {'api_key': 'test'})
print(f'OpenAI provider: {type(p2).__name__}')
p3 = create_provider('anthropic', {'api_key': 'test'})
print(f'Anthropic provider: {type(p3).__name__}')
print('Providers OK')
"
```

### Step 8: Commit

```bash
cd ~/Projects/Sage
git add backend/providers/
git commit -m "feat: add provider abstraction (OpenAI, Ollama, Anthropic)"
```

---

## Task 5: Skill Registry

**Objective:** Create the skill/tool registration system that exposes tools to the agent.

**Files:**
- Create: `backend/skills/__init__.py`
- Create: `backend/skills/base.py`
- Create: `backend/skills/registry.py`
- Create: `backend/skills/search_docs.py`
- Create: `backend/skills/read_document.py`

### Step 1: Create skills package

```bash
mkdir -p ~/Projects/Sage/backend/skills
touch ~/Projects/Sage/backend/skills/__init__.py
```

### Step 2: Write `backend/skills/base.py`

```python
"""Skill base classes and context."""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from backend.store.db import KnowledgeStore
from backend.providers.base import AgentProvider, ToolDefinition


@dataclass
class SkillResult:
    content: str = ""
    ui_component: Optional[str] = None  # e.g., "QuizWidget", "AudioPlayer"
    data: dict = field(default_factory=dict)  # structured data for UI


@dataclass
class SkillContext:
    store: KnowledgeStore
    provider: AgentProvider
    workspace: Path  # ~/.sage/workspace/
    config: Any  # SageConfig


class Skill(ABC):
    @property
    @abstractmethod
    def definition(self) -> ToolDefinition:
        ...

    @abstractmethod
    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        ...
```

### Step 3: Write `backend/skills/registry.py`

```python
"""Skill registry — manages available tools for the agent."""
from __future__ import annotations
from typing import Optional

from .base import Skill, SkillContext, SkillResult
from backend.providers.base import ToolDefinition


class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill):
        self._skills[skill.definition.name] = skill

    def get_tool_definitions(self) -> list[ToolDefinition]:
        return [s.definition for s in self._skills.values()]

    async def execute(self, name: str, params: dict, context: SkillContext) -> SkillResult:
        skill = self._skills.get(name)
        if not skill:
            return SkillResult(content=f"Error: Unknown skill '{name}'")
        return await skill.execute(params, context)

    def list_skills(self) -> list[str]:
        return list(self._skills.keys())
```

### Step 4: Write `backend/skills/search_docs.py`

```python
"""Search documents in the knowledge store by semantic similarity."""
from __future__ import annotations
import json
import numpy as np

from .base import Skill, SkillContext, SkillResult
from backend.providers.base import ToolDefinition


class SearchDocsSkill(Skill):
    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_docs",
            description="Search the knowledge base for relevant documents using semantic similarity. Returns the most relevant text chunks with source citations.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant content",
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum number of results to return",
                    },
                },
                "required": ["query"],
            },
        )

    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        from backend.embeddings import get_embedder

        query = params["query"]
        max_results = params.get("max_results", 5)

        embedder = get_embedder()
        query_embedding = embedder.embed_query(query)

        # Get all chunks with embeddings
        chunks = context.store.get_all_chunks_with_embeddings()
        if not chunks:
            return SkillResult(content="No documents in knowledge base yet. Add documents first.")

        # Cosine similarity
        results = []
        for chunk in chunks:
            chunk_emb = np.frombuffer(chunk.embedding, dtype=np.float32)
            similarity = float(np.dot(query_embedding, chunk_emb) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(chunk_emb) + 1e-8
            ))
            doc = context.store.get_document(chunk.document_id)
            results.append({
                "similarity": similarity,
                "content": chunk.content,
                "document_id": chunk.document_id,
                "document_title": doc.title if doc else "Unknown",
                "chunk_index": chunk.chunk_index,
            })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        top = results[:max_results]

        # Format for agent
        lines = []
        for i, r in enumerate(top, 1):
            lines.append(f"[{i}] "{r['document_title']}" (chunk {r['chunk_index']}, similarity: {r['similarity']:.3f})\n{r['content']}\n")

        return SkillResult(
            content="\n".join(lines),
            data={"results": top},
        )
```

### Step 5: Write `backend/skills/read_document.py`

```python
"""Read full document content by ID."""
from __future__ import annotations

from .base import Skill, SkillContext, SkillResult
from backend.providers.base import ToolDefinition


class ReadDocumentSkill(Skill):
    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="read_document",
            description="Read the full content of a document from the knowledge base by its ID.",
            parameters={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "The document ID to read",
                    },
                },
                "required": ["document_id"],
            },
        )

    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        doc_id = params["document_id"]
        doc = context.store.get_document(doc_id)
        if not doc:
            return SkillResult(content=f"Document not found: {doc_id}")

        chunks = context.store.get_chunks(doc_id)
        full_text = "\n\n".join(c.content for c in chunks) if chunks else "[No content chunks]"

        return SkillResult(
            content=f"# {doc.title}\n\nSource: {doc.source} ({doc.source_id})\nType: {doc.doc_type}\n\n---\n\n{full_text}",
            data={"document_id": doc_id, "title": doc.title, "source": doc.source},
        )
```

### Step 6: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.skills.registry import SkillRegistry
from backend.skills.search_docs import SearchDocsSkill
from backend.skills.read_document import ReadDocumentSkill
reg = SkillRegistry()
reg.register(SearchDocsSkill())
reg.register(ReadDocumentSkill())
defs = reg.get_tool_definitions()
print(f'Registered skills: {[d.name for d in defs]}')
print(f'Tool def: {defs[0].name} - {defs[0].description[:50]}...')
"
```

### Step 7: Commit

```bash
cd ~/Projects/Sage
git add backend/skills/
git commit -m "feat: add skill registry with search_docs and read_document"
```

---

## Task 6: Embedding Pipeline

**Objective:** Add local embedding generation using sentence-transformers.

**Files:**
- Create: `backend/embeddings.py`

### Step 1: Write `backend/embeddings.py`

```python
"""Local embedding pipeline using sentence-transformers."""
from __future__ import annotations
from typing import Optional
import numpy as np

_model = None


def get_embedder(model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(model_name, device=device)
    return Embedder(_model)


class Embedder:
    def __init__(self, model):
        self.model = model

    def embed_query(self, text: str) -> np.ndarray:
        return self.model.encode(text, normalize_embeddings=True)

    def embed_chunks(self, texts: list[str]) -> list[np.ndarray]:
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
        return [np.array(e, dtype=np.float32) for e in embeddings]


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start = end - overlap
        if start < 0:
            start = 0
    return chunks
```

### Step 2: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.embeddings import chunk_text
chunks = chunk_text(' '.join(['word'] * 1000), chunk_size=200, overlap=20)
print(f'1000 words -> {len(chunks)} chunks, first={len(chunks[0].split())} words')
# Don't import sentence-transformers yet (not installed), just test chunking
"
```

Expected: `1000 words -> 6 chunks, first=200 words`

### Step 3: Commit

```bash
cd ~/Projects/Sage
git add backend/embeddings.py
git commit -m "feat: add local embedding pipeline (sentence-transformers)"
```

---

## Task 7: Agent Orchestrator

**Objective:** Build the tool-calling loop that connects providers, skills, and the knowledge store.

**Files:**
- Create: `backend/orchestrator.py`

### Step 1: Write `backend/orchestrator.py`

```python
"""Agent orchestrator — manages the tool-calling conversation loop."""
from __future__ import annotations
import json
import logging
from typing import AsyncIterator, Optional

from backend.providers.base import AgentProvider, AgentResponse, Message, ToolCall, ToolDefinition
from backend.skills.registry import SkillRegistry
from backend.skills.base import SkillContext, SkillResult
from backend.store.db import KnowledgeStore
from backend.store.models import Message as DBMessage

logger = logging.getLogger("sage.orchestrator")


class AgentOrchestrator:
    def __init__(
        self,
        provider: AgentProvider,
        model: str,
        store: KnowledgeStore,
        skills: SkillRegistry,
        skill_context: SkillContext,
        max_tool_rounds: int = 10,
    ):
        self.provider = provider
        self.model = model
        self.store = store
        self.skills = skills
        self.skill_context = skill_context
        self.max_tool_rounds = max_tool_rounds

    async def run(self, messages: list[Message]) -> str:
        """Run the agent loop until the model stops calling tools."""
        tool_defs = self.skills.get_tool_definitions()
        conversation = list(messages)

        for round_num in range(self.max_tool_rounds):
            response = await self.provider.chat(
                messages=conversation,
                tools=tool_defs,
                model=self.model,
            )

            # Add assistant message to conversation
            conversation.append(Message(
                role="assistant",
                content=response.content,
                tool_calls=response.tool_calls,
            ))

            if response.finish_reason == "stop" or not response.tool_calls:
                return response.content

            # Execute tool calls
            for tc in response.tool_calls:
                logger.info(f"Executing tool: {tc.name} with args: {tc.arguments}")
                result = await self.skills.execute(tc.name, tc.arguments, self.skill_context)
                conversation.append(Message(
                    role="tool",
                    content=result.content,
                    tool_call_id=tc.id,
                ))

        return "Maximum tool rounds reached. Here's what I have so far:\n" + conversation[-1].content

    async def run_streaming(self, messages: list[Message]) -> AsyncIterator[str]:
        """Run with streaming text output. Tool calls block until resolved."""
        tool_defs = self.skills.get_tool_definitions()
        conversation = list(messages)

        for round_num in range(self.max_tool_rounds):
            # Check if we should stream or handle tools
            response = await self.provider.chat(
                messages=conversation,
                tools=tool_defs,
                model=self.model,
            )

            if response.tool_calls:
                conversation.append(Message(
                    role="assistant", content=response.content, tool_calls=response.tool_calls,
                ))
                for tc in response.tool_calls:
                    yield f"\n🔧 *Running {tc.name}...*\n"
                    result = await self.skills.execute(tc.name, tc.arguments, self.skill_context)
                    conversation.append(Message(role="tool", content=result.content, tool_call_id=tc.id))
                continue

            # Final text response — stream it
            stream = await self.provider.chat(
                messages=conversation, tools=tool_defs, model=self.model, stream=True,
            )
            async for chunk in stream:
                yield chunk
            return

        yield "\n⚠️ Maximum tool rounds reached."
```

### Step 2: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.orchestrator import AgentOrchestrator
print(f'Orchestrator class: {AgentOrchestrator.__name__}')
print('Methods:', [m for m in dir(AgentOrchestrator) if not m.startswith('_')])
"
```

### Step 3: Commit

```bash
cd ~/Projects/Sage
git add backend/orchestrator.py
git commit -m "feat: add agent orchestrator with tool-calling loop"
```

---

## Task 8: FastAPI Endpoints (New API)

**Objective:** Create new API endpoints for the knowledge store, chat, and skills. Keep existing endpoints as legacy during migration.

**Files:**
- Create: `backend/api/__init__.py`
- Create: `backend/api/knowledge.py`
- Create: `backend/api/chat.py`
- Create: `backend/api/skills.py`
- Modify: `backend/main.py` (add new routers)

### Step 1: Create api package

```bash
mkdir -p ~/Projects/Sage/backend/api
touch ~/Projects/Sage/backend/api/__init__.py
```

### Step 2: Write `backend/api/knowledge.py`

```python
"""Knowledge store API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.store.db import KnowledgeStore
from backend.store.models import Document, Chunk
from backend.embeddings import get_embedder, chunk_text

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


class IngestRequest(BaseModel):
    title: str
    content: str
    source: str = "upload"
    source_id: str = ""
    doc_type: str = "text"


class SearchRequest(BaseModel):
    query: str
    max_results: int = 5


@router.post("/ingest")
async def ingest_document(req: IngestRequest, store: KnowledgeStore):
    doc = Document(title=req.title, source=req.source, source_id=req.source_id, doc_type=req.doc_type)
    store.add_document(doc)

    # Chunk and embed
    texts = chunk_text(req.content)
    embedder = get_embedder()
    embeddings = embedder.embed_chunks(texts)

    chunks = [
        Chunk(document_id=doc.id, chunk_index=i, content=text, embedding=emb.tobytes())
        for i, (text, emb) in enumerate(zip(texts, embeddings))
    ]
    store.add_chunks(chunks)

    return {"document_id": doc.id, "title": doc.title, "chunks": len(chunks)}


@router.get("/documents")
async def list_documents(store: KnowledgeStore, limit: int = 50, offset: int = 0):
    docs = store.list_documents(limit=limit, offset=offset)
    return {"documents": [
        {"id": d.id, "title": d.title, "source": d.source, "doc_type": d.doc_type, "created_at": d.created_at}
        for d in docs
    ]}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, store: KnowledgeStore):
    doc = store.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    chunks = store.get_chunks(doc_id)
    return {
        "id": doc.id, "title": doc.title, "source": doc.source,
        "doc_type": doc.doc_type, "chunks": len(chunks),
        "content_preview": chunks[0].content[:200] if chunks else "",
    }


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, store: KnowledgeStore):
    if not store.delete_document(doc_id):
        raise HTTPException(404, "Document not found")
    return {"deleted": True}


@router.post("/search")
async def search_knowledge(req: SearchRequest, store: KnowledgeStore):
    from backend.skills.search_docs import SearchDocsSkill
    from backend.skills.base import SkillContext
    from backend.config import SageConfig

    skill = SearchDocsSkill()
    ctx = SkillContext(store=store, provider=None, workspace=SageConfig().db_path.parent, config=SageConfig())
    result = await skill.execute({"query": req.query, "max_results": req.max_results}, ctx)
    return {"results": result.data.get("results", []), "formatted": result.content}
```

### Step 3: Write `backend/api/chat.py`

```python
"""Chat API endpoints."""
from __future__ import annotations
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.store.db import KnowledgeStore
from backend.store.models import Session, Message as DBMessage
from backend.providers.base import Message
from backend.providers.factory import create_provider
from backend.skills.registry import SkillRegistry
from backend.skills.base import SkillContext
from backend.orchestrator import AgentOrchestrator
from backend.config import SageConfig

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    provider: str | None = None
    model: str | None = None


SYSTEM_PROMPT = """You are Sage, a helpful knowledge assistant. You have access to the user's personal knowledge base through tools. When answering questions:

1. Search the knowledge base first using search_docs
2. Read relevant documents if needed using read_document
3. Cite sources with numbered references like [1], [2]
4. Be concise but thorough
5. If nothing relevant is found, say so honestly

Always ground your answers in the user's actual documents."""


@router.post("")
async def chat(req: ChatRequest, store: KnowledgeStore, skills: SkillRegistry, config: SageConfig):
    provider_name = req.provider or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    model = req.model or provider_config.get("default_model", "llama3.1:8b")

    provider = create_provider(provider_name, provider_config)

    # Get or create session
    if req.session_id:
        messages = store.get_session_messages(req.session_id)
        conversation = [
            Message(role=m.role, content=m.content,
                    tool_calls=[__import__("backend.providers.base", fromlist=["ToolCall"]).ToolCall(**tc) for tc in m.tool_calls] if m.tool_calls else [])
            for m in messages
        ]
    else:
        session = store.create_session(provider=provider_name, model=model)
        req.session_id = session.id
        conversation = []

    # Add system prompt and user message
    full_conversation = [Message(role="system", content=SYSTEM_PROMPT)] + conversation
    full_conversation.append(Message(role="user", content=req.message))
    store.add_message(DBMessage(session_id=req.session_id, role="user", content=req.message))

    # Build skill context
    ctx = SkillContext(store=store, provider=provider, workspace=config.db_path.parent, config=config)
    orchestrator = AgentOrchestrator(provider=provider, model=model, store=store, skills=skills, skill_context=ctx)

    response_text = await orchestrator.run(full_conversation)
    store.add_message(DBMessage(session_id=req.session_id, role="assistant", content=response_text))

    return {"response": response_text, "session_id": req.session_id}


@router.post("/stream")
async def chat_stream(req: ChatRequest, store: KnowledgeStore, skills: SkillRegistry, config: SageConfig):
    provider_name = req.provider or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    model = req.model or provider_config.get("default_model", "llama3.1:8b")

    provider = create_provider(provider_name, provider_config)
    session = store.create_session(provider=provider_name, model=model)

    conversation = [Message(role="system", content=SYSTEM_PROMPT), Message(role="user", content=req.message)]
    store.add_message(DBMessage(session_id=session.id, role="user", content=req.message))

    ctx = SkillContext(store=store, provider=provider, workspace=config.db_path.parent, config=config)
    orchestrator = AgentOrchestrator(provider=provider, model=model, store=store, skills=skills, skill_context=ctx)

    async def generate():
        full_response = ""
        async for chunk in orchestrator.run_streaming(conversation):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        store.add_message(DBMessage(session_id=session.id, role="assistant", content=full_response))
        yield f"data: {json.dumps({'done': True, 'session_id': session.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

### Step 4: Write `backend/api/skills.py`

```python
"""Skills API endpoints."""
from fastapi import APIRouter

from backend.skills.registry import SkillRegistry

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("")
async def list_skills(skills: SkillRegistry):
    return {
        "skills": [
            {"name": d.name, "description": d.description, "parameters": d.parameters}
            for d in skills.get_tool_definitions()
        ]
    }
```

### Step 5: Update `backend/main.py` — add new routers

Add these imports and startup lines to the existing `main.py` (do NOT delete existing endpoints yet):

```python
# Add at top of file, after existing imports:
from backend.api import knowledge, chat, skills as skills_api
from backend.store.db import KnowledgeStore
from backend.skills.registry import SkillRegistry
from backend.skills.search_docs import SearchDocsSkill
from backend.skills.read_document import ReadDocumentSkill
from backend.config import SageConfig

# Add after app = FastAPI(...):
config = SageConfig()
config.ensure_default_config()

# Initialize knowledge store
knowledge_store = KnowledgeStore(config.db_path)

# Initialize skill registry
skill_registry = SkillRegistry()
skill_registry.register(SearchDocsSkill())
skill_registry.register(ReadDocumentSkill())

# Dependency overrides for new endpoints
app.dependency_overrides[KnowledgeStore] = lambda: knowledge_store
app.dependency_overrides[SkillRegistry] = lambda: skill_registry
app.dependency_overrides[SageConfig] = lambda: config

# Register new routers
app.include_router(knowledge.router)
app.include_router(chat.router)
app.include_router(skills_api.router)
```

### Step 6: Verify

```bash
cd ~/Projects/Sage && python3 -c "
from backend.api.knowledge import router as kr
from backend.api.chat import router as cr
from backend.api.skills import router as sr
print(f'Knowledge routes: {[r.path for r in kr.routes]}')
print(f'Chat routes: {[r.path for r in cr.routes]}')
print(f'Skills routes: {[r.path for r in sr.routes]}')
"
```

### Step 7: Commit

```bash
cd ~/Projects/Sage
git add backend/api/ backend/main.py
git commit -m "feat: add new API endpoints (knowledge, chat, skills)"
```

---

## Task 9: Frontend — Floating Window Shell

**Objective:** Convert the Tauri app from a traditional window to a Raycast-style floating palette with the compact input state.

**Files:**
- Modify: `frontend/src-tauri/tauri.conf.json`
- Create: `frontend/src/app/layout.tsx` (rewrite)
- Create: `frontend/src/app/page.tsx` (rewrite)
- Create: `frontend/src/components/CommandBar.tsx` (new — the floating pill)

### Step 1: Update `frontend/src-tauri/tauri.conf.json`

Change the window config to a floating, frameless, transparent palette:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Sage",
  "version": "0.1.0",
  "identifier": "com.sage.desktop",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Sage",
        "width": 640,
        "height": 48,
        "resizable": false,
        "fullscreen": false,
        "decorations": false,
        "transparent": true,
        "alwaysOnTop": true,
        "skipTaskbar": true,
        "center": false,
        "x": 0,
        "y": 200
      }
    ],
    "security": {
      "csp": null
    },
    "withGlobalTauri": true
  },
  "bundle": {
    "active": true,
    "targets": ["deb", "appimage", "nsis", "dmg"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
    "identifier": "com.sage.desktop",
    "externalBin": ["binaries/main"]
  },
  "plugins": {
    "shell": {
      "open": true
    }
  }
}
```

### Step 2: Rewrite `frontend/src/app/layout.tsx`

```tsx
import "./globals.css";

export const metadata = {
  title: "Sage",
  description: "Local Knowledge Agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen w-full bg-transparent overflow-hidden font-body text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}
```

### Step 3: Rewrite `frontend/src/app/page.tsx`

```tsx
"use client";

import { useState } from "react";
import CommandBar from "@/components/CommandBar";

export default function Home() {
  const [response, setResponse] = useState<string | null>(null);

  return (
    <main className="relative w-full h-screen flex flex-col items-center pt-20">
      {/* Ambient glow */}
      <div className="ambient-glow" />

      {/* The floating command bar */}
      <CommandBar onSubmit={setResponse} />

      {/* Response area (expands below bar) */}
      {response && (
        <div className="mt-4 w-full max-w-[600px] px-4">
          <div className="bg-surface/80 backdrop-blur-[32px] border border-outline-variant/15 p-6 text-body-md text-on-surface rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]">
            {response}
          </div>
        </div>
      )}
    </main>
  );
}
```

### Step 4: Create `frontend/src/components/CommandBar.tsx`

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface CommandBarProps {
  onSubmit: (response: string) => void;
}

export default function CommandBar({ onSubmit }: CommandBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      });
      const data = await res.json();
      onSubmit(data.response);
    } catch (err) {
      onSubmit("Error: Could not connect to Sage backend. Is it running?");
    }
    setIsLoading(false);
    setQuery("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[600px] px-4">
      <div
        className="h-12 w-full bg-surface/80 backdrop-blur-[32px] rounded-full border border-outline-variant/15
                   flex items-center px-4
                   shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_60px_rgba(173,198,255,0.04)]
                   transition-all duration-300 hover:border-outline-variant/30
                   focus-within:border-primary/40"
      >
        {/* Sparkle icon */}
        <span className="material-symbols-outlined text-primary text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
          auto_awesome
        </span>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about your knowledge base..."
          disabled={isLoading}
          className="flex-1 h-full bg-transparent border-none text-on-surface placeholder:text-on-surface-variant/60 text-body-md px-3 w-full"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Provider badge */}
        <div className="flex items-center gap-1 bg-surface-container-high rounded-full px-2.5 py-1 border border-outline-variant/10 flex-shrink-0 cursor-default hover:border-primary/40 transition-colors">
          <span className="text-label-sm text-primary leading-none">⚡</span>
          <span className="text-label-sm text-on-surface-variant font-medium uppercase leading-none mt-[1px]">
            {isLoading ? "..." : "GPT-4o"}
          </span>
        </div>
      </div>
    </form>
  );
}
```

### Step 5: Add Material Symbols to layout

In `frontend/src/app/layout.tsx`, add to `<head>`:

```tsx
<head>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
    rel="stylesheet"
  />
</head>
```

### Step 6: Verify

```bash
cd ~/Projects/Sage/frontend && npm run build 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

### Step 7: Commit

```bash
cd ~/Projects/Sage
git add frontend/src/ frontend/src-tauri/tauri.conf.json
git commit -m "feat: floating command palette shell (Ethereal Console)"
```

---

## Post-Phase 1 Verification

After all tasks are complete, verify the full stack:

```bash
# 1. Start backend
cd ~/Projects/Sage && uvicorn backend.main:app --reload --port 8000

# 2. In another terminal, test endpoints
curl http://localhost:8000/api/skills | python3 -m json.tool
curl -X POST http://localhost:8000/api/knowledge/ingest -H "Content-Type: application/json" -d '{"title":"Test Doc","content":"Transformers use self-attention to process sequences in parallel. The key innovation is the multi-head attention mechanism."}'
curl -X POST http://localhost:8000/api/knowledge/search -H "Content-Type: application/json" -d '{"query":"attention mechanism"}'

# 3. Start frontend
cd ~/Projects/Sage/frontend && npm run dev

# 4. Open http://localhost:3000 — should see the floating command bar
```

---

## Phase 2 Preview (Next Steps)

After Phase 1 is complete and verified:
- Quiz generation skill + QuizWidget UI component
- Flashcard skill + FlashcardViewer
- Audio review skill (Piper TTS integration)
- Report generation skill
- History panel (Cmd+K)
- Window expand/collapse animations (Framer Motion)
- shadcn/ui component integration
- Provider settings UI
- Obsidian vault ingestion
