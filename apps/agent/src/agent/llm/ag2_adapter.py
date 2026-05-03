from __future__ import annotations

import os
import time
import json
import asyncio
from typing import Callable, Protocol


class _LLMLike(Protocol):
    async def ask(self, name: str, prompt: str) -> str: ...


class _AG2LLM:
    """Real backend that calls AG2 (autogen.beta) via OpenRouter."""

    def __init__(self, model: str, api_key: str | None) -> None:
        from autogen.beta import Agent
        from autogen.beta.config import OpenAIConfig

        self._Agent = Agent
        self._cfg = OpenAIConfig(
            model=model,
            streaming=False,
            api_key=api_key or os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
            max_completion_tokens=1024,
        )
        self._agents: dict[str, object] = {}

    async def ask(self, name: str, prompt: str) -> str:
        if name not in self._agents:
            self._agents[name] = self._Agent(config=self._cfg, name=name)
        reply = await self._agents[name].ask(prompt)
        return reply.body


class LLMAdapter:
    def __init__(
        self,
        model: str,
        llm: _LLMLike | None = None,
        api_key: str | None = None,
        on_lifecycle: Callable[[str, str], None] | None = None,
    ) -> None:
        # Lazy-construct _AG2LLM only when needed; tests pass an llm cassette directly.
        self._llm: _LLMLike = llm if llm is not None else _AG2LLM(model=model, api_key=api_key)
        self._on = on_lifecycle or (lambda kind, agent: None)
        self.model = model

    async def ask(self, agent_name: str, prompt: str) -> str:
        self._on("started", agent_name)
        t0 = time.monotonic()
        try:
            text = await self._llm.ask(agent_name, prompt)
            return text
        finally:
            self._on("finished", agent_name)

    async def ask_json(self, agent_name: str, prompt: str) -> dict:
        text = await self.ask(agent_name, prompt)
        # tolerate fenced code or stray prose by extracting first {...} block
        s = text.find("{")
        e = text.rfind("}")
        if s == -1 or e == -1:
            raise ValueError(f"no JSON in agent output: {text!r}")
        return json.loads(text[s : e + 1])
