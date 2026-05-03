from __future__ import annotations
import json
from pathlib import Path
from typing import Callable

def make_get_policy_thresholds(
    policy_path: Path,
    overrides_provider: Callable[[], dict] | None = None,
) -> Callable[[], dict]:
    def get_policy_thresholds() -> dict:
        base = json.loads(policy_path.read_text())
        if overrides_provider is not None:
            overrides = overrides_provider()
            if overrides:
                return {**base, **overrides}
        return base
    return get_policy_thresholds
