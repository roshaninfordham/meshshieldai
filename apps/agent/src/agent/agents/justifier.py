from __future__ import annotations
import json
from typing import Callable
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Justifier. For each allocation, produce a justification trace that cites: "
"(a) snapshot field paths (e.g. 'tracks[2].pos_3d'), (b) tavily headlines (prefix 'headline:'), and "
"(c) policy clause keys (prefix 'clause:'). Return JSON with key 'justified', a list of allocation "
"objects each carrying a 'justification' object with arrays snapshot_refs, tavily_refs, policy_refs. "
"Output JSON only. "
"Each assignment MUST include at least one snapshot_ref and at least one policy_ref. "
"tavily_refs may be [] if no headlines apply. Never return an assignment with all three arrays empty."
)

class Justifier:
    name = "justifier"
    def __init__(self, llm: LLMAdapter, tavily: Callable[[str,int], list[dict]],
                 snapshot_provider: Callable[[], dict],
                 policy_provider: Callable[[], dict],
                 region: str = "us-west") -> None:
        self._llm = llm; self._tavily = tavily
        self._snap = snapshot_provider; self._policy = policy_provider
        self._region = region

    def build_prompt(self, allocations: dict, headlines: list[dict]) -> str:
        return (f"{SYSTEM}\n\nALLOCATIONS:\n{json.dumps(allocations, separators=(',', ':'))}\n\n"
                f"SNAPSHOT:\n{json.dumps(self._snap(), separators=(',', ':'))}\n\n"
                f"POLICY:\n{json.dumps(self._policy(), separators=(',', ':'))}\n\n"
                f"HEADLINES:\n{json.dumps(headlines, separators=(',', ':'))}")

    async def run(self, allocations: dict) -> dict:
        try: headlines = self._tavily(self._region, 72)
        except Exception: headlines = []
        out = await self._llm.ask_json(self.name, self.build_prompt(allocations, headlines))
        if "justified" not in out:
            raise ValueError(f"justifier output missing 'justified': {out!r}")
        return out
