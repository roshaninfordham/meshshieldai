from __future__ import annotations
import json, time, uuid
from collections import Counter
from typing import Callable
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Escalation Officer. Validate the proposed assignments against policy and "
"emit the final ResponsePlan in this exact JSON shape: "
"{v:1, plan_id:string, snapshot_id:string, ts:number, assignments:[{target_id,interceptor_id,mode,priority,justification}], "
"escalation:{required:boolean, reasons:[string]}}. If the deterministic ESCALATION_HINT requires escalation, "
"reflect that in the output. Output JSON only."
)

class Escalator:
    name = "escalator"
    def __init__(self, llm: LLMAdapter, policy_provider: Callable[[], dict],
                 snapshot_provider: Callable[[], dict]) -> None:
        self._llm = llm; self._policy = policy_provider; self._snap = snapshot_provider

    def _hint(self, justified: dict) -> dict:
        snap = self._snap() or {"tracks": []}
        policy = self._policy()
        reasons: list[str] = []
        min_conf = float(policy.get("auto_action_min_conf", 0.7))
        for a in justified.get("justified", []):
            tid = a["target_id"]
            t = next((t for t in snap.get("tracks", []) if t["id"] == tid), None)
            if t is not None and float(t.get("conf", 0.0)) < min_conf:
                reasons.append(f"track {tid} conf {t['conf']:.2f} < {min_conf}")
        # convergence check (very simple — count tracks within 60m of any asset position 0,0,0)
        gt = int(policy.get("escalate_if_tracks_per_asset_gt", 10))
        nearby = sum(1 for t in snap.get("tracks", []) if float(t.get("nearest_asset_m", 1e9)) < 60.0)
        if nearby > gt:
            reasons.append(f"{nearby} tracks within 60m of asset > {gt}")
        return {"required": bool(reasons), "reasons": reasons}

    def build_prompt(self, justified: dict, escalation_hint: dict) -> str:
        return (f"{SYSTEM}\n\nJUSTIFIED:\n{json.dumps(justified, separators=(',', ':'))}\n\n"
                f"POLICY:\n{json.dumps(self._policy(), separators=(',', ':'))}\n\n"
                f"SNAPSHOT_SUMMARY:\n{json.dumps({'snapshot_id': (self._snap() or {}).get('snapshot_id','none')}, separators=(',', ':'))}\n\n"
                f"ESCALATION_HINT:\n{json.dumps(escalation_hint, separators=(',', ':'))}")

    async def run(self, justified: dict) -> dict:
        hint = self._hint(justified)
        plan = await self._llm.ask_json(self.name, self.build_prompt(justified, hint))
        # ensure required fields
        plan.setdefault("v", 1)
        plan.setdefault("plan_id", f"plan-{uuid.uuid4().hex[:8]}")
        plan.setdefault("snapshot_id", (self._snap() or {}).get("snapshot_id", "none"))
        plan.setdefault("ts", time.time())
        plan.setdefault("assignments", [])
        if "escalation" not in plan:
            plan["escalation"] = hint
        return plan
