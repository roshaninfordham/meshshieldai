from fastapi import FastAPI


def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "agent"}
