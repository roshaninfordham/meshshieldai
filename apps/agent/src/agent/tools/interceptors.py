from __future__ import annotations
import json
from pathlib import Path
from typing import Callable

def make_list_available_interceptors(scenario_path: Path) -> Callable[[], list[dict]]:
    def list_available_interceptors() -> list[dict]:
        return json.loads(scenario_path.read_text())["interceptors"]
    return list_available_interceptors
