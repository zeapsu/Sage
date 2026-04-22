"""Tests for the Tome and Knowledge API endpoints."""
import numpy as np
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from pathlib import Path

from tests.test_app import create_test_app


class FakeEmbedder:
    """Mock embedder that returns random vectors — no ML deps needed."""
    def embed_query(self, text: str) -> np.ndarray:
        rng = np.random.default_rng(hash(text) % 2**32)
        return rng.standard_normal(384).astype(np.float32)

    def embed_chunks(self, texts: list[str]) -> list[np.ndarray]:
        return [self.embed_query(t) for t in texts]


@pytest.fixture
def client():
    """Provide a TestClient with an isolated test database and mocked embeddings."""
    test_db = Path("/tmp/sage_test_api.db")
    test_db.unlink(missing_ok=True)

    app, store = create_test_app(db_path=test_db)

    # Mock the embedder so we don't need sentence_transformers installed
    with patch("api.knowledge.get_embedder", return_value=FakeEmbedder()), \
         patch("api.knowledge.chunk_text", lambda text, **kw: [text[i:i+100] for i in range(0, len(text), 100)]):
        with TestClient(app) as c:
            yield c

    store.close()
    test_db.unlink(missing_ok=True)


class TestTomeEndpoints:
    def test_create_tome(self, client):
        resp = client.post("/api/tomes", json={"name": "Physics", "description": "Quantum stuff"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Physics"
        assert data["description"] == "Quantum stuff"
        assert "id" in data

    def test_list_tomes_empty(self, client):
        resp = client.get("/api/tomes")
        assert resp.status_code == 200
        assert resp.json()["tomes"] == []

    def test_list_tomes_with_data(self, client):
        client.post("/api/tomes", json={"name": "A"})
        client.post("/api/tomes", json={"name": "B"})
        resp = client.get("/api/tomes")
        assert len(resp.json()["tomes"]) == 2

    def test_get_tome(self, client):
        create = client.post("/api/tomes", json={"name": "Test"}).json()
        resp = client.get(f"/api/tomes/{create['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"
        assert resp.json()["sources"] == []
        assert resp.json()["session"] is None

    def test_get_tome_not_found(self, client):
        resp = client.get("/api/tomes/nonexistent")
        assert resp.status_code == 404

    def test_delete_tome(self, client):
        create = client.post("/api/tomes", json={"name": "Delete Me"}).json()
        resp = client.delete(f"/api/tomes/{create['id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True
        assert client.get(f"/api/tomes/{create['id']}").status_code == 404

    def test_link_existing_source(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        ingest = client.post("/api/knowledge/ingest", json={
            "title": "Doc", "content": "content",
        }).json()
        resp = client.post(f"/api/tomes/{tome['id']}/sources", json={
            "document_id": ingest["document_id"],
        })
        assert resp.status_code == 200
        tome_data = client.get(f"/api/tomes/{tome['id']}").json()
        assert len(tome_data["sources"]) == 1

    def test_link_source_not_found(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        resp = client.post(f"/api/tomes/{tome['id']}/sources", json={
            "document_id": "nonexistent",
        })
        assert resp.status_code == 404

    def test_unlink_source(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        ingest = client.post("/api/knowledge/ingest", json={
            "title": "Doc", "content": "content", "tome_id": tome["id"],
        }).json()
        doc_id = ingest["document_id"]
        resp = client.delete(f"/api/tomes/{tome['id']}/sources/{doc_id}")
        assert resp.status_code == 200
        tome_data = client.get(f"/api/tomes/{tome['id']}").json()
        assert len(tome_data["sources"]) == 0

    def test_list_tome_sources(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        client.post("/api/knowledge/ingest", json={
            "title": "Doc A", "content": "aaa", "tome_id": tome["id"],
        })
        client.post("/api/knowledge/ingest", json={
            "title": "Doc B", "content": "bbb", "tome_id": tome["id"],
        })
        resp = client.get(f"/api/tomes/{tome['id']}/sources")
        assert resp.status_code == 200
        assert len(resp.json()["sources"]) == 2

    def test_tome_source_count(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        client.post("/api/knowledge/ingest", json={
            "title": "Doc", "content": "content", "tome_id": tome["id"],
        })
        resp = client.get("/api/tomes")
        assert resp.json()["tomes"][0]["source_count"] == 1

    def test_ingest_links_to_tome(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        client.post("/api/knowledge/ingest", json={
            "title": "Doc", "content": "test content", "tome_id": tome["id"],
        })
        resp = client.get(f"/api/tomes/{tome['id']}")
        assert len(resp.json()["sources"]) == 1
        assert resp.json()["sources"][0]["title"] == "Doc"


class TestIngestDedup:
    def test_dedup_returns_existing(self, client):
        first = client.post("/api/knowledge/ingest", json={
            "title": "Paper", "content": "identical content",
        }).json()
        second = client.post("/api/knowledge/ingest", json={
            "title": "Paper Copy", "content": "identical content",
        }).json()
        assert first["document_id"] == second["document_id"]
        assert second["deduplicated"] is True

    def test_dedup_links_to_tome(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        client.post("/api/knowledge/ingest", json={
            "title": "Paper", "content": "same content",
        })
        second = client.post("/api/knowledge/ingest", json={
            "title": "Paper Copy", "content": "same content", "tome_id": tome["id"],
        }).json()
        assert second["deduplicated"] is True
        tome_data = client.get(f"/api/tomes/{tome['id']}").json()
        assert len(tome_data["sources"]) == 1

    def test_different_content_not_deduped(self, client):
        first = client.post("/api/knowledge/ingest", json={
            "title": "A", "content": "content A",
        }).json()
        second = client.post("/api/knowledge/ingest", json={
            "title": "B", "content": "content B",
        }).json()
        assert first["document_id"] != second["document_id"]
        assert second["deduplicated"] is False


class TestKnowledgeEndpoints:
    def test_list_documents(self, client):
        client.post("/api/knowledge/ingest", json={"title": "Doc", "content": "test"})
        resp = client.get("/api/knowledge/documents")
        assert resp.status_code == 200
        assert len(resp.json()["documents"]) == 1

    def test_get_document_with_tomes(self, client):
        tome = client.post("/api/tomes", json={"name": "Tome"}).json()
        ingest = client.post("/api/knowledge/ingest", json={
            "title": "Doc", "content": "test", "tome_id": tome["id"],
        }).json()
        resp = client.get(f"/api/knowledge/documents/{ingest['document_id']}")
        assert resp.status_code == 200
        assert len(resp.json()["tomes"]) == 1
        assert resp.json()["tomes"][0]["name"] == "Tome"

    def test_delete_document(self, client):
        ingest = client.post("/api/knowledge/ingest", json={
            "title": "Delete", "content": "test",
        }).json()
        resp = client.delete(f"/api/knowledge/documents/{ingest['document_id']}")
        assert resp.status_code == 200
        assert resp.json()["deleted"] is True

    def test_root_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "Sage" in resp.json()["message"]
