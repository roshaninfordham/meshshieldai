import asyncio
import pytest
from agent.event_bus import EventBus
from agent.store import AgentStore


@pytest.mark.asyncio
async def test_bus_persists_and_broadcasts():
    store = AgentStore()
    bus = EventBus(store=store)
    received: list[dict] = []
    q = bus.subscribe()

    async def reader():
        async for ev in q:
            received.append(ev)
            if len(received) == 2:
                return

    bus.emit({"kind": "stage_started", "agent": "prioritizer", "ts": 1.0})
    bus.emit({"kind": "stage_finished", "agent": "prioritizer", "output_summary": "x", "ms": 1, "ts": 2.0})
    await asyncio.wait_for(reader(), timeout=1.0)
    assert [e["kind"] for e in received] == ["stage_started", "stage_finished"]
    assert len(store.recent_events()) == 2
