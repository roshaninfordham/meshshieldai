from fastapi.testclient import TestClient
from agent.main import app

def test_nlip_capabilities_endpoint():
    with TestClient(app) as c:
        r = c.get("/nlip/capabilities")
        assert r.status_code == 200
        body = r.json()
        assert "query_current_threats" in body["capabilities"]
        assert "explain_decision" in body["capabilities"]

def test_nlip_chat_round_trip_via_http_fallback():
    with TestClient(app) as c:
        r = c.post("/nlip/chat", json={"format":"text","subformat":"english","content":"Summarize the situation."})
        assert r.status_code == 200
        body = r.json()
        assert body["format"] == "text"
        assert isinstance(body["content"], str)
