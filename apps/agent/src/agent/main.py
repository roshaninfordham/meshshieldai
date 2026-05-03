from __future__ import annotations
import asyncio, os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .server import include_routes
from .store import AgentStore
from .snapshot_subscriber import SnapshotSubscriber


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = AgentStore()
    subscriber = SnapshotSubscriber(
        url=os.getenv("FUSION_SNAPSHOT_WS", "ws://localhost:8001/snapshot"),
        store=store,
    )
    app.state.store = store
    app.state.subscriber = subscriber
    task = asyncio.create_task(subscriber.run())
    try:
        yield
    finally:
        subscriber.stop()
        task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app


app = create_app()
