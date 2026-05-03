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
    """Produce a human-readable one-liner for each agent output shape."""
    if not isinstance(obj, dict):
        s = str(obj)
        return (s[:120] + "…") if len(s) > 120 else s

    # Prioritizer: {prioritized: [{target_id, risk_score, ...}]}
    if "prioritized" in obj and isinstance(obj["prioritized"], list):
        items = obj["prioritized"]
        top = ", ".join(
            f"{r.get('target_id','?').upper()} ({r.get('risk_score',0):.2f})"
            for r in items[:5]
        )
        return f"Top {len(items)} targets ranked by risk: {top}"

    # Allocator: {allocations: [{target_id, interceptor_id, mode, priority}]}
    if "allocations" in obj and isinstance(obj["allocations"], list):
        parts = ", ".join(
            f"{a.get('target_id','?')}→{a.get('interceptor_id','?')} {a.get('mode','?')}"
            for a in obj["allocations"][:6]
        )
        return f"Assigned {len(obj['allocations'])} pairs: {parts}"

    # Justifier: {justified: [{target_id, justification:{snapshot_refs,tavily_refs,policy_refs}}]}
    if "justified" in obj and isinstance(obj["justified"], list):
        j = obj["justified"]
        snap_c = sum(len(x.get("justification", {}).get("snapshot_refs", [])) for x in j)
        tav_c  = sum(len(x.get("justification", {}).get("tavily_refs",  [])) for x in j)
        pol_c  = sum(len(x.get("justification", {}).get("policy_refs",  [])) for x in j)
        return (f"Justified {len(j)} assignments · "
                f"{snap_c} snapshot refs · {tav_c} Tavily refs · {pol_c} policy refs")

    # Escalator / final plan: {assignments:[...], escalation:{required, reasons}}
    if "assignments" in obj and "escalation" in obj:
        esc = obj["escalation"]
        req = esc.get("required", False)
        reasons = "; ".join(esc.get("reasons", []))
        esc_str = f"REQUIRED ({reasons})" if req else "not required"
        return (f"Plan {obj.get('plan_id','?')} · "
                f"{len(obj.get('assignments',[]))} assignments · "
                f"escalation {esc_str}")

    # Fallback
    s = str(obj)
    return (s[:120] + "…") if len(s) > 120 else s
