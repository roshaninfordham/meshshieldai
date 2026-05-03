import importlib, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PKG = ROOT / "packages/protocol"

def test_generated_python_modules_importable():
    subprocess.check_call(["pnpm", "--filter", "@meshshield/protocol", "gen"], cwd=ROOT)
    importlib.invalidate_caches()
    mod = importlib.import_module("meshshield_protocol")
    for name in ("SensorMessage", "Snapshot", "ResponsePlan", "AgentEvent"):
        assert hasattr(mod, name), f"meshshield_protocol missing {name}"

def test_generated_ts_index_exports_all():
    idx = (PKG / "ts/src/index.ts").read_text()
    for name in ("SensorMessage", "Snapshot", "ResponsePlan", "AgentEvent"):
        assert name in idx, f"ts index missing {name}"
