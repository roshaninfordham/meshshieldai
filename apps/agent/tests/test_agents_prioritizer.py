import json, pytest
from agent.agents.prioritizer import Prioritizer
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

SNAP = {"v":1,"snapshot_id":"snap-1","ts":1.0,"tracks":[
  {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":120.0},
  {"id":"t-2","origin":"simulated","pos_3d":[50,0,30],"vel":[-5,0,0],"conf":0.45,"nearest_asset_m":40.0},
]}

@pytest.mark.asyncio
async def test_prioritizer_returns_validated_structure():
    expected = {"prioritized":[
        {"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0},
        {"target_id":"t-2","risk_score":0.62,"intent_estimate":"approach_asset","nearest_asset_m":40.0}]}
    cas = CassetteLLM({})
    # build the exact prompt the prioritizer will emit so the cassette matches
    p = Prioritizer(LLMAdapter(model="cassette", llm=cas))
    prompt = p.build_prompt(SNAP)
    cas._m[f"prioritizer:{prompt}"] = json.dumps(expected)
    out = await p.run(SNAP)
    assert out["prioritized"][0]["target_id"] == "t-1"
    assert all("risk_score" in r for r in out["prioritized"])
