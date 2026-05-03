# tests/test_workspace_layout.py
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_pnpm_workspace_lists_all_apps():
    text = (ROOT / "pnpm-workspace.yaml").read_text()
    for entry in ("apps/console", "packages/protocol", "packages/scenarios"):
        assert entry in text, f"missing {entry} in pnpm-workspace.yaml"

def test_uv_workspace_lists_all_python_members():
    text = (ROOT / "pyproject.toml").read_text()
    for entry in ("apps/fusion", "apps/agent", "packages/protocol"):
        assert entry in text, f"missing {entry} in root pyproject.toml"

def test_makefile_targets_present():
    text = (ROOT / "Makefile").read_text()
    for target in ("dev:", "test:", "protocol-gen:", "demo:"):
        assert target in text, f"missing {target} in Makefile"

def test_env_example_documents_required_vars():
    text = (ROOT / ".env.example").read_text()
    for var in ("OPENROUTER_API_KEY", "TAVILY_API_KEY", "DAYTONA_API_KEY",
                "FUSION_WS_URL", "AGENT_EVENTS_WS_URL", "AGENT_NLIP_WS_URL"):
        assert var in text, f"missing {var} in .env.example"
