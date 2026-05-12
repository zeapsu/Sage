"""Tests for the legacy FastAPI endpoints in main.py.

Covers arXiv search, paper metadata retrieval, PDF download/extraction,
DeepSeek summarization, and cache management.

Closes #26.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """TestClient over the production app with caches cleared and an env-stubbed API key.

    External services (arxiv, pdfplumber, DeepSeek) are NOT auto-mocked here — individual
    tests patch them so we exercise the real request/response wiring of main.app.
    """
    import os
    os.environ.setdefault("DEEPSEEK_API_KEY", "test-key")

    import main

    main.pdf_text_cache.clear()
    main.paper_cache.clear()
    main.summary_cache.clear()
    main.cached_search_papers.cache_clear()
    # Wipe the lru_cache around the DeepSeek dependency so a stale instance from a
    # previous test doesn't leak.
    main.get_deepseek_service.cache_clear()

    with TestClient(main.app) as c:
        yield c


# ── /api/search ────────────────────────────────────────────────

class TestSearchEndpoint:
    def test_search_requires_keyword(self, client):
        resp = client.post("/api/search", json={"keyword": "", "max_results": 5})
        assert resp.status_code == 400
        assert "Keyword is required" in resp.json()["detail"]

    def test_search_returns_papers(self, client):
        import main
        fake = {
            "title": "Attention Is All You Need",
            "authors": ["Vaswani"],
            "summary": "Transformer.",
            "published": "2017-06-12",
            "updated": "2017-06-12",
            "pdf_url": "http://arxiv.org/pdf/1706.03762",
            "entry_id": "http://arxiv.org/abs/1706.03762",
            "doi": None,
        }
        with patch.object(main.arxiv_service, "search_papers", return_value=[fake]):
            resp = client.post(
                "/api/search", json={"keyword": "transformer", "max_results": 1}
            )
        assert resp.status_code == 200
        assert resp.json()["papers"][0]["title"] == "Attention Is All You Need"

    def test_search_caches_results(self, client):
        import main
        mock = MagicMock(return_value=[])
        with patch.object(main.arxiv_service, "search_papers", mock):
            client.post("/api/search", json={"keyword": "same", "max_results": 3})
            client.post("/api/search", json={"keyword": "same", "max_results": 3})
        assert mock.call_count == 1

    def test_search_handles_upstream_error(self, client):
        import main
        with patch.object(
            main.arxiv_service, "search_papers", side_effect=RuntimeError("network down")
        ):
            resp = client.post(
                "/api/search", json={"keyword": "anything", "max_results": 1}
            )
        assert resp.status_code == 500
        assert "network down" in resp.json()["detail"]


# ── /api/paper/{paper_id} ──────────────────────────────────────

class TestGetPaperEndpoint:
    def test_returns_paper(self, client):
        import main
        fake = {"title": "P", "authors": ["A"], "published": "2020-01-01"}
        with patch.object(main.arxiv_service, "get_paper_by_id", return_value=fake):
            resp = client.get("/api/paper/1234.5678")
        assert resp.status_code == 200
        assert resp.json()["title"] == "P"

    def test_caches_paper_metadata(self, client):
        import main
        mock = MagicMock(return_value={"title": "x"})
        with patch.object(main.arxiv_service, "get_paper_by_id", mock):
            client.get("/api/paper/abc")
            client.get("/api/paper/abc")
        assert mock.call_count == 1

    def test_not_found_returns_404(self, client):
        import main
        with patch.object(
            main.arxiv_service, "get_paper_by_id", side_effect=KeyError("missing")
        ):
            resp = client.get("/api/paper/9999.9999")
        assert resp.status_code == 404


# ── /api/paper/{paper_id}/extract ──────────────────────────────

class TestExtractEndpoint:
    def test_returns_extracted_text(self, client):
        import main
        with patch.object(main.arxiv_service, "download_pdf", return_value="/tmp/p.pdf"), \
                patch("main.PDFService.extract_text", return_value="Hello world."):
            resp = client.get("/api/paper/1234.5678/extract")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {
            "paper_id": "1234.5678",
            "text": "Hello world.",
            "pdf_path": "/tmp/p.pdf",
        }

    def test_caches_pdf_text(self, client):
        import main
        extract = MagicMock(return_value="cached")
        with patch.object(main.arxiv_service, "download_pdf", return_value="/tmp/p.pdf"), \
                patch("main.PDFService.extract_text", extract):
            client.get("/api/paper/dup/extract")
            client.get("/api/paper/dup/extract")
        assert extract.call_count == 1

    def test_download_failure_returns_500(self, client):
        import main
        with patch.object(main.arxiv_service, "download_pdf", side_effect=IOError("404")):
            resp = client.get("/api/paper/bad/extract")
        assert resp.status_code == 500


# ── /api/paper/summarize ───────────────────────────────────────

class TestSummarizePaperEndpoint:
    def _override_deepseek(self, app):
        import main
        fake = MagicMock()
        app.dependency_overrides[main.get_deepseek_service] = lambda: fake
        return fake

    def test_summarize_success(self, client):
        import main
        self._override_deepseek(main.app)
        try:
            with patch.object(
                main.arxiv_service, "download_pdf", return_value="/tmp/p.pdf"
            ), patch(
                "main.PDFService.extract_text", return_value="Body."
            ), patch.object(
                main.arxiv_service,
                "get_paper_by_id",
                return_value={
                    "title": "T",
                    "authors": ["A"],
                    "published": "2024-01-01",
                },
            ), patch(
                "main.summarize_text", return_value="Summary."
            ):
                resp = client.post(
                    "/api/paper/summarize",
                    json={"paper_id": "1234.5678", "max_length": 200},
                )
        finally:
            main.app.dependency_overrides.pop(main.get_deepseek_service, None)

        assert resp.status_code == 200
        body = resp.json()
        assert body["summary"] == "Summary."
        assert body["title"] == "T"
        assert body["paper_id"] == "1234.5678"

    def test_empty_summary_returns_500(self, client):
        import main
        self._override_deepseek(main.app)
        try:
            with patch.object(
                main.arxiv_service, "download_pdf", return_value="/tmp/p.pdf"
            ), patch(
                "main.PDFService.extract_text", return_value="text"
            ), patch("main.summarize_text", return_value=None):
                resp = client.post(
                    "/api/paper/summarize",
                    json={"paper_id": "x", "max_length": 100},
                )
        finally:
            main.app.dependency_overrides.pop(main.get_deepseek_service, None)
        assert resp.status_code == 500


# ── /api/keyword/summarize ─────────────────────────────────────

class TestKeywordSummarizeEndpoint:
    def test_requires_keyword(self, client):
        resp = client.post(
            "/api/keyword/summarize",
            json={"keyword": "", "max_results": 1, "max_length": 100},
        )
        assert resp.status_code == 400

    def test_returns_summarized_posts(self, client):
        import main
        main.app.dependency_overrides[main.get_deepseek_service] = lambda: MagicMock()
        fake_paper = {
            "title": "P",
            "authors": ["A"],
            "summary": "s",
            "published": "2024-01-01",
            "updated": "2024-01-01",
            "pdf_url": "u",
            "entry_id": "http://arxiv.org/abs/1.2",
            "doi": None,
        }
        try:
            with patch.object(
                main.arxiv_service, "search_papers", return_value=[fake_paper]
            ), patch(
                "main.process_paper",
                return_value={
                    "paper_id": "1.2",
                    "title": "P",
                    "authors": ["A"],
                    "summary": "S",
                    "published": "2024-01-01",
                    "pdf_url": "u",
                },
            ):
                resp = client.post(
                    "/api/keyword/summarize",
                    json={"keyword": "k", "max_results": 1, "max_length": 100},
                )
        finally:
            main.app.dependency_overrides.pop(main.get_deepseek_service, None)

        assert resp.status_code == 200
        posts = resp.json()["posts"]
        assert len(posts) == 1
        assert posts[0]["summary"] == "S"

    def test_filters_failed_papers(self, client):
        """process_paper returning None for any paper should drop it from the response."""
        import main
        main.app.dependency_overrides[main.get_deepseek_service] = lambda: MagicMock()
        fake_paper = {
            "title": "P",
            "authors": ["A"],
            "summary": "s",
            "published": "2024-01-01",
            "updated": "2024-01-01",
            "pdf_url": "u",
            "entry_id": "http://arxiv.org/abs/1.2",
            "doi": None,
        }
        try:
            with patch.object(
                main.arxiv_service, "search_papers", return_value=[fake_paper, fake_paper]
            ), patch("main.process_paper", side_effect=[None, {"paper_id": "ok"}]):
                resp = client.post(
                    "/api/keyword/summarize",
                    json={"keyword": "k2", "max_results": 2, "max_length": 100},
                )
        finally:
            main.app.dependency_overrides.pop(main.get_deepseek_service, None)
        assert resp.status_code == 200
        assert len(resp.json()["posts"]) == 1


# ── /api/clear-cache ───────────────────────────────────────────

class TestClearCacheEndpoint:
    def test_clears_all_caches(self, client):
        import main
        main.pdf_text_cache["k"] = "v"
        main.paper_cache["k"] = {"t": 1}
        main.summary_cache["k"] = "s"
        resp = client.post("/api/clear-cache")
        assert resp.status_code == 200
        assert main.pdf_text_cache == {}
        assert main.paper_cache == {}
        assert main.summary_cache == {}


# ── / ──────────────────────────────────────────────────────────

class TestRootEndpoint:
    def test_root_message(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert "Sage" in resp.json()["message"]


# ── Service-level unit tests ───────────────────────────────────

class TestPDFService:
    def test_extract_concatenates_pages(self):
        from services.pdf import PDFService
        with patch("services.pdf.pdfplumber.open") as mock_open:
            p1 = MagicMock(); p1.extract_text.return_value = "Page one."
            p2 = MagicMock(); p2.extract_text.return_value = "Page two."
            mock_open.return_value.__enter__.return_value.pages = [p1, p2]
            text = PDFService.extract_text("/tmp/fake.pdf")
        assert "Page one." in text
        assert "Page two." in text

    def test_extract_skips_empty_pages(self):
        from services.pdf import PDFService
        with patch("services.pdf.pdfplumber.open") as mock_open:
            empty = MagicMock(); empty.extract_text.return_value = None
            page = MagicMock(); page.extract_text.return_value = "Real."
            mock_open.return_value.__enter__.return_value.pages = [empty, page]
            text = PDFService.extract_text("/tmp/fake.pdf")
        assert text.strip() == "Real."


class TestDeepSeekService:
    def test_requires_api_key(self, monkeypatch):
        from services.summarizer import DeepSeekService
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        with pytest.raises(ValueError):
            DeepSeekService(api_key=None)

    def test_summarize_calls_openai_client(self):
        from services.summarizer import DeepSeekService
        svc = DeepSeekService(api_key="test-key")
        fake = MagicMock()
        fake.choices = [MagicMock(message=MagicMock(content="A summary."))]
        with patch.object(svc.client.chat.completions, "create", return_value=fake) as create:
            result = svc.summarize_text("paper body", max_length=120)
        assert result == "A summary."
        create.assert_called_once()
        kwargs = create.call_args.kwargs
        assert kwargs["model"] == "deepseek-chat"
        assert any("120" in m["content"] for m in kwargs["messages"])
