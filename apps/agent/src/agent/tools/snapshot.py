from __future__ import annotations
from typing import Callable
from ..store import AgentStore

def make_get_snapshot(store: AgentStore) -> Callable[[], dict]:
    def get_snapshot() -> dict:
        snap = store.latest_snapshot()
        if snap is None:
            return {"v":1,"snapshot_id":"none","ts":0.0,"tracks":[]}
        return snap
    return get_snapshot
