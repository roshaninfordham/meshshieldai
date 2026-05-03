from __future__ import annotations
import asyncio, json, time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from .nlip.server import router as nlip_router, register_ws


class PolicyBody(BaseModel):
    auto_action_min_conf: float | None = None
    escalate_if_tracks_per_asset_gt: int | None = None


class IntervalBody(BaseModel):
    seconds: float


def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "agent"}

    @app.post("/demo/reset")
    async def demo_reset() -> dict:
        app.state.store.reset()
        return {"status": "reset"}

    # ── Pipeline control ────────────────────────────────────────────────────

    @app.post("/pipeline/pause")
    async def pipeline_pause() -> dict:
        app.state.scheduler.stop()
        return {"paused": True}

    @app.post("/pipeline/resume")
    async def pipeline_resume() -> dict:
        sched = app.state.scheduler
        if not sched._running:
            sched._running = True
            asyncio.get_event_loop().create_task(sched.run())
        return {"resumed": True}

    @app.post("/pipeline/tick")
    async def pipeline_tick() -> dict:
        snap = app.state.store.latest_snapshot()
        if snap is None:
            return {"status": "no_snapshot"}
        plan = await app.state.pipeline.run_tick(snap)
        return {"status": "ok", "plan_id": plan.get("plan_id")}

    @app.post("/pipeline/interval")
    async def pipeline_interval(body: IntervalBody) -> dict:
        app.state.scheduler._period = float(body.seconds)
        return {"interval_s": body.seconds}

    # ── Policy overrides ────────────────────────────────────────────────────

    @app.post("/policy")
    async def set_policy(body: PolicyBody) -> dict:
        overrides = {}
        if body.auto_action_min_conf is not None:
            overrides["auto_action_min_conf"] = body.auto_action_min_conf
        if body.escalate_if_tracks_per_asset_gt is not None:
            overrides["escalate_if_tracks_per_asset_gt"] = body.escalate_if_tracks_per_asset_gt
        app.state.policy_overrides = overrides
        return {"policy_overrides": overrides}

    # ── Kill switch ─────────────────────────────────────────────────────────

    @app.post("/plan/clear")
    async def plan_clear() -> dict:
        plan = {
            "v": 1,
            "plan_id": "manual-override",
            "snapshot_id": "-",
            "ts": time.time(),
            "assignments": [],
            "escalation": {"required": False, "reasons": ["operator KILL SWITCH"]},
        }
        app.state.store.set_plan(plan)
        app.state.bus.emit({"kind": "plan_ready", "plan_id": "manual-override", "plan": plan, "ts": time.time()})
        return {"status": "cleared"}

    # ── WebSocket events ────────────────────────────────────────────────────

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

    app.include_router(nlip_router)
    register_ws(app)
