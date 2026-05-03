from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI

from .server import include_routes
from .store import AgentStore
from .snapshot_subscriber import SnapshotSubscriber
from .event_bus import EventBus
from .pipeline import Pipeline
from .scheduler import PipelineScheduler
from .llm.ag2_adapter import LLMAdapter
from .llm.cassette import CassetteLLM
from .agents.prioritizer import Prioritizer
from .agents.allocator import Allocator
from .agents.justifier import Justifier
from .agents.escalator import Escalator
from .agents.watch_commander import WatchCommander
from .tools.intercept_sim import make_simulate_intercept_path
from .tools.tavily import make_tavily_recent_threats
from .tools.policy import make_get_policy_thresholds
from .tools.interceptors import make_list_available_interceptors

ROOT = Path(__file__).resolve().parents[4]
SCENARIO_PATH = ROOT / "packages/scenarios" / f"{os.getenv('SCENARIO','data-center-swarm-attack')}.json"
POLICY_PATH = ROOT / "packages/scenarios/policy.json"

def _build_llm(cassette: dict | None = None) -> LLMAdapter:
    model_pipeline = os.getenv("AG2_MODEL_FAST", "google/gemini-2.5-flash")
    if cassette is not None:
        return LLMAdapter(model="cassette", llm=CassetteLLM(cassette))
    return LLMAdapter(model=model_pipeline)

@asynccontextmanager
async def lifespan(app: FastAPI):
    store = AgentStore()
    bus = EventBus(store=store)
    subscriber = SnapshotSubscriber(
        url=os.getenv("FUSION_SNAPSHOT_WS", "ws://localhost:8001/snapshot"),
        store=store)
    sub_task = asyncio.create_task(subscriber.run())

    # Policy overrides (set via POST /policy endpoint)
    app.state.policy_overrides = {}

    llm = _build_llm()
    sim = make_simulate_intercept_path(daytona_base_url=os.getenv("DAYTONA_BASE_URL"),
                                       daytona_api_key=os.getenv("DAYTONA_API_KEY"))
    tavily = make_tavily_recent_threats(api_key=os.getenv("TAVILY_API_KEY"))
    list_int = make_list_available_interceptors(SCENARIO_PATH)
    get_policy = make_get_policy_thresholds(POLICY_PATH, overrides_provider=lambda: app.state.policy_overrides)

    prioritizer = Prioritizer(llm)
    allocator   = Allocator(llm, interceptors=list_int(), simulate=sim, snapshot_provider=store.latest_snapshot)
    justifier   = Justifier(llm, tavily=tavily, snapshot_provider=store.latest_snapshot,
                            policy_provider=get_policy, region=os.getenv("REGION","us-west"))
    escalator   = Escalator(llm, policy_provider=get_policy, snapshot_provider=store.latest_snapshot)
    watch_commander = WatchCommander(LLMAdapter(model=os.getenv("AG2_MODEL_PRO","google/gemini-2.5-pro")),
                                     store=store)

    pipeline = Pipeline(prioritizer, allocator, justifier, escalator, bus=bus, store=store)
    scheduler = PipelineScheduler(pipeline, snapshot_getter=store.latest_snapshot,
                                  period_s=float(os.getenv("AGENT_TICK_S","2.0")))
    sched_task = asyncio.create_task(scheduler.run())

    app.state.store = store
    app.state.bus = bus
    app.state.subscriber = subscriber
    app.state.scheduler = scheduler
    app.state.pipeline = pipeline
    app.state.watch_commander = watch_commander
    try:
        yield
    finally:
        scheduler.stop(); subscriber.stop()
        for t in (sched_task, sub_task):
            t.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app

app = create_app()
