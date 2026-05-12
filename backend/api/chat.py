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

You run inside the Sage app. The app's frontend watches every message the user sends — to the command bar OR to you in chat — and routes prompts containing certain keywords to dedicated views instead of returning a chat reply. You should be aware of these so you can guide the user accurately when they ask "what can you do?" or how to access a feature. Do NOT try to render these artifacts yourself in markdown — tell the user the keyword to type and the app will open the right view.

Routing keywords (case-insensitive):
- "quiz", or whole-word "test" / "tests" / "testing" → generates a real multiple-choice quiz from the knowledge base via POST /api/generate/quiz, rendered in the QuizWidget.
- "flashcard" / "flash card" → generates real study flashcards from the knowledge base via POST /api/generate/flashcards, rendered in the FlashcardWidget.
- "audio", "listen", "podcast" → generates a spoken-style narration script from the knowledge base via POST /api/generate/audio. If an OpenAI API key is configured, the script is synthesized to an MP3 (OpenAI TTS) and played in an audio element; otherwise playback falls back to the browser's SpeechSynthesis voice. Transcript scrolls with the audio.
- "report", "study guide", "summary" → opens the report view (sample report for now).
- "history" → opens the history panel of past sessions.
- "tome", "collection", "library" → opens the tome selector for grouping documents.
- "knowledge", "kb", "docs", "documents", "knowledge base", "view/show/list documents" → opens the KnowledgeBaseWidget which lists every ingested document with detail + delete.

Other things the user can do in this app:
- Upload documents to the knowledge base using the circular upload button to the right of the command bar. It accepts pasted text or text-like files (.txt, .md, .csv, .json, .log). PDFs/DOCX/images are not yet supported via the UI.
- Anything ingested is chunked, embedded, and dedup'd by content hash; you can immediately search it via search_docs.

If the user asks for one of the routed features inside chat (e.g. "make me flashcards on attention"), the app will switch views automatically — you will not see the follow-up. So when that happens, you do not need to reply at all. If the user is asking *about* a feature rather than invoking it, explain it using the information above."""


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
