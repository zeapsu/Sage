"""Chat API endpoints — tome-scoped conversations."""
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

SYSTEM_PROMPT = """You are Sage, a helpful knowledge assistant. You have access to the user's personal knowledge base through tools.

When answering questions:
1. Search the knowledge base first using search_docs
2. Read relevant documents if needed using read_document
3. Cite sources with numbered references like [1], [2]
4. Be concise but thorough
5. If nothing relevant is found, say so honestly

Always ground your answers in the user's actual documents.

# App capabilities you should know about

You run inside the Sage app. The app has dedicated views for study artifacts and source management. Normal natural-language questions stay in chat, even if they mention words like history, summary, library, audio, quiz, or documents. Dedicated views open only from first-party UI controls or explicit slash commands, so you can safely answer ordinary questions without expecting the frontend to hijack them.

Explicit slash commands (case-insensitive, optional text after the command):
- /quiz or /test → generates a real multiple-choice quiz from the knowledge base via POST /api/generate/quiz, rendered in the QuizWidget.
- /flashcards or /flashcard → generates real study flashcards from the knowledge base via POST /api/generate/flashcards, rendered in the FlashcardWidget.
- /audio, /listen, or /podcast → generates a spoken-style narration script from the knowledge base via POST /api/generate/audio. If an OpenAI API key is configured, the script is synthesized to an MP3 (OpenAI TTS) and played in an audio element; otherwise playback falls back to the browser's SpeechSynthesis voice. Transcript scrolls with the audio.
- /report or /study-guide → opens the report view.
- /history → opens the history panel of past sessions.
- /tomes or /tome → opens the tome selector for grouping documents.
- /knowledge, /sources, or /docs → opens the KnowledgeBaseWidget which lists every ingested document with detail + delete.

Other things the user can do in this app:
- Upload documents to the knowledge base using the Add source action. It accepts pasted text or text-like files (.txt, .md, .csv, .json, .log). PDFs/DOCX/images are not yet supported via the UI.
- Anything ingested is chunked, embedded, and dedup'd by content hash; you can immediately search it via search_docs.

If the user asks how to access a routed feature, suggest the relevant slash command. Do not render generated quizzes, flashcards, reports, or audio scripts yourself unless the user asks for a plain chat answer instead."""


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    tome_id: str | None = None  # Scope to this tome
    provider: str | None = None
    model: str | None = None


@router.get("/sessions")
async def list_sessions(
    limit: int = 100,
    store: KnowledgeStore = Depends(),
):
    """Return recent chat sessions for the History panel."""
    return {"sessions": store.list_sessions(limit=limit)}


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
        session = store.create_session(
            provider=provider_name, model=model, tome_id=req.tome_id,
        )
        session_id = session.id
        conversation = []

    full_conversation = [Message(role="system", content=SYSTEM_PROMPT)] + conversation
    full_conversation.append(Message(role="user", content=req.message))
    store.add_message(DBMessage(session_id=session_id, role="user", content=req.message))

    ctx = SkillContext(
        store=store, provider=provider, workspace=config.db_path.parent,
        config=config, tome_id=req.tome_id,
    )
    orchestrator = AgentOrchestrator(
        provider=provider, model=model, store=store, skills=skills, skill_context=ctx,
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
    session = store.create_session(
        provider=provider_name, model=model, tome_id=req.tome_id,
    )

    conversation = [Message(role="system", content=SYSTEM_PROMPT), Message(role="user", content=req.message)]
    store.add_message(DBMessage(session_id=session.id, role="user", content=req.message))

    ctx = SkillContext(
        store=store, provider=provider, workspace=config.db_path.parent,
        config=config, tome_id=req.tome_id,
    )
    orchestrator = AgentOrchestrator(
        provider=provider, model=model, store=store, skills=skills, skill_context=ctx,
    )

    async def generate():
        full_response = ""
        async for chunk in orchestrator.run_streaming(conversation):
            full_response += chunk
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        store.add_message(DBMessage(session_id=session.id, role="assistant", content=full_response))
        yield f"data: {json.dumps({'done': True, 'session_id': session.id})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
