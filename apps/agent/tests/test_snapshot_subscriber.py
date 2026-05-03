import asyncio, json
from contextlib import asynccontextmanager
import pytest
import websockets
from agent.snapshot_subscriber import SnapshotSubscriber
from agent.store import AgentStore


@asynccontextmanager
async def fake_fusion(port: int):
    async def handler(ws):
        await ws.send(json.dumps({"v": 1, "snapshot_id": "snap-test", "ts": 0.1, "tracks": []}))
        await asyncio.sleep(0.5)

    server = await websockets.serve(handler, "localhost", port)
    try:
        yield f"ws://localhost:{port}"
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_subscriber_writes_to_store():
    store = AgentStore()
    async with fake_fusion(18811) as base:
        sub = SnapshotSubscriber(url=f"{base}/snapshot", store=store)
        task = asyncio.create_task(sub.run())
        await asyncio.sleep(0.2)
        sub.stop()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        assert store.latest_snapshot()["snapshot_id"] == "snap-test"
