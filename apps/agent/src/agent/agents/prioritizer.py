from __future__ import annotations
import json
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Threat Prioritizer. Given an airspace snapshot, return a JSON object "
"with the exact key 'prioritized', a list of objects sorted by risk_score descending, each having "
"keys target_id (string), risk_score (number 0-1), intent_estimate (string in approach_asset|loiter|withdraw|unknown), "
"nearest_asset_m (number). Output JSON only, no prose."
)

class Prioritizer:
    name = "prioritizer"
    def __init__(self, llm: LLMAdapter) -> None: self._llm = llm

    def build_prompt(self, snapshot: dict) -> str:
        return f"{SYSTEM}\n\nSNAPSHOT:\n{json.dumps(snapshot, separators=(',', ':'))}"

    async def run(self, snapshot: dict) -> dict:
        out = await self._llm.ask_json(self.name, self.build_prompt(snapshot))
        if "prioritized" not in out or not isinstance(out["prioritized"], list):
            raise ValueError(f"prioritizer output missing 'prioritized': {out!r}")
        return out
