from __future__ import annotations
import math
from typing import Any
from .store import TrackStore

class ScenarioPlayer:
    def __init__(self, store: TrackStore, scenario: dict[str, Any]) -> None:
        self._store = store
        self._scenario = scenario
        self._pos: dict[str, list[float]] = {}
        self._vel: dict[str, list[float]] = {}
        self._spawned: dict[str, float] = {}  # id -> spawn ts
        self._last_t: float = 0.0
        self._asset = scenario["asset"]["center_xyz"]

    def advance_to(self, t: float) -> None:
        # 1) trigger spawns whose t <= t
        for ev in self._scenario["events"]:
            if ev["t"] > t:
                continue
            if "spawn" in ev:
                self._spawn(ev["spawn"], ev["t"])
            elif "burst" in ev:
                b = ev["burst"]
                for k in range(b["count"]):
                    angle = (2 * math.pi * k) / b["count"]
                    x = b["ring_radius_m"] * math.cos(angle)
                    y = b["ring_radius_m"] * math.sin(angle)
                    z = b["altitude_m"]
                    inward = -math.atan2(y, x)
                    vx = b["speed_m_s"] * math.cos(inward + math.pi)
                    vy = b["speed_m_s"] * math.sin(inward + math.pi)
                    tid = f"{b['id_prefix']}{k:02d}"
                    if tid in self._spawned:
                        continue
                    self._spawn({"id": tid, "origin": b.get("origin", "simulated"),
                                 "pos_3d": [x, y, z], "vel": [vx, vy, 0.0], "conf": 0.7}, ev["t"])

        # 2) integrate positions for all spawned tracks up to t
        for tid, pos in self._pos.items():
            spawned_at = self._spawned[tid]
            dt = max(0.0, t - max(self._last_t, spawned_at))
            if dt == 0.0:
                continue
            v = self._vel[tid]
            new = [pos[0] + v[0] * dt, pos[1] + v[1] * dt, pos[2] + v[2] * dt]
            self._pos[tid] = new
            ax, ay, az = self._asset
            d = math.sqrt((new[0] - ax) ** 2 + (new[1] - ay) ** 2 + (new[2] - az) ** 2)
            self._store.upsert({"id": tid,
                                "origin": "simulated" if tid.startswith("t-9") or tid != "t-001" else "real",
                                "pos_3d": new, "vel": v,
                                "conf": self._conf_of(tid),
                                "nearest_asset_m": d})
        self._last_t = t

    def _spawn(self, spawn: dict[str, Any], t: float) -> None:
        tid = spawn["id"]
        self._pos[tid] = list(spawn["pos_3d"])
        self._vel[tid] = list(spawn["vel"])
        self._spawned[tid] = t
        self._conf_cache: dict = getattr(self, "_conf_cache", {})
        self._conf_cache[tid] = float(spawn.get("conf", 0.7))
        ax, ay, az = self._asset
        d = math.sqrt((self._pos[tid][0] - ax) ** 2 + (self._pos[tid][1] - ay) ** 2 + (self._pos[tid][2] - az) ** 2)
        self._store.upsert({"id": tid, "origin": spawn["origin"],
                            "pos_3d": self._pos[tid], "vel": self._vel[tid],
                            "conf": self._conf_cache[tid], "nearest_asset_m": d})

    def _conf_of(self, tid: str) -> float:
        return getattr(self, "_conf_cache", {}).get(tid, 0.7)
