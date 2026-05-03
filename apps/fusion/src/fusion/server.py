from __future__ import annotations
import asyncio, logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

log = logging.getLogger("fusion.server")

def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "fusion"}

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
