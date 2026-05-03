import json
from fastapi.testclient import TestClient
from agent.main import app


def test_events_ws_replays_recent_then_streams():
    with TestClient(app) as c:
        app.state.bus.emit({"kind": "plan_ready", "plan_id": "p-x", "ts": 0.0})
        with c.websocket_connect("/events") as ws:
            msg = ws.receive_text()
            assert json.loads(msg)["kind"] == "plan_ready"
