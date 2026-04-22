"""Tests for the KnowledgeStore — Tomes, documents, chunks, dedup, linking."""
import pytest

from store.models import Document, Chunk, Tome, Session, Message


class TestDocumentCRUD:
    def test_add_and_get(self, store):
        doc = Document(title="Test Paper", source="upload", doc_type="pdf", content_hash="abc123")
        store.add_document(doc)
        got = store.get_document(doc.id)
        assert got is not None
        assert got.title == "Test Paper"
        assert got.content_hash == "abc123"

    def test_list_documents(self, store):
        for i in range(3):
            store.add_document(Document(title=f"Doc {i}"))
        docs = store.list_documents()
        assert len(docs) == 3

    def test_delete_document(self, store):
        doc = Document(title="Delete Me")
        store.add_document(doc)
        assert store.delete_document(doc.id) is True
        assert store.get_document(doc.id) is None
        assert store.delete_document(doc.id) is False

    def test_get_document_by_hash_found(self, store):
        doc = Document(title="Hashed", content_hash="sha256:deadbeef")
        store.add_document(doc)
        found = store.get_document_by_hash("sha256:deadbeef")
        assert found is not None
        assert found.id == doc.id

    def test_get_document_by_hash_not_found(self, store):
        assert store.get_document_by_hash("nonexistent") is None


class TestChunks:
    def test_add_and_get_chunks(self, store):
        doc = Document(title="Chunked")
        store.add_document(doc)
        chunks = [
            Chunk(document_id=doc.id, chunk_index=i, content=f"chunk {i}")
            for i in range(3)
        ]
        store.add_chunks(chunks)
        got = store.get_chunks(doc.id)
        assert len(got) == 3
        assert got[0].content == "chunk 0"
        assert got[2].chunk_index == 2

    def test_chunks_cascade_delete(self, store):
        doc = Document(title="Cascade")
        store.add_document(doc)
        store.add_chunks([Chunk(document_id=doc.id, chunk_index=0, content="data")])
        store.delete_document(doc.id)
        assert store.get_chunks(doc.id) == []


class TestTomes:
    def test_create_and_get(self, store):
        tome = store.create_tome("Physics 101", "Intro to physics")
        got = store.get_tome(tome.id)
        assert got is not None
        assert got.name == "Physics 101"
        assert got.description == "Intro to physics"

    def test_list_tomes(self, store):
        store.create_tome("A")
        store.create_tome("B")
        assert len(store.list_tomes()) == 2

    def test_delete_tome(self, store):
        tome = store.create_tome("Delete Me")
        assert store.delete_tome(tome.id) is True
        assert store.get_tome(tome.id) is None

    def test_delete_tome_cascades_sources(self, store):
        tome = store.create_tome("Cascade")
        doc = Document(title="Linked")
        store.add_document(doc)
        store.link_to_tome(tome.id, doc.id)
        store.delete_tome(tome.id)
        # Doc should still exist (we don't cascade to documents)
        assert store.get_document(doc.id) is not None
        # But the link should be gone
        assert store.get_tome_document_ids(tome.id) == []


class TestTomeSourceLinking:
    def test_link_and_list(self, store):
        tome = store.create_tome("My Tome")
        doc1 = Document(title="Doc A")
        doc2 = Document(title="Doc B")
        store.add_document(doc1)
        store.add_document(doc2)
        store.link_to_tome(tome.id, doc1.id)
        store.link_to_tome(tome.id, doc2.id)
        docs = store.get_tome_documents(tome.id)
        assert len(docs) == 2

    def test_link_idempotent(self, store):
        tome = store.create_tome("Tome")
        doc = Document(title="Doc")
        store.add_document(doc)
        store.link_to_tome(tome.id, doc.id)
        store.link_to_tome(tome.id, doc.id)  # duplicate
        assert len(store.get_tome_documents(tome.id)) == 1

    def test_shared_document_across_tomes(self, store):
        """Same document can belong to multiple tomes."""
        tome_a = store.create_tome("Tome A")
        tome_b = store.create_tome("Tome B")
        doc = Document(title="Shared Paper", content_hash="shared123")
        store.add_document(doc)
        store.link_to_tome(tome_a.id, doc.id)
        store.link_to_tome(tome_b.id, doc.id)
        assert len(store.get_tome_documents(tome_a.id)) == 1
        assert len(store.get_tome_documents(tome_b.id)) == 1
        # Reverse lookup
        tomes = store.get_document_tomes(doc.id)
        assert {t.id for t in tomes} == {tome_a.id, tome_b.id}

    def test_unlink(self, store):
        tome = store.create_tome("Tome")
        doc = Document(title="Doc")
        store.add_document(doc)
        store.link_to_tome(tome.id, doc.id)
        store.unlink_from_tome(tome.id, doc.id)
        assert len(store.get_tome_documents(tome.id)) == 0
        # Document still exists
        assert store.get_document(doc.id) is not None

    def test_get_tome_document_ids(self, store):
        tome = store.create_tome("Tome")
        doc = Document(title="Doc")
        store.add_document(doc)
        store.link_to_tome(tome.id, doc.id)
        ids = store.get_tome_document_ids(tome.id)
        assert ids == [doc.id]

    def test_empty_tome(self, store):
        tome = store.create_tome("Empty")
        assert store.get_tome_documents(tome.id) == []
        assert store.get_tome_document_ids(tome.id) == []


class TestDedupWorkflow:
    def test_dedup_prevents_duplicate_storage(self, store):
        """Simulate the ingest dedup flow."""
        content_hash = "sha256:abc"
        # First upload
        existing = store.get_document_by_hash(content_hash)
        assert existing is None
        doc = Document(title="Paper", source="upload", doc_type="pdf", content_hash=content_hash)
        store.add_document(doc)
        store.add_chunks([Chunk(document_id=doc.id, chunk_index=0, content="content")])
        # Second upload with same hash
        existing = store.get_document_by_hash(content_hash)
        assert existing is not None
        assert existing.id == doc.id
        # Just link to new tome instead of re-processing
        tome = store.create_tome("Second Tome")
        store.link_to_tome(tome.id, existing.id)
        assert len(store.get_tome_documents(tome.id)) == 1


class TestSessions:
    def test_create_session_with_tome(self, store):
        tome = store.create_tome("Tome")
        session = store.create_session("ollama", "llama3.1:8b", tome_id=tome.id)
        assert session.tome_id == tome.id
        assert session.provider == "ollama"

    def test_get_tome_session(self, store):
        tome = store.create_tome("Tome")
        store.create_session("ollama", "llama3.1:8b", tome_id=tome.id)
        session = store.get_tome_session(tome.id)
        assert session is not None
        assert session.provider == "ollama"

    def test_no_session_returns_none(self, store):
        tome = store.create_tome("Tome")
        assert store.get_tome_session(tome.id) is None


class TestMessages:
    def test_add_and_get_messages(self, store):
        session = store.create_session("ollama", "llama3.1:8b")
        store.add_message(Message(session_id=session.id, role="user", content="hello"))
        store.add_message(Message(session_id=session.id, role="assistant", content="hi!"))
        msgs = store.get_session_messages(session.id)
        assert len(msgs) == 2
        assert msgs[0].role == "user"
        assert msgs[1].role == "assistant"
