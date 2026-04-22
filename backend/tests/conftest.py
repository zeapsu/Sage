"""Shared test fixtures."""
import sys
from pathlib import Path

import pytest

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from store.db import KnowledgeStore


@pytest.fixture
def store():
    """Provide a fresh in-memory KnowledgeStore for each test."""
    db_path = Path("/tmp/sage_test_store.db")
    db_path.unlink(missing_ok=True)
    s = KnowledgeStore(db_path=db_path)
    yield s
    s.close()
    db_path.unlink(missing_ok=True)
