from __future__ import annotations
import asyncio, logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from .store import TrackStore
from .scenario_player import ScenarioPlayer

log = logging.getLogger("fusion.server")

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
