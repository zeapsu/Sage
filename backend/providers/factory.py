from __future__ import annotations

from .base import AgentProvider
from .openai_provider import OpenAIProvider
from .ollama_provider import OllamaProvider
from .anthropic_provider import AnthropicProvider


def create_provider(name: str, config: dict) -> AgentProvider:
    if name in ("openai", "deepseek"):
        return OpenAIProvider(
            api_key=config.get("api_key", ""),
            base_url=config.get("base_url"),
        )
    elif name == "ollama":
        return OllamaProvider(
            base_url=config.get("base_url", "http://localhost:11434"),
        )
    elif name == "anthropic":
        return AnthropicProvider(
            api_key=config.get("api_key", ""),
        )
    else:
        raise ValueError(f"Unknown provider: {name}")
