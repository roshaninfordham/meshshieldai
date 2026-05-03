from fastapi import FastAPI
from .server import include_routes


def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0")
    include_routes(app)
    return app


app = create_app()
