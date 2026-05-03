import asyncio, json
from pathlib import Path
from fusion.store import TrackStore
from fusion.scenario_player import ScenarioPlayer
from fusion.snapshot_publisher import SnapshotPublisher

ROOT = Path(__file__).resolve().parents[3]
SCENARIO = json.loads((ROOT / "packages/scenarios/data-center-swarm-attack.json").read_text())

async def test_publisher_emits_at_target_rate():
    store = TrackStore()
    player = ScenarioPlayer(store, SCENARIO)
    out: list[str] = []
    pub = SnapshotPublisher(store=store, player=player, hz=10, sinks=[lambda s: out.append(s)])
    task = asyncio.create_task(pub.run())
    await asyncio.sleep(0.55)
    pub.stop()
    await task
    # ~5 snapshots in 550ms at 10Hz, allow margin
    assert 4 <= len(out) <= 7
    first = json.loads(out[0])
    assert first["v"] == 1 and "snapshot_id" in first and "tracks" in first
