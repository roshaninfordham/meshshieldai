from fastapi.testclient import TestClient
from fusion.main import app

def test_health_endpoint():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "service": "fusion"}

def test_sensor_ws_accepts_and_drops_messages():
    with TestClient(app) as c, c.websocket_connect("/sensor") as ws:
        ws.send_json({"v":1,"node_id":"laptop-01","ts":0.0,"detections":[]})
        # v1: no echo. We just verify no exception was raised.
