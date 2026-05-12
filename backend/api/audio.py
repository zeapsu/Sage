"""Audio generation endpoint — KB-grounded narration script + optional
OpenAI TTS synthesis. Frontend falls back to browser SpeechSynthesis when
no server-side audio file is produced."""
from __future__ import annotations

import logging
import os
import re
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from api.generate import _empty_kb_error, _gather_context, llm_text
from config import SageConfig
from store.db import KnowledgeStore

router = APIRouter(tags=["audio"])
logger = logging.getLogger("sage.audio")

# Words per second — used to estimate segment timings and total duration
# when we can't probe the audio file. Roughly matches OpenAI TTS / typical
# browser SpeechSynthesis pacing.
WORDS_PER_SECOND = 2.5

AUDIO_CACHE_DIR = Path(os.getenv("SAGE_AUDIO_CACHE", "/tmp/sage_audio"))
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────── Schemas ───────────────────────────────


class AudioRequest(BaseModel):
    topic: str | None = None
    tome_id: str | None = None
    voice: str | None = None  # OpenAI TTS voice (alloy, echo, fable, onyx, nova, shimmer)
    provider: str | None = None
    model: str | None = None


# ─────────────────────── Script generation ─────────────────────


SCRIPT_SYSTEM = """You write spoken-style narration grounded ONLY in the provided source excerpts. The output will be read aloud by a text-to-speech engine.

Rules:
- Conversational, natural prose. Like a podcast host explaining a topic.
- No markdown, no bullet points, no code blocks, no headings, no citations.
- Do not say "in the sources" or "according to chunk 3" — just teach the content.
- 4–8 short paragraphs. Each paragraph 1–3 sentences.
- Roughly 200–350 words total.
- End with a brief closing sentence.
- If the sources are sparse, summarize what's there honestly without inventing facts."""


_SENTENCE_RE = re.compile(r"[^.!?\n]+[.!?]+|\S[^.!?\n]*", re.UNICODE)


def _split_into_segments(script: str) -> list[dict[str, Any]]:
    """Split the script into spoken sentences with estimated start/end times
    proportional to word count."""
    raw_sentences = [m.group(0).strip() for m in _SENTENCE_RE.finditer(script)]
    raw_sentences = [s for s in raw_sentences if s]

    if not raw_sentences:
        return []

    segments: list[dict[str, Any]] = []
    cursor = 0.0
    for i, text in enumerate(raw_sentences):
        words = max(1, len(text.split()))
        duration = max(1.2, words / WORDS_PER_SECOND)
        segments.append({
            "id": f"s{i + 1}",
            "text": text,
            "startTime": round(cursor, 2),
            "endTime": round(cursor + duration, 2),
        })
        cursor += duration
    return segments


# ─────────────────────── TTS synthesis ─────────────────────────


_OPENAI_TTS_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}


def _maybe_synthesize_openai_tts(
    script: str, voice: str | None, config: SageConfig,
) -> tuple[str | None, str | None]:
    """If an OpenAI key is configured, synthesize the script to an MP3 on
    disk and return (audio_id, voice_used). Otherwise return (None, None)
    so the frontend can fall back to browser SpeechSynthesis."""
    openai_cfg = config.provider_config("openai")
    api_key = openai_cfg.get("api_key") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None, None

    selected_voice = (voice or "alloy").lower()
    if selected_voice not in _OPENAI_TTS_VOICES:
        selected_voice = "alloy"

    try:
        # Imported lazily so missing SDK never breaks the no-TTS path.
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=openai_cfg.get("base_url"))
        audio_id = uuid.uuid4().hex
        out_path = AUDIO_CACHE_DIR / f"{audio_id}.mp3"

        with client.audio.speech.with_streaming_response.create(
            model="tts-1",
            voice=selected_voice,
            input=script,
        ) as response:
            response.stream_to_file(out_path)

        return audio_id, selected_voice
    except Exception as exc:  # noqa: BLE001
        logger.warning("OpenAI TTS synthesis failed, falling back: %s", exc)
        return None, None


# ─────────────────────── Endpoints ─────────────────────────────


@router.post("/api/generate/audio")
async def generate_audio(
    req: AudioRequest,
    store: KnowledgeStore = Depends(),
    config: SageConfig = Depends(),
):
    context_text, sources = await _gather_context(
        topic=req.topic, tome_id=req.tome_id, store=store, config=config,
        max_results=8,
    )
    if not context_text:
        raise _empty_kb_error()

    topic_line = (
        f"Topic focus: {req.topic.strip()}" if req.topic and req.topic.strip()
        else "Topic focus: cover the most important ideas in the sources."
    )
    user_prompt = (
        f"{topic_line}\n"
        f"Write the narration now.\n\n"
        f"Source excerpts:\n{context_text}"
    )

    try:
        script, provider_used, model_used = await llm_text(
            SCRIPT_SYSTEM, user_prompt, req.provider, req.model, config,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("audio script generation failed")
        raise HTTPException(status_code=502, detail=f"Failed to generate script: {exc}")

    script = script.strip()
    if not script:
        raise HTTPException(status_code=502, detail="Model produced an empty script.")

    segments = _split_into_segments(script)
    estimated_duration = segments[-1]["endTime"] if segments else 0.0

    audio_id, used_voice = _maybe_synthesize_openai_tts(script, req.voice, config)
    audio_url = f"/api/audio/{audio_id}.mp3" if audio_id else None

    voice_label = used_voice or "Browser"

    title = (
        f"Audio: {req.topic.strip()}" if req.topic and req.topic.strip()
        else "Audio overview"
    )

    return {
        "id": audio_id or f"local-{uuid.uuid4().hex[:8]}",
        "title": title,
        "voice": voice_label,
        "provider": provider_used,
        "model": model_used,
        "script": script,
        "segments": segments,
        "duration": estimated_duration,
        "audio_url": audio_url,
        "sources": sources,
        "topic": req.topic or "",
    }


@router.get("/api/audio/{audio_id}.mp3")
async def get_audio_file(audio_id: str):
    """Serve a previously-synthesized TTS file."""
    if not re.fullmatch(r"[a-f0-9\-]{8,}", audio_id):
        raise HTTPException(status_code=400, detail="Invalid audio id.")
    path = AUDIO_CACHE_DIR / f"{audio_id}.mp3"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found or expired.")
    return FileResponse(path, media_type="audio/mpeg", filename=f"{audio_id}.mp3")
