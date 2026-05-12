"""Generation endpoints — produce structured artifacts (flashcards, quizzes)
grounded in the user's knowledge base."""
from __future__ import annotations

import json
import logging
import random
import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import SageConfig
from providers.base import Message
from providers.factory import create_provider
from skills.base import SkillContext
from skills.search_docs import SearchDocsSkill
from store.db import KnowledgeStore

router = APIRouter(prefix="/api/generate", tags=["generate"])
logger = logging.getLogger("sage.generate")


# ─────────────────────── Request schemas ───────────────────────


class GenerateRequest(BaseModel):
    topic: str | None = None
    tome_id: str | None = None
    count: int = 6
    provider: str | None = None
    model: str | None = None


# ─────────────────────── Shared helpers ────────────────────────


async def _gather_context(
    topic: str | None,
    tome_id: str | None,
    store: KnowledgeStore,
    config: SageConfig,
    max_results: int,
) -> tuple[str, list[dict[str, Any]]]:
    """Return (joined context text, list of source dicts). Falls back to
    random sampling when there's no topic to drive semantic search."""
    if topic:
        skill = SearchDocsSkill()
        ctx = SkillContext(
            store=store, provider=None, workspace=config.db_path.parent,
            config=config, tome_id=tome_id,
        )
        result = await skill.execute(
            {"query": topic, "max_results": max_results}, ctx,
        )
        rows = result.data.get("results", []) if result.data else []
        if rows:
            sources = [
                {
                    "document_id": r["document_id"],
                    "document_title": r["document_title"],
                    "chunk_index": r["chunk_index"],
                    "similarity": r["similarity"],
                }
                for r in rows
            ]
            joined = "\n\n".join(
                f'[{i + 1}] "{r["document_title"]}" (chunk {r["chunk_index"]})\n{r["content"]}'
                for i, r in enumerate(rows)
            )
            return joined, sources

    # No topic, or search returned nothing — fall back to random chunks.
    if tome_id:
        doc_ids = set(store.get_tome_document_ids(tome_id))
        chunks = [c for c in store.get_all_chunks_with_embeddings() if c.document_id in doc_ids]
    else:
        chunks = store.get_all_chunks_with_embeddings()

    if not chunks:
        return "", []

    sampled = random.sample(chunks, k=min(max_results, len(chunks)))
    sources = []
    parts = []
    for i, chunk in enumerate(sampled, 1):
        doc = store.get_document(chunk.document_id)
        title = doc.title if doc else "Unknown"
        sources.append({
            "document_id": chunk.document_id,
            "document_title": title,
            "chunk_index": chunk.chunk_index,
            "similarity": None,
        })
        parts.append(f'[{i}] "{title}" (chunk {chunk.chunk_index})\n{chunk.content}')
    return "\n\n".join(parts), sources


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def _extract_json(text: str) -> Any:
    """Pull a JSON object out of a model response that may be wrapped in
    prose or code fences. Raises ValueError if nothing parses."""
    candidates: list[str] = []
    candidates.extend(m.group(1).strip() for m in _JSON_FENCE_RE.finditer(text))

    stripped = text.strip()
    if stripped:
        candidates.append(stripped)

    for start_ch, end_ch in (("{", "}"), ("[", "]")):
        first = text.find(start_ch)
        last = text.rfind(end_ch)
        if first != -1 and last > first:
            candidates.append(text[first : last + 1])

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    raise ValueError("Could not parse JSON from model response")


async def _llm_json(
    system_prompt: str,
    user_prompt: str,
    provider_name: str | None,
    model: str | None,
    config: SageConfig,
) -> Any:
    provider_name = provider_name or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    resolved_model = model or provider_config.get("default_model", "llama3.1:8b")
    provider = create_provider(provider_name, provider_config)

    kwargs: dict[str, Any] = {}
    if provider_name in ("openai", "deepseek"):
        kwargs["response_format"] = {"type": "json_object"}

    messages = [
        Message(role="system", content=system_prompt),
        Message(role="user", content=user_prompt),
    ]
    response = await provider.chat(messages=messages, tools=[], model=resolved_model, **kwargs)
    text = getattr(response, "content", "") or ""
    return _extract_json(text)


async def llm_text(
    system_prompt: str,
    user_prompt: str,
    provider_name: str | None,
    model: str | None,
    config: SageConfig,
) -> tuple[str, str, str]:
    """Call the configured provider with no tools, no JSON-mode. Returns
    (content, resolved_provider_name, resolved_model)."""
    provider_name = provider_name or config.get("providers.default", "ollama")
    provider_config = config.provider_config(provider_name)
    resolved_model = model or provider_config.get("default_model", "llama3.1:8b")
    provider = create_provider(provider_name, provider_config)

    messages = [
        Message(role="system", content=system_prompt),
        Message(role="user", content=user_prompt),
    ]
    response = await provider.chat(messages=messages, tools=[], model=resolved_model)
    return (getattr(response, "content", "") or "", provider_name, resolved_model)


