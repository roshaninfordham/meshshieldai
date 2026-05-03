from __future__ import annotations
import asyncio, logging
from typing import Callable
log = logging.getLogger("agent.scheduler")

class PipelineScheduler:
    def __init__(self, pipeline, snapshot_getter: Callable[[], dict | None], period_s: float = 2.0) -> None:
        self._pipe = pipeline; self._get = snapshot_getter; self._period = period_s
        self._running = False

    def stop(self) -> None: self._running = False

    async def run(self) -> None:
        self._running = True
        while self._running:
            snap = self._get()
            if snap is not None:
                try:
                    await self._pipe.run_tick(snap)
                except Exception:
                    log.exception("pipeline tick failed; holding last-good plan")
            await asyncio.sleep(self._period)
