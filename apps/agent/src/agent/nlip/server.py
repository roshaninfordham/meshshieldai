from __future__ import annotations
from fastapi import APIRouter, Request
import cbor2, json
from fastapi import WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/nlip", tags=["nlip"])

CAPABILITIES = ["query_current_threats", "explain_decision", "summarize_situation"]

@router.get("/capabilities")
async def capabilities() -> dict:
    return {"name": "MeshShield Watch Commander",
            "protocol": "ECMA-430",
            "binding_http": "ECMA-431",
            "binding_ws":   "ECMA-432",
            "capabilities": CAPABILITIES}

@router.post("/chat")
async def chat(req: Request) -> dict:
    body = await req.json()
    if body.get("format") != "text":
        return {"format":"text","subformat":"english","content":"Unsupported format; only 'text' is implemented."}
    question = body.get("content","")
    wc = req.app.state.watch_commander
    answer = await wc.respond(question)
    return {"format":"text","subformat":"english","content": answer}

async def _handle_one_frame(ws: WebSocket, watch_commander, payload, is_binary: bool):
    try:
        body = cbor2.loads(payload) if is_binary else json.loads(payload)
    except Exception:
        body = {"format":"text","subformat":"english","content":""}
    question = body.get("content","")
    answer = await watch_commander.respond(question)
    out = {"format":"text","subformat":"english","content": answer}
    if is_binary:
        await ws.send_bytes(cbor2.dumps(out))
    else:
        await ws.send_text(json.dumps(out))

def register_ws(app) -> None:
    @app.websocket("/nlip")
    async def nlip_ws(ws: WebSocket):
        await ws.accept(subprotocol="nlip.v1")
        wc = ws.app.state.watch_commander
        try:
            while True:
                msg = await ws.receive()
                if msg.get("type") != "websocket.receive":
                    return
                if "bytes" in msg and msg["bytes"] is not None:
                    await _handle_one_frame(ws, wc, msg["bytes"], is_binary=True)
                elif "text" in msg and msg["text"] is not None:
                    await _handle_one_frame(ws, wc, msg["text"], is_binary=False)
        except WebSocketDisconnect:
            return
