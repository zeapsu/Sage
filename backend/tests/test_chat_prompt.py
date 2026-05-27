"""Tests for Sage chat capability guidance."""
from __future__ import annotations

from api.chat import SYSTEM_PROMPT


def test_system_prompt_guides_explicit_slash_commands_only():
    prompt = SYSTEM_PROMPT.lower()

    assert "/quiz" in prompt
    assert "/flashcards" in prompt
    assert "/audio" in prompt
    assert "/report" in prompt
    assert "/history" in prompt
    assert "/tomes" in prompt
    assert "/sources" in prompt

    assert "routes prompts containing certain keywords" not in prompt
    assert '"history" → opens' not in prompt
    assert '"summary" → opens' not in prompt
    assert "normal natural-language questions stay in chat" in prompt
