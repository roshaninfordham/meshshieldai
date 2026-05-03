from __future__ import annotations
from fastapi import APIRouter, Request

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
