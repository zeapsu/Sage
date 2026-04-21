"""Knowledge store API endpoints."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import SageConfig
from embeddings import chunk_text, get_embedder
from skills.base import SkillContext
from skills.search_docs import SearchDocsSkill
from store.db import KnowledgeStore
from store.models import Chunk, Document

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
async def ingest_document(req: IngestRequest, store: KnowledgeStore = Depends()):
    doc = Document(title=req.title, source=req.source, source_id=req.source_id, doc_type=req.doc_type)
    store.add_document(doc)

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
async def list_documents(store: KnowledgeStore = Depends(), limit: int = 50, offset: int = 0):
    docs = store.list_documents(limit=limit, offset=offset)
    return {"documents": [
        {"id": d.id, "title": d.title, "source": d.source, "doc_type": d.doc_type, "created_at": d.created_at}
        for d in docs
    ]}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str, store: KnowledgeStore = Depends()):
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
async def delete_document(doc_id: str, store: KnowledgeStore = Depends()):
    if not store.delete_document(doc_id):
        raise HTTPException(404, "Document not found")
    return {"deleted": True}


@router.post("/search")
async def search_knowledge(req: SearchRequest, store: KnowledgeStore = Depends()):
    skill = SearchDocsSkill()
    cfg = SageConfig()
    ctx = SkillContext(store=store, provider=None, workspace=cfg.db_path.parent, config=cfg)
    result = await skill.execute({"query": req.query, "max_results": req.max_results}, ctx)
    return {"results": result.data.get("results", []), "formatted": result.content}
