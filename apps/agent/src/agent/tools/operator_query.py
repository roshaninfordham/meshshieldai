from __future__ import annotations
from typing import Callable
from ..store import AgentStore

def make_read_latest_plan(store: AgentStore) -> Callable[[], dict | None]:
    def read_latest_plan() -> dict | None:
        return store.latest_plan()
    return read_latest_plan

def make_read_recent_agent_events(store: AgentStore) -> Callable[[int], list[dict]]:
    def read_recent_agent_events(n: int = 50) -> list[dict]:
        return store.recent_events(n)
    return read_recent_agent_events
