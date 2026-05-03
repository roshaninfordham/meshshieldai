from __future__ import annotations
import json
from pathlib import Path
from typing import Callable

def make_get_policy_thresholds(policy_path: Path) -> Callable[[], dict]:
    def get_policy_thresholds() -> dict:
        return json.loads(policy_path.read_text())
    return get_policy_thresholds
