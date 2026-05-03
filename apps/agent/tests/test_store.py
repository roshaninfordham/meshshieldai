from agent.store import AgentStore


def test_store_latest_snapshot_and_plan():
    s = AgentStore(events_capacity=10)
    s.set_snapshot({"snapshot_id": "s-1", "ts": 1.0, "v": 1, "tracks": []})
    assert s.latest_snapshot()["snapshot_id"] == "s-1"
    s.set_plan({"plan_id": "p-1", "v": 1})
    assert s.latest_plan()["plan_id"] == "p-1"


def test_store_events_ring_buffer_caps():
    s = AgentStore(events_capacity=3)
    for i in range(5):
        s.append_event(
            {
                "kind": "agent_message",
                "ts": float(i),
                "agent": "prioritizer",
                "preview": str(i),
            }
        )
    evs = s.recent_events()
    assert len(evs) == 3
    assert [e["preview"] for e in evs] == ["2", "3", "4"]
