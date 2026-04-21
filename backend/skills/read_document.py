from __future__ import annotations

from .base import Skill, SkillContext, SkillResult
from providers.base import ToolDefinition


class ReadDocumentSkill(Skill):
    @property
    def definition(self) -> ToolDefinition:
        return ToolDefinition(
            name="read_document",
            description="Read the full content of a document from the knowledge base by its ID.",
            parameters={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "The document ID to read",
                    },
                },
                "required": ["document_id"],
            },
        )

    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        doc_id = params["document_id"]
        doc = context.store.get_document(doc_id)
        if not doc:
            return SkillResult(content=f"Document not found: {doc_id}")

        chunks = context.store.get_chunks(doc_id)
        full_text = "\n\n".join(c.content for c in chunks) if chunks else "[No content chunks]"

        return SkillResult(
            content=f"# {doc.title}\n\nSource: {doc.source} ({doc.source_id})\nType: {doc.doc_type}\n\n---\n\n{full_text}",
            data={"document_id": doc_id, "title": doc.title, "source": doc.source},
        )
