import json
from pathlib import Path
from meshshield_protocol import Snapshot

FX = Path(__file__).resolve().parent / "fixtures" / "snapshot.json"

def test_pydantic_roundtrip_preserves_fields():
    raw = json.loads(FX.read_text())
    snap = Snapshot.model_validate(raw)
    out = json.loads(snap.model_dump_json())
    assert out == raw
