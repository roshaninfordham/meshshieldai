from __future__ import annotations
import asyncio, json, logging
import websockets
from .store import AgentStore

log = logging.getLogger("agent.snapshot_subscriber")


class SnapshotSubscriber:
    def __init__(self, url: str, store: AgentStore) -> None:
        self._url = url
        self._store = store
        self._running = False

    def stop(self) -> None:
        self._running = False

    async def run(self) -> None:
        self._running = True
        backoff = 0.5
        while self._running:
            try:
                async with websockets.connect(self._url) as ws:
                    backoff = 0.5
                    async for raw in ws:
                        if not self._running:
                            return
                        try:
                            self._store.set_snapshot(json.loads(raw))
                        except Exception:
                            log.exception("snapshot decode failed")
            except Exception:
                if not self._running:
                    return
                log.warning("snapshot subscriber reconnect in %.1fs", backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5.0)
