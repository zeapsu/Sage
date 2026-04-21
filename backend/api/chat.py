"""Chat API endpoints."""
from __future__ import annotations
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import SageConfig
from orchestrator import AgentOrchestrator
from providers.base import Message, ToolCall
from providers.factory import create_provider
from skills.base import SkillContext
from skills.registry import SkillRegistry
from store.db import KnowledgeStore
from store.models import Message as DBMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """You are Sage, a helpful knowledge assistant. You have access to the user's personal knowledge base through tools. When answering questions:

1. Search the knowledge base first using search_docs
2. Read relevant documents if needed using read_document
3. Cite sources with numbered references like [1], [2]
4. Be concise but thorough
5. If nothing relevant is found, say so honestly

Always ground your answers in the user's actual documents."""


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    provider: str | None = None
    model: str | None = None


@router.post("")
async def chat(
    req: ChatRequest,
    store: KnowledgeStore = Depends(),
    skills: SkillRegistry = Depends(),
    config: SageConfig = Depends(),
):
    provider_name = req.provider or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    model = req.model or provider_config.get("default_model", "llama3.1:8b")

    provider = create_provider(provider_name, provider_config)

    if req.session_id:
        db_messages = store.get_session_messages(req.session_id)
        conversation = [
            Message(
                role=m.role,
                content=m.content,
                tool_calls=[ToolCall(**tc) for tc in (m.tool_calls or [])],
            )
            for m in db_messages
        ]
        session_id = req.session_id
    else:
        session = store.create_session(provider=provider_name, model=model)
        session_id = session.id
        conversation = []

    full_conversation = [Message(role="system", content=SYSTEM_PROMPT)] + conversation
    full_conversation.append(Message(role="user", content=req.message))
    store.add_message(DBMessage(session_id=session_id, role="user", content=req.message))

    ctx = SkillContext(store=store, provider=provider, workspace=config.db_path.parent, config=config)
    orchestrator = AgentOrchestrator(
        provider=provider, model=model, store=store, skills=skills, skill_context=ctx
    )

    response_text = await orchestrator.run(full_conversation)
    store.add_message(DBMessage(session_id=session_id, role="assistant", content=response_text))

    return {"response": response_text, "session_id": session_id}


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    store: KnowledgeStore = Depends(),
    skills: SkillRegistry = Depends(),
    config: SageConfig = Depends(),
):
    provider_name = req.provider or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    model = req.model or provider_config.get("default_model", "llama3.1:8b")

    provider = create_provider(provider_name, provider_config)
    session = store.create_session(provider=provider_name, model=model)

    conversation = [Message(role="system", content=SYSTEM_PROMPT), Message(role="user", content=req.message)]
    store.add_message(DBMessage(session_id=session.id, role="user", content=req.message))

    ctx = SkillContext(store=store, provider=provider, workspace=config.db_path.parent, config=config)
    orchestrator = AgentOrchestrator(
        provider=provider, model=model, store=store, skills=skills, skill_context=ctx
    )

    async def generate():
        full_response = ""
        async for chunk in orchestrator.run_streaming(conversation):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        store.add_message(DBMessage(session_id=session.id, role="assistant", content=full_response))
        yield f"data: {json.dumps({'done': True, 'session_id': session.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
