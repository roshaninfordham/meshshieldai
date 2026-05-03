import os, json, asyncio, pytest, time

pytestmark = pytest.mark.live

@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
@pytest.mark.asyncio
async def test_pipeline_end_to_end_against_openrouter():
    from agent.llm.ag2_adapter import LLMAdapter
    from agent.agents.prioritizer import Prioritizer
    snap = {"v":1,"snapshot_id":"snap-live","ts":time.time(),"tracks":[
      {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":40.0}]}
    adapter = LLMAdapter(model="google/gemini-2.5-flash")
    p = Prioritizer(adapter)
    out = await p.run(snap)
    assert out["prioritized"], "expected at least one prioritized target"
