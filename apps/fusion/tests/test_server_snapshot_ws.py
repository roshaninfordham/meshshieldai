import json
from fastapi.testclient import TestClient
from fusion.main import app

def test_snapshot_ws_streams_payloads():
    with TestClient(app) as c, c.websocket_connect("/snapshot") as ws:
        msg = ws.receive_text()
        snap = json.loads(msg)
        assert snap["v"] == 1
        assert "snapshot_id" in snap
        assert isinstance(snap["tracks"], list)
