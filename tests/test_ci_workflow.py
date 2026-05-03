from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]

def test_ci_workflow_has_python_and_node_jobs():
    cfg = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())
    job_names = list(cfg["jobs"].keys())
    assert "python" in job_names
    assert "node" in job_names
    py_steps = " ".join(s.get("run", "") for s in cfg["jobs"]["python"]["steps"])
    assert "uv sync" in py_steps
    assert "pytest" in py_steps
    node_steps = " ".join(s.get("run", "") for s in cfg["jobs"]["node"]["steps"])
    assert "pnpm install" in node_steps
    assert "pnpm -r test" in node_steps
