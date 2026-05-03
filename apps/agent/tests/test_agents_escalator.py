import json, pytest, time
from agent.agents.escalator import Escalator
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

JUSTIFIED = {"justified":[{
    "target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
    "justification":{"snapshot_refs":["tracks[0].nearest_asset_m"],"tavily_refs":[],"policy_refs":["clause:proximity_under_50m"]}
}]}
POLICY = {"auto_action_min_conf":0.7,"escalate_if_tracks_per_asset_gt":10,"clauses":{"auto_action_min_conf":"..."}}

@pytest.mark.asyncio
async def test_escalator_emits_response_plan_with_no_escalation_in_normal_case():
    cas = CassetteLLM({})
    e = Escalator(LLMAdapter(model="cassette", llm=cas),
                  policy_provider=lambda: POLICY,
                  snapshot_provider=lambda: {"snapshot_id":"snap-1","tracks":[{"id":"t-1","conf":0.92,"nearest_asset_m":40.0}]})
    prompt = e.build_prompt(JUSTIFIED, escalation_hint={"required": False, "reasons": []})
    cas._m[f"escalator:{prompt}"] = json.dumps({
        "v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,
        "assignments": JUSTIFIED["justified"],
        "escalation":{"required":False,"reasons":[]}})
    out = await e.run(JUSTIFIED)
    assert out["v"] == 1 and out["plan_id"] == "plan-1"
    assert out["escalation"]["required"] is False

@pytest.mark.asyncio
async def test_escalator_forces_escalation_for_low_conf_track():
    cas = CassetteLLM({})
    snap = {"snapshot_id":"snap-2","tracks":[{"id":"t-1","conf":0.5,"nearest_asset_m":40.0}]}
    e = Escalator(LLMAdapter(model="cassette", llm=cas),
                  policy_provider=lambda: POLICY,
                  snapshot_provider=lambda: snap)
    prompt = e.build_prompt(JUSTIFIED, escalation_hint={"required": True, "reasons": ["track t-1 conf 0.50 < 0.7"]})
    cas._m[f"escalator:{prompt}"] = json.dumps({
        "v":1,"plan_id":"plan-2","snapshot_id":"snap-2","ts":1.0,
        "assignments":[],"escalation":{"required":True,"reasons":["track t-1 conf 0.50 < 0.7"]}})
    out = await e.run(JUSTIFIED)
    assert out["escalation"]["required"] is True
