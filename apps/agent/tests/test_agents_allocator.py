import json, pytest
from agent.agents.allocator import Allocator
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

PRIORITIZED = {"prioritized":[{"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0}]}
INTERCEPTORS = [{"id":"i-001","kind":"rf_jam","pos_3d":[-50,-10,0],"range_m":250},
                {"id":"i-002","kind":"kinetic","pos_3d":[50,-10,0],"range_m":200}]

def fake_sim(track, interceptor):
    return {"intercept_ts":1.5,"miss_distance_m":3.0,"energy_j":100.0,"source":"local-fallback"}

@pytest.mark.asyncio
async def test_allocator_returns_assignments():
    expected = {"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]}
    cas = CassetteLLM({})
    a = Allocator(LLMAdapter(model="cassette", llm=cas), interceptors=INTERCEPTORS,
                  simulate=fake_sim, snapshot_provider=lambda: {"tracks":[
                      {"id":"t-1","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92}]})
    prompt = a.build_prompt(PRIORITIZED, sim_results={
        "t-1": [{"interceptor_id":"i-001","intercept_ts":1.5,"miss_distance_m":3.0,"source":"local-fallback"},
                {"interceptor_id":"i-002","intercept_ts":1.5,"miss_distance_m":3.0,"source":"local-fallback"}]})
    cas._m[f"allocator:{prompt}"] = json.dumps(expected)
    out = await a.run(PRIORITIZED)
    assert out["allocations"][0]["interceptor_id"] == "i-002"
