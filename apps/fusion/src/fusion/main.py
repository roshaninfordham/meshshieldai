from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from .server import include_routes
from .store import TrackStore
from .scenario_player import ScenarioPlayer
from .snapshot_publisher import SnapshotPublisher

ROOT = Path(__file__).resolve().parents[4]
SCENARIO = ROOT / "packages/scenarios" / f"{os.getenv('SCENARIO','data-center-swarm-attack')}.json"

@asynccontextmanager
async def lifespan(app: FastAPI):
    scenario_dict = json.loads(SCENARIO.read_text())
    store = TrackStore()
    player = ScenarioPlayer(store, scenario_dict)
    publisher = SnapshotPublisher(store=store, player=player, hz=10)

    def fanout(payload: str) -> None:
        for q in list(app.state.subscribers):
            try: q.put_nowait(payload)
            except asyncio.QueueFull: pass

    app.state.scenario_dict = scenario_dict
    app.state.store = store
    app.state.player = player
    app.state.publisher = publisher
    app.state.subscribers = set()
    publisher.add_sink(fanout)
    task = asyncio.create_task(publisher.run())
    try:
        yield
    finally:
        publisher.stop()
        task.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Fusion", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app

app = create_app()