def _empty_kb_error() -> HTTPException:
    return HTTPException(
        status_code=400,
        detail=(
            "Your knowledge base is empty for this scope. Add documents first "
            "via the upload button next to the command bar."
        ),
    )


# ─────────────────────── Flashcards ────────────────────────────


FLASHCARD_SYSTEM = """You write study flashcards grounded ONLY in the provided source excerpts.

Rules:
- Each card must be answerable from the sources. Do not invent facts.
- "front" is a concise question or term (1 sentence).
- "back" is a tight, self-contained answer (1–3 sentences).
- Cover distinct ideas — do not repeat the same fact in different words.
- Output ONLY a JSON object of the form: {"cards": [{"front": "...", "back": "..."}, ...]}
- No commentary, no markdown fences."""


@router.post("/flashcards")
async def generate_flashcards(
    req: GenerateRequest,
    store: KnowledgeStore = Depends(),
    config: SageConfig = Depends(),
):
    count = max(1, min(req.count, 20))
    context_text, sources = await _gather_context(
        topic=req.topic, tome_id=req.tome_id, store=store, config=config,
        max_results=max(count, 6),
    )
    if not context_text:
        raise _empty_kb_error()

    topic_line = (
        f"Topic focus: {req.topic.strip()}" if req.topic and req.topic.strip()
        else "Topic focus: cover the most important ideas in the sources."
    )
    user_prompt = (
        f"{topic_line}\n"
        f"Generate exactly {count} flashcards.\n\n"
        f"Source excerpts:\n{context_text}"
    )

    try:
        parsed = await _llm_json(FLASHCARD_SYSTEM, user_prompt, req.provider, req.model, config)
    except ValueError as exc:
        logger.exception("flashcard json parse failed")
        raise HTTPException(status_code=502, detail=f"Model returned unparseable output: {exc}")

    raw_cards = parsed.get("cards") if isinstance(parsed, dict) else parsed
    if not isinstance(raw_cards, list):
        raise HTTPException(status_code=502, detail="Model output missing 'cards' array")

    cards = []
    for entry in raw_cards[:count]:
        if not isinstance(entry, dict):
            continue
        front = str(entry.get("front", "")).strip()
        back = str(entry.get("back", "")).strip()
        if not front or not back:
            continue
        cards.append({"id": f"fc-{uuid.uuid4().hex[:8]}", "front": front, "back": back})

    if not cards:
        raise HTTPException(status_code=502, detail="Model produced no usable flashcards")

    return {
        "cards": cards,
        "topic": req.topic or "",
        "sources": sources,
    }


# ─────────────────────── Quiz ──────────────────────────────────


QUIZ_SYSTEM = """You write multiple-choice quiz questions grounded ONLY in the provided source excerpts.

Rules:
- Each question must be answerable from the sources. Do not invent facts.
- Exactly 4 options per question, labeled "a", "b", "c", "d".
- Exactly one correct option per question.
- "explanation" should be 1–2 sentences explaining the correct answer using the sources.
- Distractors must be plausible but clearly wrong given the sources.
- Output ONLY a JSON object of the form:
  {"questions": [
    {"question": "...",
     "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
     "correctOptionId": "b",
     "explanation": "..."}
  ]}
- No commentary, no markdown fences."""


@router.post("/quiz")
async def generate_quiz(
    req: GenerateRequest,
    store: KnowledgeStore = Depends(),
    config: SageConfig = Depends(),
):
    count = max(1, min(req.count, 15))
    context_text, sources = await _gather_context(
        topic=req.topic, tome_id=req.tome_id, store=store, config=config,
        max_results=max(count, 5),
    )
    if not context_text:
        raise _empty_kb_error()

    topic_line = (
        f"Topic focus: {req.topic.strip()}" if req.topic and req.topic.strip()
        else "Topic focus: cover the most important ideas in the sources."
    )
    user_prompt = (
        f"{topic_line}\n"
        f"Generate exactly {count} multiple-choice questions.\n\n"
        f"Source excerpts:\n{context_text}"
    )

    try:
        parsed = await _llm_json(QUIZ_SYSTEM, user_prompt, req.provider, req.model, config)
    except ValueError as exc:
        logger.exception("quiz json parse failed")
        raise HTTPException(status_code=502, detail=f"Model returned unparseable output: {exc}")

    raw_questions = parsed.get("questions") if isinstance(parsed, dict) else parsed
    if not isinstance(raw_questions, list):
        raise HTTPException(status_code=502, detail="Model output missing 'questions' array")

    questions = []
    for entry in raw_questions[:count]:
        if not isinstance(entry, dict):
            continue
        question_text = str(entry.get("question", "")).strip()
        options_raw = entry.get("options")
        correct_id = str(entry.get("correctOptionId", "")).strip().lower()
        explanation = str(entry.get("explanation", "")).strip()
        if not question_text or not isinstance(options_raw, list) or len(options_raw) < 2:
            continue

        options = []
        for opt in options_raw:
            if not isinstance(opt, dict):
                continue
            opt_id = str(opt.get("id", "")).strip().lower()
            opt_text = str(opt.get("text", "")).strip()
            if opt_id and opt_text:
                options.append({"id": opt_id, "text": opt_text})
        if len(options) < 2 or not any(o["id"] == correct_id for o in options):
            continue

        questions.append({
            "id": f"q-{uuid.uuid4().hex[:8]}",
            "question": question_text,
            "options": options,
            "correctOptionId": correct_id,
            "explanation": explanation,
        })

    if not questions:
        raise HTTPException(status_code=502, detail="Model produced no usable questions")

    return {
        "questions": questions,
        "topic": req.topic or "",
        "sources": sources,
    }


