from __future__ import annotations
import math
from typing import Callable, Any
import httpx

def _local_sim(track: dict, interceptor: dict) -> dict:
    tx,ty,tz = track["pos_3d"]; vx,vy,vz = track["vel"]
    ix,iy,iz = interceptor["pos_3d"]
    speed = max(1.0, float(interceptor.get("max_speed_m_s", 60.0)))
    # closing-speed approximation: time when |t(t)| minimised against straight-line interceptor pursuit
    rel_d0 = math.sqrt((tx-ix)**2 + (ty-iy)**2 + (tz-iz)**2)
    closing = max(1.0, speed - math.sqrt(vx*vx+vy*vy+vz*vz))
    intercept_ts = rel_d0 / closing
    # crude miss distance assumption
    miss = max(0.0, abs((rel_d0 - speed * intercept_ts)) * 0.1)
    energy = 0.5 * 5.0 * (speed**2)  # 5kg interceptor
    return {"intercept_ts": intercept_ts, "miss_distance_m": miss, "energy_j": energy, "source": "local-fallback"}

def make_simulate_intercept_path(daytona_base_url: str | None,
                                 daytona_api_key: str | None,
                                 timeout_s: float = 1.5) -> Callable[[dict, dict], dict]:
    def simulate_intercept_path(track_state: dict, interceptor_state: dict) -> dict:
        if not daytona_base_url:
            return _local_sim(track_state, interceptor_state)
        try:
            r = httpx.post(
                f"{daytona_base_url.rstrip('/')}/sim",
                json={"track": track_state, "interceptor": interceptor_state},
                headers={"Authorization": f"Bearer {daytona_api_key}"} if daytona_api_key else {},
                timeout=timeout_s,
            )
            r.raise_for_status()
            data = r.json()
            data["source"] = "daytona"
            return data
        except Exception:
            return _local_sim(track_state, interceptor_state)
    return simulate_intercept_path
