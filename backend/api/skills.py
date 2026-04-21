"""Skills API endpoints."""
from fastapi import APIRouter, Depends

from skills.registry import SkillRegistry

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("")
async def list_skills(skills: SkillRegistry = Depends()):
    return {
        "skills": [
            {"name": d.name, "description": d.description, "parameters": d.parameters}
            for d in skills.get_tool_definitions()
        ]
    }
