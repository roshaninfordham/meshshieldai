from __future__ import annotations
import time
from .event_bus import EventBus
from .store import AgentStore
from .agents.prioritizer import Prioritizer
from .agents.allocator import Allocator
from .agents.justifier import Justifier
from .agents.escalator import Escalator

class Pipeline:
    def __init__(self, prioritizer: Prioritizer, allocator: Allocator,
                 justifier: Justifier, escalator: Escalator,
                 bus: EventBus, store: AgentStore) -> None:
        self._p = prioritizer; self._a = allocator; self._j = justifier; self._e = escalator
        self._bus = bus; self._store = store

    async def run_tick(self, snapshot: dict) -> dict:
        async def stage(name: str, coro_factory):
            self._bus.emit({"kind":"stage_started","agent":name,"ts":time.time()})
            t0 = time.monotonic()
            try:
                result = await coro_factory()
                self._bus.emit({"kind":"stage_finished","agent":name,
                                "output_summary": _summarize(result), "ms": int((time.monotonic()-t0)*1000),
                                "ts": time.time()})
                return result
            except Exception as exc:
                self._bus.emit({"kind":"stage_failed","agent":name,"error":str(exc),"ts":time.time()})
                raise

        prioritized = await stage(self._p.name, lambda: self._p.run(snapshot))
        allocated   = await stage(self._a.name, lambda: self._a.run(prioritized))
        justified   = await stage(self._j.name, lambda: self._j.run(allocated))
        plan        = await stage(self._e.name, lambda: self._e.run(justified))

        if plan.get("escalation", {}).get("required"):
            self._bus.emit({"kind":"escalation_raised",
                            "reason": "; ".join(plan["escalation"].get("reasons", [])),
                            "ts": time.time()})
        self._store.set_plan(plan)
        self._bus.emit({"kind":"plan_ready","plan_id": plan["plan_id"], "plan": plan, "ts": time.time()})
        return plan

def _summarize(obj) -> str:
    s = str(obj)
    return (s[:120] + "…") if len(s) > 120 else s