# ─────────────────────── Report ────────────────────────────────


REPORT_SYSTEM = """You write structured study reports grounded ONLY in the provided source excerpts.

Rules:
- Every claim must be supported by the sources. Do not invent facts, numbers, or citations.
- Aim for 5–9 sections, each focused on one distinct idea.
- The first section MUST be "Executive Summary".
- Section content is GitHub-flavored markdown. You may use:
  * paragraphs, **bold**, *italic*, blockquotes
  * bullet and numbered lists
  * tables (pipe syntax)
  * fenced code blocks (with language) when sources include code
  * LaTeX math: inline `$...$` and display `$$...$$` (escape backslashes as needed)
- Do NOT include the section title inside the section's content — only the body.
- Do NOT use h1 (#) headings. If you need a sub-heading inside a section, use h3 (###).
- Output ONLY a JSON object of the form:
  {
    "title": "Short report title (≤ 60 chars)",
    "subtitle": "One-line description of the report's scope",
    "sections": [
      {"title": "Executive Summary", "content": "markdown..."},
      {"title": "...", "content": "markdown..."},
      ...
    ]
  }
- No commentary, no markdown fences around the JSON."""


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(text: str) -> str:
    """Match rehype-slug / github-slugger output for typical ASCII headings."""
    slug = _SLUG_RE.sub("-", text.lower()).strip("-")
    return slug or "section"


@router.post("/report")
async def generate_report(
    req: GenerateRequest,
    store: KnowledgeStore = Depends(),
    config: SageConfig = Depends(),
):
    context_text, sources = await _gather_context(
        topic=req.topic, tome_id=req.tome_id, store=store, config=config,
        max_results=10,
    )
    if not context_text:
        raise _empty_kb_error()

    topic_line = (
        f"Topic focus: {req.topic.strip()}" if req.topic and req.topic.strip()
        else "Topic focus: synthesize the most important ideas across the sources."
    )
    user_prompt = (
        f"{topic_line}\n"
        f"Write the report now as structured JSON.\n\n"
        f"Source excerpts:\n{context_text}"
    )

    try:
        parsed = await _llm_json(REPORT_SYSTEM, user_prompt, req.provider, req.model, config)
    except ValueError as exc:
        logger.exception("report json parse failed")
        raise HTTPException(status_code=502, detail=f"Model returned unparseable output: {exc}")

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=502, detail="Model output was not a JSON object")

    title = str(parsed.get("title", "")).strip() or (
        f"Report: {req.topic.strip()}" if req.topic and req.topic.strip() else "Report"
    )
    subtitle = str(parsed.get("subtitle", "")).strip() or None
    raw_sections = parsed.get("sections")
    if not isinstance(raw_sections, list) or not raw_sections:
        raise HTTPException(status_code=502, detail="Model output missing 'sections' array")

    toc: list[dict[str, str]] = []
    content_parts: list[str] = []
    used_slugs: set[str] = set()
    for entry in raw_sections:
        if not isinstance(entry, dict):
            continue
        section_title = str(entry.get("title", "")).strip()
        section_body = str(entry.get("content", "")).strip()
        if not section_title or not section_body:
            continue
        base_slug = _slugify(section_title)
        slug = base_slug
        i = 1
        while slug in used_slugs:
            i += 1
            slug = f"{base_slug}-{i}"
        used_slugs.add(slug)
        toc.append({"id": slug, "title": section_title})
        content_parts.append(f"## {section_title}\n\n{section_body}")

    if not toc:
        raise HTTPException(status_code=502, detail="Model produced no usable sections")

    unique_doc_ids: set[str] = set()
    for s in sources:
        unique_doc_ids.add(s["document_id"])
    doc_count = len(unique_doc_ids)

    tome_name: str | None = None
    if req.tome_id:
        tome = store.get_tome(req.tome_id)
        if tome:
            tome_name = tome.name

    if doc_count:
        if tome_name:
            source_docs = f'Based on {doc_count} document{"s" if doc_count != 1 else ""} in "{tome_name}" tome'
        else:
            source_docs = f'Based on {doc_count} document{"s" if doc_count != 1 else ""} in your knowledge base'
    else:
        source_docs = None

    content = "\n\n".join(content_parts) + "\n\n---\n\n*Report generated by Sage*"

    return {
        "title": title,
        "subtitle": subtitle,
        "sourceDocs": source_docs,
        "toc": toc,
        "content": content,
        "sources": sources,
        "topic": req.topic or "",
    }
