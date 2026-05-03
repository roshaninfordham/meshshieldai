import json
from fastapi.testclient import TestClient
from agent.main import app

def test_nlip_ws_text_frame_round_trip():
    with TestClient(app) as c, c.websocket_connect("/nlip") as ws:
        ws.send_text(json.dumps({"format":"text","subformat":"english","content":"Why was T-13 not assigned?"}))
        msg = ws.receive_text()
        body = json.loads(msg)
        assert body["format"] == "text"
        assert isinstance(body["content"], str)

def test_nlip_ws_cbor_round_trip():
    import cbor2
    with TestClient(app) as c, c.websocket_connect("/nlip") as ws:
        ws.send_bytes(cbor2.dumps({"format":"text","subformat":"english","content":"Summarize."}))
        msg = ws.receive_bytes()
        body = cbor2.loads(msg)
        assert body["format"] == "text" and isinstance(body["content"], str)
