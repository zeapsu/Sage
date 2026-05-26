"""Tests for generated artifact and audio endpoints."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from providers.base import AgentResponse
from store.models import Chunk, Document
from tests.test_app import create_test_app


class FakeProvider:
    async def chat(self, messages, tools, model, stream=False, **kwargs):
        prompt = messages[-1].content
        if "flashcards" in prompt.lower():
            return AgentResponse(content=json.dumps({
                "cards": [{"front": "What is Sage?", "back": "A local-first knowledge agent."}]
            }))
        if "multiple-choice" in messages[0].content.lower():
            return AgentResponse(content=json.dumps({
                "questions": [{
                    "question": "What is Sage?",
                    "options": [
                        {"id": "a", "text": "A database"},
                        {"id": "b", "text": "A local-first knowledge agent"},
                        {"id": "c", "text": "A browser"},
                        {"id": "d", "text": "A font"},
                    ],
                    "correctOptionId": "b",
                    "explanation": "The source says Sage is a local-first knowledge agent.",
                }]
            }))
        if "structured study reports" in messages[0].content.lower():
            return AgentResponse(content=json.dumps({
                "title": "Sage Overview",
                "subtitle": "A grounded study report",
                "sections": [
                    {
                        "title": "Executive Summary",
                        "content": "Sage is a local-first knowledge agent for studying documents.",
                    },
                    {
                        "title": "Grounding",
                        "content": "Generated artifacts should stay grounded in the knowledge base.",
                    },
                ],
            }))
        if "narration" in messages[0].content.lower():
            return AgentResponse(content="Sage is a local-first knowledge agent. It keeps answers grounded.")
        return AgentResponse(content="{}")

    def list_models(self):
        return ["fake-model"]


def client_with_seeded_kb():
    test_db = Path("/tmp/sage_test_generation_api.db")
    test_db.unlink(missing_ok=True)
    app, store = create_test_app(db_path=test_db)
    doc = Document(title="Sage Notes")
    store.add_document(doc)
    store.add_chunks([
        Chunk(
            document_id=doc.id,
            chunk_index=0,
            content="Sage is a local-first knowledge agent for studying your documents.",
            embedding=b"fake-embedding",
        )
    ])
    return app, store, test_db


def test_flashcards_endpoint_uses_fake_provider_and_returns_sources():
    app, store, test_db = client_with_seeded_kb()
    try:
        with patch("api.generate.create_provider", return_value=FakeProvider()):
            with TestClient(app) as client:
                resp = client.post("/api/generate/flashcards", json={"count": 1, "provider": "fake"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["cards"][0]["front"] == "What is Sage?"
        assert data["sources"][0]["document_title"] == "Sage Notes"
    finally:
        store.close()
        test_db.unlink(missing_ok=True)


def test_quiz_endpoint_uses_fake_provider_and_returns_contract_shape():
    app, store, test_db = client_with_seeded_kb()
    try:
        with patch("api.generate.create_provider", return_value=FakeProvider()):
            with TestClient(app) as client:
                resp = client.post("/api/generate/quiz", json={"count": 1, "provider": "fake"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["questions"][0]["question"] == "What is Sage?"
        assert data["questions"][0]["correctOptionId"] == "b"
        assert data["questions"][0]["options"] == [
            {"id": "a", "text": "A database"},
            {"id": "b", "text": "A local-first knowledge agent"},
            {"id": "c", "text": "A browser"},
            {"id": "d", "text": "A font"},
        ]
        assert data["sources"][0]["document_title"] == "Sage Notes"
    finally:
        store.close()
        test_db.unlink(missing_ok=True)


def test_report_endpoint_uses_fake_provider_and_returns_contract_shape():
    app, store, test_db = client_with_seeded_kb()
    try:
        with patch("api.generate.create_provider", return_value=FakeProvider()):
            with TestClient(app) as client:
                resp = client.post("/api/generate/report", json={"provider": "fake"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Sage Overview"
        assert data["subtitle"] == "A grounded study report"
        assert data["toc"] == [
            {"id": "executive-summary", "title": "Executive Summary"},
            {"id": "grounding", "title": "Grounding"},
        ]
        assert "## Executive Summary" in data["content"]
        assert "Report generated by Sage" in data["content"]
        assert data["sourceDocs"] == "Based on 1 document in your knowledge base"
        assert data["sources"][0]["document_title"] == "Sage Notes"
    finally:
        store.close()
        test_db.unlink(missing_ok=True)


def test_audio_endpoint_returns_browser_fallback_without_openai_tts():
    app, store, test_db = client_with_seeded_kb()
    try:
        with patch("api.generate.create_provider", return_value=FakeProvider()), \
             patch("api.audio._maybe_synthesize_openai_tts", return_value=(None, None)):
            with TestClient(app) as client:
                resp = client.post("/api/generate/audio", json={"provider": "fake"})

        assert resp.status_code == 200
        data = resp.json()
        assert data["voice"] == "Browser"
        assert data["audio_url"] is None
        assert data["segments"]
        assert "local-first knowledge agent" in data["script"]
    finally:
        store.close()
        test_db.unlink(missing_ok=True)
