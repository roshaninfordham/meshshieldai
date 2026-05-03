from collections import deque
from typing import Any


class AgentStore:
    def __init__(self, events_capacity: int = 200) -> None:
        self._snapshot: dict | None = None
        self._plan: dict | None = None
        self._events: deque[dict] = deque(maxlen=events_capacity)

    def set_snapshot(self, snap: dict[str, Any]) -> None:
        self._snapshot = snap

    def latest_snapshot(self) -> dict | None:
        return self._snapshot

    def set_plan(self, plan: dict[str, Any]) -> None:
        self._plan = plan

    def latest_plan(self) -> dict | None:
        return self._plan

    def append_event(self, ev: dict[str, Any]) -> None:
        self._events.append(ev)

    def recent_events(self, n: int | None = None) -> list[dict]:
        if n is None:
            return list(self._events)
        return list(self._events)[-n:]
