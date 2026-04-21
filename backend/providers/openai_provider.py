from __future__ import annotations
import json
import os
from typing import AsyncIterator, Optional

from openai import AsyncOpenAI

from .base import AgentProvider, AgentResponse, Message, ToolCall, ToolDefinition


class OpenAIProvider(AgentProvider):
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=base_url,
        )

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolDefinition],
        model: str,
        stream: bool = False,
        **kwargs,
    ) -> AgentResponse | AsyncIterator[str]:
        oai_messages = []
        for m in messages:
            msg = {"role": m.role, "content": m.content}
            if m.tool_calls:
                msg["tool_calls"] = [
                    {"id": tc.id, "type": "function",
                     "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)}}
                    for tc in m.tool_calls
                ]
            elif m.tool_call_id:
                msg["tool_call_id"] = m.tool_call_id
            oai_messages.append(msg)

        oai_tools = [
            {"type": "function", "function": {
                "name": t.name, "description": t.description, "parameters": t.parameters
            }}
            for t in tools
        ] if tools else None

        if stream:
            return self._stream_chat(oai_messages, oai_tools, model, **kwargs)

        response = await self.client.chat.completions.create(
            model=model, messages=oai_messages, tools=oai_tools, **kwargs,
        )
        if not response.choices:
            raise ValueError("No choices returned by OpenAI API")
        choice = response.choices[0]
        tool_calls = []
        if choice.message.tool_calls:
            for tc in choice.message.tool_calls:
                tool_calls.append(ToolCall(
                    id=tc.id, name=tc.function.name,
                    arguments=json.loads(tc.function.arguments),
                ))
        return AgentResponse(
            content=choice.message.content or "",
            tool_calls=tool_calls,
            finish_reason=choice.finish_reason,
        )

    async def _stream_chat(self, messages, tools, model, **kwargs) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=model, messages=messages, tools=tools, stream=True, **kwargs,
        )
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    def list_models(self) -> list[str]:
        return ["gpt-4o", "gpt-4o-mini", "o3-mini"]
