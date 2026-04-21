from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from providers.base import AgentProvider, ToolDefinition
from store.db import KnowledgeStore


@dataclass
class SkillResult:
    content: str = ""
    ui_component: Optional[str] = None
    data: dict = field(default_factory=dict)


@dataclass
class SkillContext:
    store: KnowledgeStore
    provider: AgentProvider
    workspace: Path
    config: Any


class Skill(ABC):
    @property
    @abstractmethod
    def definition(self) -> ToolDefinition:
        ...

    @abstractmethod
    async def execute(self, params: dict, context: SkillContext) -> SkillResult:
        ...
