from __future__ import annotations
import numpy as np

from .base import Skill, SkillContext, SkillResult
from providers.base import ToolDefinition


class SearchDocsSkill(Skill):
    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_docs",
            description="Search the knowledge base for relevant documents using semantic similarity. Returns the most relevant text chunks with source citations.",
            parameters={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to find relevant content",
                    },
                    "max_results": {
                        "type": "integer",
                        "default": 5,
                        "description": "Maximum number of results to return",
                    },
                },
                "required": ["query"],
            },
        )

    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        from embeddings import get_embedder

        query = params["query"]
        max_results = params.get("max_results", 5)

        embedder = get_embedder()
        query_embedding = embedder.embed_query(query)

        chunks = context.store.get_all_chunks_with_embeddings()
        if not chunks:
            return SkillResult(content="No documents in knowledge base yet. Add documents first.")

        results = []
        for chunk in chunks:
            chunk_emb = np.frombuffer(chunk.embedding, dtype=np.float32)
            similarity = float(np.dot(query_embedding, chunk_emb) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(chunk_emb) + 1e-8
            ))
            doc = context.store.get_document(chunk.document_id)
            results.append({
                "similarity": similarity,
                "content": chunk.content,
                "document_id": chunk.document_id,
                "document_title": doc.title if doc else "Unknown",
                "chunk_index": chunk.chunk_index,
            })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        top = results[:max_results]

        lines = []
        for i, r in enumerate(top, 1):
            lines.append(f"[{i}] \"{r['document_title']}\" (chunk {r['chunk_index']}, similarity: {r['similarity']:.3f})\n{r['content']}\n")

        return SkillResult(
            content="\n".join(lines),
            data={"results": top},
        )
