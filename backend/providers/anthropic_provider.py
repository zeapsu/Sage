from __future__ import annotations
import json
import logging
import os
from typing import AsyncIterator, Optional

import httpx

from .base import AgentProvider, AgentResponse, Message, ToolCall, ToolDefinition

logger = logging.getLogger("sage.anthropic")


class AnthropicProvider(AgentProvider):
    BASE_URL = "https://api.anthropic.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        system = ""
        anth_messages = []
        for m in messages:
            if m.role == "system":
                system = m.content
            elif m.role == "tool":
                anth_messages.append({
                    "role": "user",
                    "content": [{"type": "tool_result", "tool_use_id": m.tool_call_id, "content": m.content}],
                })
            elif m.role == "assistant" and m.tool_calls:
                content = []
                if m.content:
                    content.append({"type": "text", "text": m.content})
                for tc in m.tool_calls:
                    content.append({"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.arguments})
                anth_messages.append({"role": "assistant", "content": content})
            else:
                anth_messages.append({"role": m.role, "content": m.content})

        anth_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.parameters}
            for t in tools
        ] if tools else None

        body = {"model": model, "max_tokens": kwargs.get("max_tokens", 4096), "messages": anth_messages}
        if system:
            body["system"] = system
        if anth_tools:
            body["tools"] = anth_tools

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.BASE_URL}/messages",
                headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                json=body,
                timeout=120,
            )
            if resp.status_code != 200:
                logger.error(f"Anthropic API error: {resp.status_code}")
                raise ValueError(f"Anthropic API returned {resp.status_code}")
            try:
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to parse Anthropic response: {str(e)}")
                raise ValueError("Invalid JSON response from Anthropic API")

        content = ""
        tool_calls = []
        for block in data.get("content", []):
            block_type = block.get("type", "")
            if block_type == "text":
                content += block.get("text", "")
            elif block_type == "tool_use":
                try:
                    tool_calls.append(ToolCall(
                        id=block.get("id", ""),
                        name=block.get("name", ""),
                        arguments=block.get("input", {}),
                    ))
                except Exception as e:
                    logger.warning(f"Failed to parse tool_use block: {e}")

        return AgentResponse(content=content, tool_calls=tool_calls, finish_reason=data.get("stop_reason", ""))

    def list_models(self) -> list[str]:
        return ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-35-20241022"]
