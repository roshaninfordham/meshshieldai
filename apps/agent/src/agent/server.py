from __future__ import annotations
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect


def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "agent"}

    @app.websocket("/events")
    async def events_ws(ws: WebSocket) -> None:
        await ws.accept()
        sub = app.state.bus.subscribe()
        try:
            async for ev in sub:
                await ws.send_text(json.dumps(ev))
        except WebSocketDisconnect:
            return
        finally:
            app.state.bus.unsubscribe(sub)
