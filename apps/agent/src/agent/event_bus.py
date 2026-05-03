from __future__ import annotations
import asyncio
from typing import AsyncIterator
from .store import AgentStore


class _Subscription:
    def __init__(self, q: asyncio.Queue) -> None:
        self._q = q

    def __aiter__(self) -> AsyncIterator[dict]:
        return self

    async def __anext__(self) -> dict:
        return await self._q.get()


class EventBus:
    def __init__(self, store: AgentStore) -> None:
        self._store = store
        self._queues: set[asyncio.Queue] = set()

    def emit(self, event: dict) -> None:
        self._store.append_event(event)
        for q in list(self._queues):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass

    def subscribe(self) -> _Subscription:
        q: asyncio.Queue = asyncio.Queue(maxsize=512)
        # replay recent events so a late subscriber gets context
        for ev in self._store.recent_events(50):
            try:
                q.put_nowait(ev)
            except asyncio.QueueFull:
                break
        self._queues.add(q)
        return _Subscription(q)

    def unsubscribe(self, sub: _Subscription) -> None:
        self._queues.discard(sub._q)
