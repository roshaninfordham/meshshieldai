from fastapi.testclient import TestClient
from agent.main import app


def test_health():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200 and r.json() == {"status": "ok", "service": "agent"}
