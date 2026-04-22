"""Tome API endpoints — create, list, manage sources."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from store.db import KnowledgeStore

router = APIRouter(prefix="/api/tomes", tags=["tomes"])


class CreateTomeRequest(BaseModel):
    name: str
    description: str = ""


class LinkSourceRequest(BaseModel):
    document_id: str


@router.post("")
async def create_tome(req: CreateTomeRequest, store: KnowledgeStore = Depends()):
    tome = store.create_tome(name=req.name, description=req.description)
    return {"id": tome.id, "name": tome.name, "description": tome.description, "created_at": tome.created_at}


@router.get("")
async def list_tomes(store: KnowledgeStore = Depends()):
    tomes = store.list_tomes()
    result = []
    for t in tomes:
        doc_ids = store.get_tome_document_ids(t.id)
        session = store.get_tome_session(t.id)
        result.append({
            "id": t.id, "name": t.name, "description": t.description,
            "created_at": t.created_at,
            "source_count": len(doc_ids),
            "has_session": session is not None,
        })
    return {"tomes": result}


@router.get("/{tome_id}")
async def get_tome(tome_id: str, store: KnowledgeStore = Depends()):
    tome = store.get_tome(tome_id)
    if not tome:
        raise HTTPException(404, "Tome not found")
    docs = store.get_tome_documents(tome_id)
    session = store.get_tome_session(tome_id)
    return {
        "id": tome.id, "name": tome.name, "description": tome.description,
        "created_at": tome.created_at,
        "sources": [
            {"id": d.id, "title": d.title, "source": d.source, "doc_type": d.doc_type}
            for d in docs
        ],
        "session": {"id": session.id, "provider": session.provider, "model": session.model} if session else None,
    }


@router.delete("/{tome_id}")
async def delete_tome(tome_id: str, store: KnowledgeStore = Depends()):
    if not store.delete_tome(tome_id):
        raise HTTPException(404, "Tome not found")
    return {"deleted": True}


@router.post("/{tome_id}/sources")
async def link_source(tome_id: str, req: LinkSourceRequest, store: KnowledgeStore = Depends()):
    """Link an existing document to a tome."""
    tome = store.get_tome(tome_id)
    if not tome:
        raise HTTPException(404, "Tome not found")
    doc = store.get_document(req.document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    store.link_to_tome(tome_id, req.document_id)
    return {"linked": True, "tome_id": tome_id, "document_id": req.document_id}


@router.delete("/{tome_id}/sources/{document_id}")
async def unlink_source(tome_id: str, document_id: str, store: KnowledgeStore = Depends()):
    """Remove a document from a tome (does NOT delete the document)."""
    store.unlink_from_tome(tome_id, document_id)
    return {"unlinked": True}


@router.get("/{tome_id}/sources")
async def list_tome_sources(tome_id: str, store: KnowledgeStore = Depends()):
    """List all documents in a tome."""
    tome = store.get_tome(tome_id)
    if not tome:
        raise HTTPException(404, "Tome not found")
    docs = store.get_tome_documents(tome_id)
    return {"sources": [
        {"id": d.id, "title": d.title, "source": d.source, "doc_type": d.doc_type,
         "content_hash": d.content_hash, "created_at": d.created_at}
        for d in docs
    ]}
