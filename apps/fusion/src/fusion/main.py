from fastapi import FastAPI
from .server import include_routes
from .store import TrackStore

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Fusion", version="0.1.0")
    app.state.store = TrackStore()
    app.state.subscribers = set()  # set of asyncio.Queue
    include_routes(app)
    return app

app = create_app()
