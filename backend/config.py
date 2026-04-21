from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Optional

import yaml

DEFAULT_CONFIG_PATH = Path.home() / ".sage" / "config.yaml"

DEFAULT_CONFIG = {
    "providers": {
        "default": "ollama",
        "ollama": {
            "base_url": "http://localhost:11434",
            "default_model": "llama3.1:8b",
        },
        "openai": {
            "api_key": "${OPENAI_API_KEY}",
            "default_model": "gpt-4o-mini",
        },
        "anthropic": {
            "api_key": "${ANTHROPIC_API_KEY}",
            "default_model": "claude-sonnet-4-20250514",
        },
    },
    "knowledge_store": {
        "path": "~/.sage/knowledge.db",
    },
    "embeddings": {
        "model": "all-MiniLM-L6-v2",
        "device": "cpu",
    },
    "tts": {
        "engine": "piper",
        "default_voice": "en_US-lessac-medium",
    },
    "obsidian": {
        "vault_path": "",
        "sync_interval": 300,
    },
    "ui": {
        "hotkey": "CommandOrControl+Shift+S",
    },
}


def _resolve_env_vars(value: Any) -> Any:
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        env_name = value[2:-1]
        return os.getenv(env_name, "")
    return value


def _resolve_env_recursive(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _resolve_env_recursive(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_resolve_env_recursive(v) for v in obj]
    return _resolve_env_vars(obj)


class SageConfig:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or DEFAULT_CONFIG_PATH
        self._raw: dict = {}
        self._load()

    def _load(self):
        if self.config_path.exists():
            with open(self.config_path) as f:
                self._raw = yaml.safe_load(f) or {}
        else:
            self._raw = {}

        self._config = self._deep_merge(DEFAULT_CONFIG, self._raw)
        self._config = _resolve_env_recursive(self._config)

    def _deep_merge(self, base: dict, override: dict) -> dict:
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    def get(self, dotpath: str, default: Any = None) -> Any:
        keys = dotpath.split(".")
        node = self._config
        for key in keys:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                return default
        return node

    def provider_config(self, name: Optional[str] = None) -> dict:
        name = name or self.get("providers.default", "ollama")
        return self.get(f"providers.{name}", {})

    @property
    def db_path(self) -> Path:
        return Path(os.path.expanduser(self.get("knowledge_store.path", "~/.sage/knowledge.db")))

    def save(self):
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            yaml.dump(self._raw or DEFAULT_CONFIG, f, default_flow_style=False, sort_keys=False)

    def ensure_default_config(self):
        if not self.config_path.exists():
            self.save()
