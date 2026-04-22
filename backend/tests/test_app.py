"""Lightweight FastAPI app for testing — only new Sage API, no legacy deps."""
from __future__ import annotations
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import chat, knowledge, skills as skills_api, tomes as tomes_api
from config import SageConfig
from skills.read_document import ReadDocumentSkill
from skills.registry import SkillRegistry
from skills.search_docs import SearchDocsSkill
from store.db import KnowledgeStore


def create_test_app(db_path: Optional[Path] = None) -> tuple[FastAPI, KnowledgeStore]:
    """Create a test app with an isolated database."""
    store = KnowledgeStore(db_path=db_path or Path("/tmp/sage_test_app.db"))
    config = SageConfig()
    config.ensure_default_config()

    skill_registry = SkillRegistry()
    skill_registry.register(SearchDocsSkill())
    skill_registry.register(ReadDocumentSkill())

    app = FastAPI(title="Sage API (Test)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.dependency_overrides[KnowledgeStore] = lambda: store
    app.dependency_overrides[SkillRegistry] = lambda: skill_registry
    app.dependency_overrides[SageConfig] = lambda: config

    app.include_router(knowledge.router)
    app.include_router(chat.router)
    app.include_router(tomes_api.router)
    app.include_router(skills_api.router)

    @app.get("/")
    def root():
        return {"message": "Welcome to the Sage API!"}

    return app, store
