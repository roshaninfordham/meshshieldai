import asyncio, pytest
from agent.scheduler import PipelineScheduler

class _StubPipe:
    def __init__(self): self.calls: list[dict] = []
    async def run_tick(self, snap): self.calls.append(snap); return {"plan_id":"p"}

@pytest.mark.asyncio
async def test_scheduler_uses_freshest_snapshot_each_tick():
    pipe = _StubPipe()
    snapshots = iter([{"snapshot_id":"a"},{"snapshot_id":"b"},{"snapshot_id":"c"}])
    current = {"v": next(snapshots)}
    sched = PipelineScheduler(pipeline=pipe, snapshot_getter=lambda: current["v"], period_s=0.05)
    task = asyncio.create_task(sched.run())
    await asyncio.sleep(0.06); current["v"] = next(snapshots)
    await asyncio.sleep(0.06); current["v"] = next(snapshots)
    await asyncio.sleep(0.06)
    sched.stop(); task.cancel()
    try: await task
    except asyncio.CancelledError: pass
    ids = [c["snapshot_id"] for c in pipe.calls]
    assert ids[0] == "a" and ids[-1] == "c"
