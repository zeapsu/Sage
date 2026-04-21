from __future__ import annotations
from typing import Optional
import numpy as np

_model = None


def get_embedder(model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(model_name, device=device)
    return Embedder(_model)


class Embedder:
    def __init__(self, model):
        self.model = model

    def embed_query(self, text: str) -> np.ndarray:
        return self.model.encode(text, normalize_embeddings=True)

    def embed_chunks(self, texts: list[str]) -> list[np.ndarray]:
        embeddings = self.model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
        return [np.array(e, dtype=np.float32) for e in embeddings]


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks by word count."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start = end - overlap
        if start < 0:
            start = 0
    return chunks
