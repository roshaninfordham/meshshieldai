import json
from pathlib import Path
from agent.store import AgentStore
from agent.tools.snapshot import make_get_snapshot
from agent.tools.interceptors import make_list_available_interceptors
from agent.tools.policy import make_get_policy_thresholds
from agent.tools.operator_query import make_read_latest_plan, make_read_recent_agent_events

ROOT = Path(__file__).resolve().parents[3]

def test_get_snapshot_returns_store_snapshot():
    store = AgentStore()
    store.set_snapshot({"snapshot_id":"s1","v":1,"ts":1.0,"tracks":[]})
    f = make_get_snapshot(store)
    assert f()["snapshot_id"] == "s1"

def test_list_interceptors_loads_from_scenario():
    f = make_list_available_interceptors(ROOT / "packages/scenarios/data-center-swarm-attack.json")
    out = f()
    assert any(i["id"] == "i-001" for i in out)

def test_policy_loader():
    f = make_get_policy_thresholds(ROOT / "packages/scenarios/policy.json")
    p = f()
    assert p["auto_action_min_conf"] == 0.7
    assert "auto_action_min_conf" in p["clauses"]

def test_operator_query_reads_from_store():
    store = AgentStore()
    store.set_plan({"plan_id":"p1","v":1})
    store.append_event({"kind":"plan_ready","plan_id":"p1","ts":1.0})
    plan_f = make_read_latest_plan(store); ev_f = make_read_recent_agent_events(store)
    assert plan_f()["plan_id"] == "p1"
    assert ev_f(5)[-1]["kind"] == "plan_ready"
