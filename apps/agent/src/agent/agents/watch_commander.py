from __future__ import annotations
import json
from ..llm.ag2_adapter import LLMAdapter
from ..store import AgentStore

SYSTEM = (
"You are the MeshShield Watch Commander, the human-facing voice of a multi-agent counter-drone system. "
"Answer the operator's question in 1-3 sentences. Cite specific snapshot field paths in square brackets like "
"[snapshot.tracks[3].pos_3d] and policy clauses like [clause:auto_action_min_conf] and plan ids like [plan-0007]. "
"Be precise; never fabricate values. If you don't know, say so."
)

class WatchCommander:
    name = "watch_commander"
    def __init__(self, llm: LLMAdapter, store: AgentStore) -> None:
        self._llm = llm; self._store = store

    def build_prompt(self, question: str) -> str:
        snap = self._store.latest_snapshot() or {}
        plan = self._store.latest_plan() or {}
        events = self._store.recent_events(20)
        return (f"{SYSTEM}\n\nQUESTION:\n{question}\n\nSNAPSHOT:\n{json.dumps(snap, separators=(',', ':'))}\n\n"
                f"LATEST_PLAN:\n{json.dumps(plan, separators=(',', ':'))}\n\nRECENT_EVENTS:\n{json.dumps(events, separators=(',', ':'))}")

    async def respond(self, question: str) -> str:
        return await self._llm.ask(self.name, self.build_prompt(question))
