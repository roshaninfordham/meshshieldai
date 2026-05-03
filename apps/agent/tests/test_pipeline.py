import json, pytest
from agent.pipeline import Pipeline
from agent.event_bus import EventBus
from agent.store import AgentStore
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter
from agent.agents.prioritizer import Prioritizer
from agent.agents.allocator import Allocator
from agent.agents.justifier import Justifier
from agent.agents.escalator import Escalator

SNAPSHOT = {"v":1,"snapshot_id":"snap-1","ts":1.0,"tracks":[
    {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":120.0}]}

@pytest.mark.asyncio
async def test_pipeline_emits_full_event_sequence_and_returns_plan():
    cas = CassetteLLM({})
    llm = LLMAdapter(model="cassette", llm=cas)
    store = AgentStore(); store.set_snapshot(SNAPSHOT); bus = EventBus(store=store)

    p = Prioritizer(llm)
    a = Allocator(llm, interceptors=[{"id":"i-002","kind":"kinetic","pos_3d":[0,0,0]}],
                  simulate=lambda t,i:{"intercept_ts":1.5,"miss_distance_m":3.0,"energy_j":1.0,"source":"local-fallback"},
                  snapshot_provider=lambda: SNAPSHOT)
    j = Justifier(llm, tavily=lambda r,h: [], snapshot_provider=lambda: SNAPSHOT,
                  policy_provider=lambda: {"clauses":{"proximity_under_50m":"..."}}, region="us-west")
    e = Escalator(llm, policy_provider=lambda: {"auto_action_min_conf":0.7,"escalate_if_tracks_per_asset_gt":10,"clauses":{}},
                  snapshot_provider=lambda: SNAPSHOT)

    cas._m[f"prioritizer:{p.build_prompt(SNAPSHOT)}"] = json.dumps({"prioritized":[{"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0}]})
    sim_results = {"t-1":[{"interceptor_id":"i-002","intercept_ts":1.5,"miss_distance_m":3.0,"source":"local-fallback"}]}
    cas._m[f"allocator:{a.build_prompt({'prioritized':[{'target_id':'t-1','risk_score':0.84,'intent_estimate':'approach_asset','nearest_asset_m':120.0}]}, sim_results)}"] = json.dumps({"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]})
    just = {"justified":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
                         "justification":{"snapshot_refs":["tracks[0].pos_3d"],"tavily_refs":[],"policy_refs":["clause:proximity_under_50m"]}}]}
    cas._m[f"justifier:{j.build_prompt({'allocations':[{'target_id':'t-1','interceptor_id':'i-002','mode':'kinetic','priority':1}], '_sim_sources':{'t-1':['local-fallback']}}, [])}"] = json.dumps(just)
    plan = {"v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,"assignments":just["justified"],"escalation":{"required":False,"reasons":[]}}
    cas._m[f"escalator:{e.build_prompt(just, {'required': False, 'reasons': []})}"] = json.dumps(plan)

    pipe = Pipeline(prioritizer=p, allocator=a, justifier=j, escalator=e, bus=bus, store=store)
    out = await pipe.run_tick(SNAPSHOT)
    assert out["plan_id"] == "plan-1"
    kinds = [e["kind"] for e in store.recent_events()]
    expected_subseq = ["stage_started","stage_finished","stage_started","stage_finished","stage_started","stage_finished","stage_started","stage_finished","plan_ready"]
    # Filter only the kinds we care about and assert subsequence
    filt = [k for k in kinds if k in {"stage_started","stage_finished","plan_ready"}]
    assert filt[-len(expected_subseq):] == expected_subseq
