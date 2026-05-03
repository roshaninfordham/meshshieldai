from __future__ import annotations
import asyncio, time
from typing import Callable
from .store import TrackStore
from .scenario_player import ScenarioPlayer

Sink = Callable[[str], None]  # receives serialized JSON

class SnapshotPublisher:
    def __init__(self, store: TrackStore, player: ScenarioPlayer, hz: int = 10,
                 sinks: list[Sink] | None = None) -> None:
        self._store = store
        self._player = player
        self._period = 1.0 / hz
        self._sinks: list[Sink] = sinks or []
        self._running = False
        self._counter = 0
        self._reset_flag = False

    def add_sink(self, sink: Sink) -> None:
        self._sinks.append(sink)

    def stop(self) -> None:
        self._running = False

    def reset(self, new_player: ScenarioPlayer) -> None:
        """Swap in a fresh ScenarioPlayer and reset counter + clock.
        The run loop picks this up at the next iteration."""
        self._player = new_player
        self._counter = 0
        self._reset_flag = True

    async def run(self) -> None:
        self._running = True
        start = time.monotonic()
        next_due = start
        while self._running:
            if self._reset_flag:
                self._reset_flag = False
                start = time.monotonic()
                next_due = start
            now = time.monotonic()
            t_rel = now - start
            self._player.advance_to(t_rel)
            self._counter += 1
            snap = self._store.snapshot(snapshot_id=f"snap-{self._counter:05d}", ts=now)
            payload = snap.model_dump_json()
            for s in list(self._sinks):
                try:
                    s(payload)
                except Exception:
                    pass
            next_due += self._period
            sleep = next_due - time.monotonic()
            if sleep > 0:
                await asyncio.sleep(sleep)
