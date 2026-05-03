from __future__ import annotations


class CassetteLLM:
    def __init__(self, mapping: dict[str, str]) -> None:
        self._m = mapping

    async def ask(self, name: str, prompt: str) -> str:
        key = f"{name}:{prompt}"
        if key not in self._m:
            raise KeyError(f"cassette miss: {key!r}")
        return self._m[key]
