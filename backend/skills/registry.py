from __future__ import annotations

from .base import Skill, SkillContext, SkillResult
from providers.base import ToolDefinition


class SkillRegistry:
    def __init__(self):
        self._skills: dict[str, Skill] = {}

    def register(self, skill: Skill):
        self._skills[skill.definition.name] = skill

    def get_tool_definitions(self) -> list[ToolDefinition]:
        return [s.definition for s in self._skills.values()]

    async def execute(self, name: str, params: dict, context: SkillContext) -> SkillResult:
        skill = self._skills.get(name)
        if not skill:
            return SkillResult(content=f"Error: Unknown skill '{name}'")
        return await skill.execute(params, context)

    def list_skills(self) -> list[str]:
        return list(self._skills.keys())
