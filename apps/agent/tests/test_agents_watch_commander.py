import pytest
from agent.agents.watch_commander import WatchCommander
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter
from agent.store import AgentStore

@pytest.mark.asyncio
async def test_watch_commander_answers_with_citations():
    store = AgentStore()
    store.set_snapshot({"snapshot_id":"snap-1","ts":1.0,"v":1,"tracks":[
        {"id":"t-13","origin":"real","pos_3d":[10,0,30],"vel":[0,0,0],"conf":0.43,"nearest_asset_m":80.0}]})
    store.set_plan({"v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,"assignments":[],"escalation":{"required":False,"reasons":[]}})
    cas = CassetteLLM({})
    wc = WatchCommander(LLMAdapter(model="cassette", llm=cas), store=store)
    prompt = wc.build_prompt("Why was track T-13 not assigned?")
    cas._m[f"watch_commander:{prompt}"] = "T-13 conf=0.43 below 0.7 threshold [snapshot.tracks[0].conf] [clause:auto_action_min_conf]."
    out = await wc.respond("Why was track T-13 not assigned?")
    assert "0.43" in out
    assert "clause:auto_action_min_conf" in out
