from __future__ import annotations
import json
from typing import Callable
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Interceptor Allocator. Given prioritized targets, available interceptors, and "
"simulated intercept results per (target, interceptor), choose one assignment per high-priority target. "
"Return JSON with key 'allocations', a list of objects with keys: target_id, interceptor_id, mode "
"(one of kinetic|rf_jam|spoof|monitor), priority (integer >=1). Output JSON only."
)

class Allocator:
    name = "allocator"
    def __init__(self, llm: LLMAdapter, interceptors: list[dict],
                 simulate: Callable[[dict, dict], dict],
                 snapshot_provider: Callable[[], dict]) -> None:
        self._llm = llm
        self._interceptors = interceptors
        self._sim = simulate
        self._snap = snapshot_provider

    def _track_state(self, target_id: str) -> dict | None:
        snap = self._snap() or {"tracks": []}
        return next((t for t in snap.get("tracks", []) if t["id"] == target_id), None)

    def build_prompt(self, prioritized: dict, sim_results: dict) -> str:
        return (f"{SYSTEM}\n\nPRIORITIZED:\n{json.dumps(prioritized, separators=(',', ':'))}\n\n"
                f"INTERCEPTORS:\n{json.dumps(self._interceptors, separators=(',', ':'))}\n\n"
                f"SIMULATIONS:\n{json.dumps(sim_results, separators=(',', ':'))}")

    async def run(self, prioritized: dict) -> dict:
        sim_results: dict[str, list[dict]] = {}
        for row in prioritized.get("prioritized", []):
            tid = row["target_id"]
            track = self._track_state(tid) or {"id": tid, "pos_3d":[0,0,0], "vel":[0,0,0]}
            sim_results[tid] = []
            for itc in self._interceptors:
                r = self._sim(track, {**itc, "max_speed_m_s": 80})
                sim_results[tid].append({"interceptor_id": itc["id"],
                                         "intercept_ts": r["intercept_ts"],
                                         "miss_distance_m": r["miss_distance_m"],
                                         "source": r.get("source", "local-fallback")})
        out = await self._llm.ask_json(self.name, self.build_prompt(prioritized, sim_results))
        if "allocations" not in out:
            raise ValueError(f"allocator output missing 'allocations': {out!r}")
        # surface fallback usage so the UI can badge
        out["_sim_sources"] = {tid: list({r["source"] for r in rows}) for tid, rows in sim_results.items()}
        return out
