from __future__ import annotations

from .openai_provider import OpenAIProvider


class OllamaProvider(OpenAIProvider):
    def __init__(self, base_url: str = "http://localhost:11434", api_key: str = "ollama"):
        super().__init__(api_key=api_key, base_url=f"{base_url}/v1")

    def list_models(self) -> list[str]:
        return ["llama3.1:8b", "llama3.1:70b", "qwen2.5:7b", "mistral:7b", "deepseek-r1:8b"]
