import json, pytest
from agent.agents.justifier import Justifier
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

ALLOCATIONS = {"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]}
SNAPSHOT = {"snapshot_id":"snap-1","tracks":[{"id":"t-1","nearest_asset_m":40.0,"conf":0.92,"pos_3d":[100,0,30]}]}
POLICY = {"clauses":{"proximity_under_50m":"...", "auto_action_min_conf":"..."}}

def fake_tavily(region, hours): return [{"title":"Q1-2026 incident","url":"https://x/1"}]

@pytest.mark.asyncio
async def test_justifier_attaches_refs_to_each_assignment():
    expected = {"justified":[{
        "target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
        "justification":{
          "snapshot_refs":["tracks[0].nearest_asset_m","tracks[0].conf"],
          "tavily_refs":["headline:Q1-2026 incident"],
          "policy_refs":["clause:proximity_under_50m"]
        }}]}
    cas = CassetteLLM({})
    j = Justifier(LLMAdapter(model="cassette", llm=cas), tavily=fake_tavily,
                  snapshot_provider=lambda: SNAPSHOT, policy_provider=lambda: POLICY,
                  region="us-west")
    prompt = j.build_prompt(ALLOCATIONS, headlines=[{"title":"Q1-2026 incident","url":"https://x/1"}])
    cas._m[f"justifier:{prompt}"] = json.dumps(expected)
    out = await j.run(ALLOCATIONS)
    assert out["justified"][0]["justification"]["policy_refs"] == ["clause:proximity_under_50m"]
