from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict  # JSON Schema


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict


@dataclass
class Message:
    role: str  # 'user', 'assistant', 'tool'
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_call_id: Optional[str] = None


@dataclass
class AgentResponse:
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = ""  # 'stop', 'tool_calls', 'length'


class AgentProvider(ABC):
    @abstractmethod
    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        ...

    @abstractmethod
    def list_models(self) -> list[str]:
        ...
