from __future__ import annotations

import os
import re
import time
import json
import logging
import asyncio
from typing import Callable, Protocol

log = logging.getLogger("agent.llm")


class _LLMLike(Protocol):
    async def ask(self, name: str, prompt: str) -> str: ...


class _AG2LLM:
    """Real backend that calls AG2 (autogen.beta) via OpenRouter."""

    def __init__(self, model: str, api_key: str | None) -> None:
        self._model = model
        self._api_key = api_key
        self._cfg = None
        self._Agent = None
        self._agents: dict[str, object] = {}
        self._stubbed = False

    def _ensure_loaded(self) -> None:
        if self._cfg is not None or self._stubbed:
            return
        key = self._api_key or os.environ.get("OPENROUTER_API_KEY")
        if not key:
            self._stubbed = True
            return
        from autogen.beta import Agent
        from autogen.beta.config import OpenAIConfig
        self._Agent = Agent
        self._cfg = OpenAIConfig(
            model=self._model,
            streaming=False,
            api_key=key,
            base_url="https://openrouter.ai/api/v1",
            max_completion_tokens=4096,
        )

    async def ask(self, name: str, prompt: str) -> str:
        self._ensure_loaded()
        if self._stubbed:
            return "(stub: OPENROUTER_API_KEY not set)"
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
        return _extract_json(text, agent_name)


_FENCE = re.compile(r"```(?:json|JSON)?\s*([\s\S]*?)\s*```")


def _extract_json(text: str, agent_name: str = "?") -> dict:
    """Robustly extract a JSON object from LLM output that may include prose,
    markdown fences, or trailing commentary. Strategy:
      1. If ```json ... ``` (or plain ```...```) fences exist, take the largest
         fenced block and try to parse it.
      2. Otherwise, scan for the first balanced {...} block and parse that.
    Raises ValueError with the raw text on any failure (so logs are useful)."""
    candidates: list[str] = []
    for m in _FENCE.finditer(text):
        candidates.append(m.group(1).strip())
    candidates.sort(key=len, reverse=True)
    for c in candidates:
        try:
            return json.loads(c)
        except json.JSONDecodeError:
            continue

    block = _first_balanced_object(text)
    if block is not None:
        try:
            return json.loads(block)
        except json.JSONDecodeError as exc:
            log.warning("agent=%s ask_json failed on balanced block (%s); raw head=%r",
                        agent_name, exc, text[:240])

    raise ValueError(f"no parseable JSON in agent={agent_name} output: {text[:400]!r}")


def _first_balanced_object(text: str) -> str | None:
    depth = 0
    start = -1
    in_str = False
    esc = False
    for i, ch in enumerate(text):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            continue
        if ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth == 0:
                continue
            depth -= 1
            if depth == 0 and start != -1:
                return text[start : i + 1]
    return None
