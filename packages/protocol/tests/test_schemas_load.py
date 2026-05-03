import json
from pathlib import Path
import jsonschema

SCHEMAS = Path(__file__).resolve().parent.parent / "schemas"
NAMES = ["sensor-message", "snapshot", "response-plan", "agent-event"]

def test_all_schemas_are_valid_drafts():
    for name in NAMES:
        s = json.loads((SCHEMAS / f"{name}.schema.json").read_text())
        jsonschema.Draft202012Validator.check_schema(s)

def test_sensor_message_example_validates():
    s = json.loads((SCHEMAS / "sensor-message.schema.json").read_text())
    msg = {"v": 1, "node_id": "laptop-01", "ts": 1714680000.123,
           "detections": [{"class": "drone", "conf": 0.91, "bearing_deg": 142.5,
                            "elev_deg": 8.3, "px_box": [320,180,80,60]}]}
    jsonschema.validate(msg, s)

def test_snapshot_example_validates():
    s = json.loads((SCHEMAS / "snapshot.schema.json").read_text())
    snap = {"v": 1, "snapshot_id": "snap-1", "ts": 1.0,
            "tracks": [{"id": "t-1", "origin": "real",
                        "pos_3d": [1.0,2.0,3.0], "vel": [0.1,0.2,0.3],
                        "conf": 0.9, "nearest_asset_m": 50.0}]}
    jsonschema.validate(snap, s)

def test_response_plan_example_validates():
    s = json.loads((SCHEMAS / "response-plan.schema.json").read_text())
    plan = {"v": 1, "plan_id": "plan-1", "snapshot_id": "snap-1", "ts": 2.0,
            "assignments": [{"target_id": "t-1", "interceptor_id": "i-1",
                              "mode": "rf_jam", "priority": 1,
                              "justification": {"snapshot_refs": ["tracks[0].pos_3d"],
                                                 "tavily_refs": [], "policy_refs": ["clause:x"]}}],
            "escalation": {"required": False, "reasons": []}}
    jsonschema.validate(plan, s)

def test_agent_event_example_validates():
    s = json.loads((SCHEMAS / "agent-event.schema.json").read_text())
    for ev in [
        {"kind": "stage_started", "agent": "prioritizer", "ts": 1.0},
        {"kind": "tool_call_started", "agent": "allocator", "tool": "simulate_intercept_path", "args": {}, "ts": 1.0},
        {"kind": "tool_call_finished", "agent": "allocator", "tool": "simulate_intercept_path", "result_summary": "ok", "ms": 142, "ts": 1.0},
        {"kind": "agent_message", "agent": "justifier", "preview": "...", "full_id": "msg-1", "tokens": 220, "ts": 1.0},
        {"kind": "stage_finished", "agent": "escalator", "output_summary": "no escalation", "ms": 700, "ts": 1.0},
        {"kind": "plan_ready", "plan_id": "plan-1", "ts": 1.0},
        {"kind": "escalation_raised", "reason": "ten tracks converging", "ts": 1.0},
        {"kind": "stage_failed", "agent": "prioritizer", "error": "timeout", "ts": 1.0},
    ]:
        jsonschema.validate(ev, s)
