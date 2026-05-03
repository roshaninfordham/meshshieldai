from __future__ import annotations
import asyncio, logging, math, time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from .store import TrackStore
from .scenario_player import ScenarioPlayer

log = logging.getLogger("fusion.server")


class InjectBody(BaseModel):
    count: int = 4
    ring_radius_m: float = 280.0


def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "fusion"}

    @app.post("/scenario/reset")
    async def scenario_reset() -> dict:
        # Clear the existing track store
        app.state.store._tracks.clear()
        # Create a fresh ScenarioPlayer with the same scenario dict
        new_player = ScenarioPlayer(app.state.store, app.state.scenario_dict)
        app.state.player = new_player
        # Tell the publisher to swap in the new player and reset its clock
        app.state.publisher.reset(new_player)
        return {"status": "reset"}

    @app.post("/scenario/inject")
    async def scenario_inject(body: InjectBody) -> dict:
        """Immediately spawn a burst of drones at ring_radius_m from the asset."""
        player = app.state.player
        now_t = player._last_t if player._last_t > 0 else 0.0
        asset = player._asset
        speed = 12.0  # m/s inward
        spawned_ids: list[str] = []
        # find a unique prefix for this wave
        wave_idx = sum(1 for k in player._spawned if k.startswith("wave"))
        prefix = f"wave{wave_idx:02d}-t"
        for k in range(body.count):
            angle = (2 * math.pi * k) / body.count
            x = asset[0] + body.ring_radius_m * math.cos(angle)
            y = asset[1] + body.ring_radius_m * math.sin(angle)
            z = asset[2] if len(asset) > 2 else 50.0
            # velocity toward asset
            dx, dy = asset[0] - x, asset[1] - y
            dist = math.sqrt(dx * dx + dy * dy) or 1.0
            vx, vy = dx / dist * speed, dy / dist * speed
            tid = f"{prefix}{k:02d}"
            player._spawn({"id": tid, "origin": "simulated",
                           "pos_3d": [x, y, z], "vel": [vx, vy, 0.0], "conf": 0.75}, now_t)
            spawned_ids.append(tid)
        return {"injected": len(spawned_ids), "ids": spawned_ids}

    @app.websocket("/sensor")
    async def sensor_ws(ws: WebSocket) -> None:
        await ws.accept()
        try:
            while True:
                _ = await ws.receive_json()  # v1: ingestion is a no-op (sensors are sub-projects B/C)
        except WebSocketDisconnect:
            return

    @app.websocket("/snapshot")
    async def snapshot_ws(ws: WebSocket) -> None:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        app.state.subscribers.add(q)
        try:
            while True:
                msg = await q.get()
                await ws.send_text(msg)
        except WebSocketDisconnect:
            return
        finally:
            app.state.subscribers.discard(q)
