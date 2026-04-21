"""Agent orchestrator — manages the tool-calling conversation loop."""
from __future__ import annotations
import logging
from typing import AsyncIterator

from providers.base import AgentProvider, Message
from skills.base import SkillContext, SkillResult
from skills.registry import SkillRegistry
from store.db import KnowledgeStore

logger = logging.getLogger("sage.orchestrator")


class AgentOrchestrator:
    def __init__(
        self,
        provider: AgentProvider,
        model: str,
        store: KnowledgeStore,
        skills: SkillRegistry,
        skill_context: SkillContext,
        max_tool_rounds: int = 10,
    ):
        self.provider = provider
        self.model = model
        self.store = store
        self.skills = skills
        self.skill_context = skill_context
        self.max_tool_rounds = max_tool_rounds

    async def run(self, messages: list[Message]) -> str:
        """Run the agent loop until the model stops calling tools."""
        tool_defs = self.skills.get_tool_definitions()
        conversation = list(messages)

        for _ in range(self.max_tool_rounds):
            response = await self.provider.chat(
                messages=conversation,
                tools=tool_defs,
                model=self.model,
            )

            conversation.append(Message(
                role="assistant",
                content=response.content,
                tool_calls=response.tool_calls,
            ))

            if response.finish_reason == "stop" or not response.tool_calls:
                return response.content

            for tc in response.tool_calls:
                logger.info(f"Executing tool: {tc.name} with args: {tc.arguments}")
                try:
                    result = await self.skills.execute(tc.name, tc.arguments, self.skill_context)
                except Exception as e:
                    logger.error(f"Tool execution failed: {tc.name} - {str(e)}")
                    result = SkillResult(content=f"Error: Tool '{tc.name}' execution failed")
                conversation.append(Message(
                    role="tool",
                    content=result.content,
                    tool_call_id=tc.id,
                ))

        last_content = conversation[-1].content if conversation and conversation[-1].content else ""
        return "Maximum tool rounds reached. Here's what I have so far:\n" + last_content

    async def run_streaming(self, messages: list[Message]) -> AsyncIterator[str]:
        """Run with streaming text output. Tool calls block until resolved."""
        tool_defs = self.skills.get_tool_definitions()
        conversation = list(messages)

        for _ in range(self.max_tool_rounds):
            response = await self.provider.chat(
                messages=conversation,
                tools=tool_defs,
                model=self.model,
            )

            if response.tool_calls:
                conversation.append(Message(
                    role="assistant", content=response.content, tool_calls=response.tool_calls,
                ))
                for tc in response.tool_calls:
                    yield f"\n🔧 *Running {tc.name}...*\n"
                    try:
                        result = await self.skills.execute(tc.name, tc.arguments, self.skill_context)
                    except Exception as e:
                        logger.error(f"Tool execution failed: {tc.name} - {str(e)}")
                        result = SkillResult(content=f"Error: Tool '{tc.name}' execution failed")
                    conversation.append(Message(role="tool", content=result.content, tool_call_id=tc.id))
                continue

            stream = await self.provider.chat(
                messages=conversation, tools=tool_defs, model=self.model, stream=True,
            )
            async for chunk in stream:
                yield chunk
            return

        yield "\n⚠️ Maximum tool rounds reached."
