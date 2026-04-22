"""Search documents skill — semantic search scoped to the active tome."""
from __future__ import annotations
import numpy as np

from .base import Skill, SkillContext, SkillResult
from providers.base import ToolDefinition


class SearchDocsSkill(Skill):
    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="search_docs",
            description="Search the knowledge base for relevant documents using semantic similarity. Scoped to the current tome's sources. Returns the most relevant text chunks with source citations.",
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

        # Scope chunks to the active tome if one is set
        if context.tome_id:
            tome_doc_ids = set(context.store.get_tome_document_ids(context.tome_id))
            if not tome_doc_ids:
                return SkillResult(
                    content="This tome has no sources yet. Add documents first."
                )
            all_chunks = context.store.get_all_chunks_with_embeddings()
            chunks = [c for c in all_chunks if c.document_id in tome_doc_ids]
        else:
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
            lines.append(f'[{i}] "{r["document_title"]}" (chunk {r["chunk_index"]}, similarity: {r["similarity"]:.3f})\n{r["content"]}\n')

        return SkillResult(
            content="\n".join(lines),
            data={"results": top},
        )
