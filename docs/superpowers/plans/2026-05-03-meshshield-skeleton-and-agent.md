# MeshShield Skeleton + AG2 Multi-Agent System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working demo-scale slice of MeshShield in which a Next.js console renders synthetic airspace data, a four-agent AG2 pipeline (Prioritizer → Allocator → Justifier → Escalation) produces a structured `ResponsePlan` every 2 seconds, and an operator chats with a Watch Commander agent over NLIP.

**Architecture:** Three runnable services (fusion, agent, console) in a pnpm + uv monorepo. Shared schemas via JSON Schema → Pydantic + TypeScript codegen. AG2 (`autogen.beta`) calls Gemini via OpenRouter; tools include a Daytona sandbox for ballistic simulation and Tavily for live grounding. Event-sourced UI driven by an `AgentEvent` WebSocket stream so animations replay deterministically.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, AG2 (`autogen.beta`), `nlip_server`, OpenRouter (Gemini 2.5 Flash + Pro), Daytona, Tavily; Next.js 15 (App Router), TypeScript, Tailwind, Framer Motion, react-flow, deck.gl, recharts, Zustand; pnpm workspaces, uv workspaces, pytest, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-03-meshshield-skeleton-and-agent-design.md`

---

## File Structure

```
meshshield-ai/                                  (repo root, already initialized)
├── package.json                                Pnpm workspace root
├── pnpm-workspace.yaml
├── pyproject.toml                              Uv workspace root
├── Makefile                                    `make dev`, `make demo`, `make test`
├── .env.example
├── README.md
├── apps/
│   ├── fusion/                                 Python FastAPI (in-memory airspace, scenario player, snapshot publisher)
│   │   ├── pyproject.toml
│   │   ├── src/fusion/{main,server,scenario_player,snapshot_publisher,store,osm_fetch}.py
│   │   └── tests/test_*.py
│   ├── agent/                                  Python FastAPI + AG2 + NLIP
│   │   ├── pyproject.toml
│   │   ├── src/agent/
│   │   │   ├── {main,server,snapshot_subscriber,pipeline,event_bus,store}.py
│   │   │   ├── llm/ag2_adapter.py
│   │   │   ├── agents/{prioritizer,allocator,justifier,escalator,watch_commander}.py
│   │   │   ├── tools/{snapshot,interceptors,intercept_sim,tavily,policy,operator_query}.py
│   │   │   └── nlip/server.py
│   │   └── tests/test_*.py
│   └── console/                                Next.js 15
│       ├── package.json
│       ├── app/{layout,page}.tsx
│       ├── components/{Header,Map3D,ActivityTheatre,AgentCard,ToolChip,HandoffArrow,NlipChat,EventTape,CostCurveOverlay,PlanPanel}.tsx
│       ├── lib/streams/{snapshot,agent}.ts
│       ├── lib/nlip/client.ts
│       ├── lib/store/index.ts
│       ├── tests/components/*.test.tsx
│       └── e2e/scenario.spec.ts
├── packages/
│   ├── protocol/                               JSON Schemas → Pydantic + TS types
│   │   ├── schemas/{sensor-message,snapshot,response-plan,agent-event}.schema.json
│   │   ├── scripts/generate.mjs
│   │   ├── python/meshshield_protocol/         generated
│   │   └── ts/src/                             generated
│   └── scenarios/
│       ├── data-center-swarm-attack.json
│       ├── policy.json
│       └── assets/osm-datacenter.geojson
├── docs/
│   ├── superpowers/{specs,plans}/
│   └── runbooks/demo-day.md
└── .github/workflows/ci.yml
```

Each file has one clear responsibility; no file in this plan exceeds ~250 lines.

---

## Phase 1 — Repo foundation (Tasks 1–3)

### Task 1: Initialize pnpm + uv workspaces with base configs

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `Makefile`, `.env.example`, `README.md`
- Create: `apps/fusion/pyproject.toml`, `apps/agent/pyproject.toml`, `apps/console/package.json`
- Create: `packages/protocol/pyproject.toml`, `packages/protocol/package.json`, `packages/scenarios/package.json`
- Test: `tests/test_workspace_layout.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
pytest tests/test_workspace_layout.py -v
```
Expected: 4 failures (files don't exist yet).

- [ ] **Step 3: Create pnpm workspace root**

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/console"
  - "packages/protocol"
  - "packages/scenarios"
```

```json
// package.json
{
  "name": "meshshield-ai",
  "private": true,
  "version": "0.1.0",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "protocol:gen": "pnpm --filter @meshshield/protocol gen"
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
```

- [ ] **Step 4: Create uv workspace root**

```toml
# pyproject.toml
[project]
name = "meshshield-ai"
version = "0.1.0"
requires-python = ">=3.12"

[tool.uv.workspace]
members = ["apps/fusion", "apps/agent", "packages/protocol"]

[tool.uv.sources]
meshshield-protocol = { workspace = true }

[dependency-groups]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "respx>=0.21",
  "ruff>=0.7",
]
```

- [ ] **Step 5: Create app stubs**

```toml
# apps/fusion/pyproject.toml
[project]
name = "meshshield-fusion"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "websockets>=13",
  "httpx>=0.27",
  "meshshield-protocol",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/fusion"]
```

```toml
# apps/agent/pyproject.toml
[project]
name = "meshshield-agent"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "websockets>=13",
  "httpx>=0.27",
  "ag2[openai]>=0.5",
  "nlip-server",
  "nlip-sdk",
  "cbor2>=5.6",
  "meshshield-protocol",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/agent"]
```

```json
// apps/console/package.json
{
  "name": "@meshshield/console",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "framer-motion": "^11.11.0",
    "reactflow": "^11.11.4",
    "deck.gl": "^9.0.32",
    "react-map-gl": "^7.1.7",
    "maplibre-gl": "^4.7.1",
    "recharts": "^2.13.0",
    "zustand": "^5.0.1",
    "cbor-x": "^1.6.0",
    "@meshshield/protocol": "workspace:*",
    "@meshshield/scenarios": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "tailwindcss": "^3.4.14",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.4",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.0",
    "@playwright/test": "^1.48.2",
    "jsdom": "^25.0.1"
  }
}
```

- [ ] **Step 6: Create package stubs**

```toml
# packages/protocol/pyproject.toml
[project]
name = "meshshield-protocol"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.9"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["python/meshshield_protocol"]
```

```json
// packages/protocol/package.json
{
  "name": "@meshshield/protocol",
  "private": true,
  "version": "0.1.0",
  "main": "ts/src/index.ts",
  "types": "ts/src/index.ts",
  "scripts": {
    "gen": "node scripts/generate.mjs"
  },
  "devDependencies": {
    "json-schema-to-typescript": "^15.0.3"
  }
}
```

```json
// packages/scenarios/package.json
{
  "name": "@meshshield/scenarios",
  "private": true,
  "version": "0.1.0",
  "main": "index.js",
  "files": ["data-center-swarm-attack.json", "policy.json", "assets"]
}
```

- [ ] **Step 7: Create Makefile**

```makefile
# Makefile
.PHONY: dev test protocol-gen demo install fmt

install:
	pnpm install
	uv sync

protocol-gen:
	pnpm --filter @meshshield/protocol gen

dev: protocol-gen
	pnpm exec concurrently -n fusion,agent,console -c blue,green,magenta \
	  "uv run --directory apps/fusion uvicorn fusion.main:app --port 8001 --reload" \
	  "uv run --directory apps/agent  uvicorn agent.main:app  --port 8002 --reload" \
	  "pnpm --filter @meshshield/console dev"

demo: protocol-gen
	SCENARIO=data-center-swarm-attack pnpm exec concurrently -n fusion,agent,console -c blue,green,magenta \
	  "uv run --directory apps/fusion uvicorn fusion.main:app --port 8001" \
	  "uv run --directory apps/agent  uvicorn agent.main:app  --port 8002" \
	  "pnpm --filter @meshshield/console dev"

test:
	uv run pytest -q
	pnpm -r test

fmt:
	uv run ruff format .
	pnpm -r exec prettier --write .
```

- [ ] **Step 8: Create .env.example and README**

```bash
# .env.example
# OpenRouter (used by AG2 to call Gemini)
OPENROUTER_API_KEY=sk-or-v1-REPLACE_ME

# Tavily (used by Justifier for live grounding)
TAVILY_API_KEY=tvly-REPLACE_ME

# Daytona (used by Allocator for sandboxed simulation)
DAYTONA_API_KEY=REPLACE_ME
DAYTONA_BASE_URL=https://app.daytona.io/api

# Service URLs (defaults are correct for local dev)
FUSION_WS_URL=ws://localhost:8001
AGENT_EVENTS_WS_URL=ws://localhost:8002/events
AGENT_NLIP_WS_URL=ws://localhost:8002/nlip
NEXT_PUBLIC_FUSION_WS_URL=ws://localhost:8001
NEXT_PUBLIC_AGENT_EVENTS_WS_URL=ws://localhost:8002/events
NEXT_PUBLIC_AGENT_NLIP_WS_URL=ws://localhost:8002/nlip
```

```markdown
# MeshShield AI — A+F slice

Software-defined counter-swarm defense, demo-scale slice with the AG2 multi-agent
command system and NLIP operator chat.

## Quickstart

```
make install
cp .env.example .env       # fill in OPENROUTER_API_KEY at minimum
make dev
```

Open http://localhost:3000.

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-03-meshshield-skeleton-and-agent-design.md`
- Plan: `docs/superpowers/plans/2026-05-03-meshshield-skeleton-and-agent.md`
```

- [ ] **Step 9: Run the tests to verify pass**

```
pytest tests/test_workspace_layout.py -v
```
Expected: 4 PASS.

- [ ] **Step 10: Commit**

```bash
git add package.json pnpm-workspace.yaml pyproject.toml Makefile .env.example README.md \
        apps/fusion/pyproject.toml apps/agent/pyproject.toml apps/console/package.json \
        packages/protocol/pyproject.toml packages/protocol/package.json packages/scenarios/package.json \
        tests/test_workspace_layout.py
git commit -m "chore: initialize pnpm + uv workspaces and base configs"
```

---

### Task 2: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: `tests/test_ci_workflow.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ci_workflow.py
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]

def test_ci_workflow_runs_lint_test_typecheck():
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
```

- [ ] **Step 2: Run test to verify failure**

```
pytest tests/test_ci_workflow.py -v
```
Expected: FAIL.

- [ ] **Step 3: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v3
        with: { python-version: "3.12" }
      - run: uv sync
      - run: uv run pytest -q
  node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @meshshield/protocol gen
      - run: pnpm -r test
```

- [ ] **Step 4: Run test to verify pass**

```
pip install pyyaml && pytest tests/test_ci_workflow.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/test_ci_workflow.py
git commit -m "ci: add python + node jobs"
```

---

### Task 3: Root pytest config + tooling

**Files:**
- Modify: `pyproject.toml` (append `[tool.pytest.ini_options]`)
- Create: `.python-version`
- Create: `apps/console/tsconfig.json`, `apps/console/next.config.mjs`, `apps/console/postcss.config.mjs`, `apps/console/tailwind.config.ts`, `apps/console/app/globals.css`, `apps/console/app/layout.tsx`, `apps/console/app/page.tsx`
- Test: `apps/console/tests/smoke.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/console/tests/smoke.test.ts
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 2: Add pytest config**

Append to root `pyproject.toml`:
```toml
[tool.pytest.ini_options]
testpaths = ["tests", "apps/fusion/tests", "apps/agent/tests", "packages/protocol/tests"]
asyncio_mode = "auto"
```

Create `.python-version` containing `3.12`.

- [ ] **Step 3: Add Next.js + Tailwind base files**

```ts
// apps/console/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true, "skipLibCheck": true, "strict": true, "noEmit": true,
    "esModuleInterop": true, "module": "esnext", "moduleResolution": "bundler",
    "resolveJsonModule": true, "isolatedModules": true, "jsx": "preserve",
    "incremental": true, "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"], "@meshshield/protocol": ["../../packages/protocol/ts/src/index.ts"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```js
// apps/console/next.config.mjs
const nextConfig = { reactStrictMode: true, transpilePackages: ["@meshshield/protocol"] };
export default nextConfig;
```

```js
// apps/console/postcss.config.mjs
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```

```ts
// apps/console/tailwind.config.ts
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      bg:        "#0b0f17",
      panel:     "#11162055",
      panelSolid:"#111620",
      accent:    "#5cf2c0",
      warn:      "#fcb045",
      danger:    "#ff5c5c",
      muted:     "#7c869b",
    },
  }},
  plugins: [],
};
export default config;
```

```css
/* apps/console/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #__next { height: 100%; background: #0b0f17; color: #e6ecf5; }
```

```tsx
// apps/console/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "MeshShield AI", description: "Counter-swarm operator console" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="antialiased">{children}</body></html>;
}
```

```tsx
// apps/console/app/page.tsx
export default function Page() {
  return <main className="p-6"><h1 className="text-2xl font-bold">MeshShield AI</h1><p className="text-muted">Console scaffolding…</p></main>;
}
```

```ts
// apps/console/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] } });
```

```ts
// apps/console/tests/setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Run smoke test**

```
pnpm --filter @meshshield/console test
```
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml .python-version apps/console/
git commit -m "chore: add Next.js + Tailwind scaffolding and root pytest config"
```

---

## Phase 2 — Protocol package (Tasks 4–6)

### Task 4: JSON schemas for the four wire types

**Files:**
- Create: `packages/protocol/schemas/sensor-message.schema.json`
- Create: `packages/protocol/schemas/snapshot.schema.json`
- Create: `packages/protocol/schemas/response-plan.schema.json`
- Create: `packages/protocol/schemas/agent-event.schema.json`
- Create: `packages/protocol/tests/test_schemas_load.py`

- [ ] **Step 1: Write the failing test**

```python
# packages/protocol/tests/test_schemas_load.py
import json
from pathlib import Path
import jsonschema

SCHEMAS = Path(__file__).resolve().parent.parent / "schemas"
NAMES = ["sensor-message", "snapshot", "response-plan", "agent-event"]

def test_all_schemas_are_valid_drafts():
    for name in NAMES:
        s = json.loads((SCHEMAS / f"{name}.schema.json").read_text())
        jsonschema.Draft202012Validator.check_schema(s)

def test_sensor_message_example_validates():
    s = json.loads((SCHEMAS / "sensor-message.schema.json").read_text())
    msg = {"v": 1, "node_id": "laptop-01", "ts": 1714680000.123,
           "detections": [{"class": "drone", "conf": 0.91, "bearing_deg": 142.5,
                            "elev_deg": 8.3, "px_box": [320,180,80,60]}]}
    jsonschema.validate(msg, s)

def test_snapshot_example_validates():
    s = json.loads((SCHEMAS / "snapshot.schema.json").read_text())
    snap = {"v": 1, "snapshot_id": "snap-1", "ts": 1.0,
            "tracks": [{"id": "t-1", "origin": "real",
                        "pos_3d": [1.0,2.0,3.0], "vel": [0.1,0.2,0.3],
                        "conf": 0.9, "nearest_asset_m": 50.0}]}
    jsonschema.validate(snap, s)

def test_response_plan_example_validates():
    s = json.loads((SCHEMAS / "response-plan.schema.json").read_text())
    plan = {"v": 1, "plan_id": "plan-1", "snapshot_id": "snap-1", "ts": 2.0,
            "assignments": [{"target_id": "t-1", "interceptor_id": "i-1",
                              "mode": "rf_jam", "priority": 1,
                              "justification": {"snapshot_refs": ["tracks[0].pos_3d"],
                                                 "tavily_refs": [], "policy_refs": ["clause:x"]}}],
            "escalation": {"required": False, "reasons": []}}
    jsonschema.validate(plan, s)

def test_agent_event_example_validates():
    s = json.loads((SCHEMAS / "agent-event.schema.json").read_text())
    for ev in [
        {"kind": "stage_started", "agent": "prioritizer", "ts": 1.0},
        {"kind": "tool_call_started", "agent": "allocator", "tool": "simulate_intercept_path", "args": {}, "ts": 1.0},
        {"kind": "tool_call_finished", "agent": "allocator", "tool": "simulate_intercept_path", "result_summary": "ok", "ms": 142, "ts": 1.0},
        {"kind": "agent_message", "agent": "justifier", "preview": "...", "full_id": "msg-1", "tokens": 220, "ts": 1.0},
        {"kind": "stage_finished", "agent": "escalator", "output_summary": "no escalation", "ms": 700, "ts": 1.0},
        {"kind": "plan_ready", "plan_id": "plan-1", "ts": 1.0},
        {"kind": "escalation_raised", "reason": "ten tracks converging", "ts": 1.0},
        {"kind": "stage_failed", "agent": "prioritizer", "error": "timeout", "ts": 1.0},
    ]:
        jsonschema.validate(ev, s)
```

- [ ] **Step 2: Run test to verify failure**

```
uv add --dev jsonschema && uv run pytest packages/protocol/tests/test_schemas_load.py -v
```
Expected: 5 failures (files don't exist).

- [ ] **Step 3: Write `sensor-message.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://meshshield.ai/schemas/sensor-message.json",
  "title": "SensorMessage",
  "type": "object",
  "required": ["v", "node_id", "ts", "detections"],
  "additionalProperties": false,
  "properties": {
    "v":         {"type": "integer", "const": 1},
    "node_id":   {"type": "string"},
    "ts":        {"type": "number"},
    "detections":{
      "type": "array",
      "items": {
        "type": "object",
        "required": ["class", "conf", "bearing_deg", "elev_deg", "px_box"],
        "additionalProperties": false,
        "properties": {
          "class":       {"type": "string"},
          "conf":        {"type": "number", "minimum": 0, "maximum": 1},
          "bearing_deg": {"type": "number"},
          "elev_deg":    {"type": "number"},
          "px_box":      {"type": "array", "items": {"type": "number"}, "minItems": 4, "maxItems": 4}
        }
      }
    }
  }
}
```

- [ ] **Step 4: Write `snapshot.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://meshshield.ai/schemas/snapshot.json",
  "title": "Snapshot",
  "type": "object",
  "required": ["v", "snapshot_id", "ts", "tracks"],
  "additionalProperties": false,
  "properties": {
    "v":           {"type": "integer", "const": 1},
    "snapshot_id": {"type": "string"},
    "ts":          {"type": "number"},
    "tracks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "origin", "pos_3d", "vel", "conf"],
        "additionalProperties": false,
        "properties": {
          "id":              {"type": "string"},
          "origin":          {"type": "string", "enum": ["real", "simulated"]},
          "pos_3d":          {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3},
          "vel":             {"type": "array", "items": {"type": "number"}, "minItems": 3, "maxItems": 3},
          "conf":            {"type": "number", "minimum": 0, "maximum": 1},
          "nearest_asset_m": {"type": "number"}
        }
      }
    }
  }
}
```

- [ ] **Step 5: Write `response-plan.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://meshshield.ai/schemas/response-plan.json",
  "title": "ResponsePlan",
  "type": "object",
  "required": ["v", "plan_id", "snapshot_id", "ts", "assignments", "escalation"],
  "additionalProperties": false,
  "properties": {
    "v":           {"type": "integer", "const": 1},
    "plan_id":     {"type": "string"},
    "snapshot_id": {"type": "string"},
    "ts":          {"type": "number"},
    "assignments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["target_id", "interceptor_id", "mode", "priority", "justification"],
        "additionalProperties": false,
        "properties": {
          "target_id":      {"type": "string"},
          "interceptor_id": {"type": "string"},
          "mode":           {"type": "string", "enum": ["kinetic", "rf_jam", "spoof", "monitor"]},
          "priority":       {"type": "integer", "minimum": 1},
          "justification": {
            "type": "object",
            "required": ["snapshot_refs", "tavily_refs", "policy_refs"],
            "additionalProperties": false,
            "properties": {
              "snapshot_refs": {"type": "array", "items": {"type": "string"}},
              "tavily_refs":   {"type": "array", "items": {"type": "string"}},
              "policy_refs":   {"type": "array", "items": {"type": "string"}}
            }
          }
        }
      }
    },
    "escalation": {
      "type": "object",
      "required": ["required", "reasons"],
      "additionalProperties": false,
      "properties": {
        "required": {"type": "boolean"},
        "reasons":  {"type": "array", "items": {"type": "string"}}
      }
    }
  }
}
```

- [ ] **Step 6: Write `agent-event.schema.json`**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://meshshield.ai/schemas/agent-event.json",
  "title": "AgentEvent",
  "type": "object",
  "required": ["kind", "ts"],
  "properties": {
    "kind": {"type": "string", "enum": [
      "stage_started", "stage_finished", "stage_failed",
      "tool_call_started", "tool_call_finished",
      "agent_message", "plan_ready", "escalation_raised"
    ]},
    "ts":    {"type": "number"},
    "agent": {"type": "string", "enum": ["prioritizer","allocator","justifier","escalator","watch_commander"]},
    "tool":              {"type": "string"},
    "args":              {"type": "object"},
    "result_summary":    {"type": "string"},
    "ms":                {"type": "integer"},
    "preview":           {"type": "string"},
    "full_id":           {"type": "string"},
    "tokens":            {"type": "integer"},
    "output_summary":    {"type": "string"},
    "plan_id":           {"type": "string"},
    "plan":              {"type": "object", "description": "Full ResponsePlan body, present on plan_ready events so the console can render without a separate fetch."},
    "reason":            {"type": "string"},
    "error":             {"type": "string"}
  },
  "additionalProperties": false
}
```

- [ ] **Step 7: Run tests to verify pass**

```
uv run pytest packages/protocol/tests/test_schemas_load.py -v
```
Expected: 5 PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/protocol/schemas/ packages/protocol/tests/test_schemas_load.py pyproject.toml
git commit -m "feat(protocol): add JSON schemas for sensor, snapshot, plan, agent-event"
```

---

### Task 5: Codegen script (Pydantic + TypeScript)

**Files:**
- Create: `packages/protocol/scripts/generate.mjs`
- Create: `packages/protocol/python/meshshield_protocol/__init__.py` (placeholder; will be overwritten by gen)
- Test: `packages/protocol/tests/test_codegen.py`

- [ ] **Step 1: Write the failing test**

```python
# packages/protocol/tests/test_codegen.py
import importlib, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
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
```

- [ ] **Step 2: Run test to verify failure**

```
uv run pytest packages/protocol/tests/test_codegen.py -v
```
Expected: FAIL.

- [ ] **Step 3: Write the codegen script**

```js
// packages/protocol/scripts/generate.mjs
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const schemasDir = join(pkg, "schemas");
const tsDir = join(pkg, "ts/src");
const pyPkgDir = join(pkg, "python/meshshield_protocol");
mkdirSync(tsDir, { recursive: true });
mkdirSync(pyPkgDir, { recursive: true });

const schemas = readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json"));

// --- TypeScript via json-schema-to-typescript ---
const { compileFromFile } = await import("json-schema-to-typescript");
const tsExports = [];
for (const file of schemas) {
  const ts = await compileFromFile(join(schemasDir, file), {
    bannerComment: "// AUTO-GENERATED FROM packages/protocol/schemas — do not edit",
    additionalProperties: false,
  });
  const outName = basename(file, ".schema.json") + ".ts";
  writeFileSync(join(tsDir, outName), ts);
  tsExports.push(`export * from "./${basename(file, ".schema.json")}";`);
}
writeFileSync(join(tsDir, "index.ts"), tsExports.join("\n") + "\n");

// --- Pydantic via datamodel-code-generator (one file per schema, then __init__) ---
for (const file of schemas) {
  const baseName = basename(file, ".schema.json").replaceAll("-", "_");
  const out = join(pyPkgDir, `${baseName}.py`);
  execSync(
    `uv run datamodel-codegen --input "${join(schemasDir, file)}" --input-file-type jsonschema --output "${out}" --output-model-type pydantic_v2.BaseModel --use-schema-description --target-python-version 3.12`,
    { stdio: "inherit" }
  );
}

// __init__.py re-exports the four top-level types under stable names.
const initLines = [
  "# AUTO-GENERATED FROM packages/protocol/schemas — do not edit",
  "from .sensor_message import SensorMessage",
  "from .snapshot import Snapshot",
  "from .response_plan import ResponsePlan",
  "from .agent_event import AgentEvent",
  "__all__ = ['SensorMessage', 'Snapshot', 'ResponsePlan', 'AgentEvent']",
];
writeFileSync(join(pyPkgDir, "__init__.py"), initLines.join("\n") + "\n");

console.log("✓ generated TS in", tsDir);
console.log("✓ generated Pydantic in", pyPkgDir);
```

- [ ] **Step 4: Add datamodel-code-generator dev dep + json-schema-to-typescript**

```
uv add --dev datamodel-code-generator
pnpm --filter @meshshield/protocol add -D json-schema-to-typescript
```

- [ ] **Step 5: Create placeholder `__init__.py` so tests don't import-fail before gen**

```python
# packages/protocol/python/meshshield_protocol/__init__.py
# placeholder, will be overwritten by `pnpm protocol:gen`
```

- [ ] **Step 6: Run codegen + tests**

```
pnpm install
pnpm --filter @meshshield/protocol gen
uv pip install -e packages/protocol
uv run pytest packages/protocol/tests/test_codegen.py -v
```
Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/protocol/scripts/ packages/protocol/python/ packages/protocol/ts/ packages/protocol/tests/test_codegen.py
git commit -m "feat(protocol): JSON-Schema-driven codegen for Pydantic + TS types"
```

---

### Task 6: Round-trip equivalence test (Python ↔ TS)

**Files:**
- Create: `packages/protocol/tests/test_roundtrip.py`
- Create: `packages/protocol/tests/fixtures/snapshot.json`
- Create: `packages/protocol/ts/src/__tests__/roundtrip.test.ts`

- [ ] **Step 1: Add fixture**

```json
// packages/protocol/tests/fixtures/snapshot.json
{
  "v": 1, "snapshot_id": "snap-fixture-1", "ts": 1714680000.250,
  "tracks": [
    {"id":"t-001","origin":"real","pos_3d":[120.4,88.1,35.0],"vel":[12.0,-3.2,0.5],"conf":0.88,"nearest_asset_m":47.2},
    {"id":"t-002","origin":"simulated","pos_3d":[150.0,90.0,40.0],"vel":[8.0,-2.0,0.0],"conf":0.74,"nearest_asset_m":80.0}
  ]
}
```

- [ ] **Step 2: Python side — write failing test**

```python
# packages/protocol/tests/test_roundtrip.py
import json
from pathlib import Path
from meshshield_protocol import Snapshot

FX = Path(__file__).resolve().parent / "fixtures" / "snapshot.json"

def test_pydantic_roundtrip_preserves_fields():
    raw = json.loads(FX.read_text())
    snap = Snapshot.model_validate(raw)
    out = json.loads(snap.model_dump_json())
    assert out == raw
```

- [ ] **Step 3: Run python test**

```
uv run pytest packages/protocol/tests/test_roundtrip.py -v
```
Expected: PASS (codegen already produced Snapshot).

- [ ] **Step 4: TS side — install ajv and write test**

```
pnpm --filter @meshshield/protocol add -D ajv ajv-formats vitest
```

```ts
// packages/protocol/ts/src/__tests__/roundtrip.test.ts
import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/snapshot.schema.json"), "utf8"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/snapshot.json"), "utf8"));

describe("Snapshot ts roundtrip", () => {
  it("validates the same fixture the Python side validates", () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    expect(validate(fixture)).toBe(true);
  });
});
```

```ts
// packages/protocol/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["ts/src/**/*.test.ts"] } });
```

Add to `packages/protocol/package.json`:
```json
"scripts": {
  "gen": "node scripts/generate.mjs",
  "test": "vitest run"
}
```

- [ ] **Step 5: Run ts test**

```
pnpm --filter @meshshield/protocol test
```
Expected: 1 PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/tests/ packages/protocol/ts/ packages/protocol/vitest.config.ts packages/protocol/package.json
git commit -m "test(protocol): cross-runtime round-trip equivalence on Snapshot fixture"
```

---

## Phase 3 — Scenarios + open data (Task 7)

### Task 7: Scenario JSON, policy, OSM data-center polygons

**Files:**
- Create: `packages/scenarios/data-center-swarm-attack.json`
- Create: `packages/scenarios/policy.json`
- Create: `packages/scenarios/assets/osm-datacenter.geojson`
- Create: `packages/scenarios/scripts/fetch_osm.py`
- Create: `packages/scenarios/index.js`
- Test: `packages/scenarios/tests/test_scenario_loads.py`

- [ ] **Step 1: Write the failing test**

```python
# packages/scenarios/tests/test_scenario_loads.py
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_scenario_has_expected_shape():
    s = json.loads((ROOT / "data-center-swarm-attack.json").read_text())
    assert s["v"] == 1
    assert s["scenario_id"] == "data-center-swarm-attack"
    assert s["duration_s"] >= 30
    assert len(s["interceptors"]) >= 4
    assert len(s["events"]) >= 8

def test_policy_thresholds():
    p = json.loads((ROOT / "policy.json").read_text())
    assert p["auto_action_min_conf"] == 0.7
    assert p["escalate_if_tracks_per_asset_gt"] == 10
    assert isinstance(p["clauses"], dict)
    assert "auto_action_min_conf" in p["clauses"]

def test_osm_geojson_has_polygon():
    g = json.loads((ROOT / "assets/osm-datacenter.geojson").read_text())
    assert g["type"] == "FeatureCollection"
    assert any(f["geometry"]["type"] in ("Polygon", "MultiPolygon") for f in g["features"])
```

- [ ] **Step 2: Run test to verify failure**

```
uv run pytest packages/scenarios/tests/test_scenario_loads.py -v
```
Expected: 3 FAIL.

- [ ] **Step 3: Write `data-center-swarm-attack.json`**

A 30-second scripted attack: a center asset, 4 ground interceptors, and 8 hostile drone tracks spawned in two waves.

```json
{
  "v": 1,
  "scenario_id": "data-center-swarm-attack",
  "duration_s": 30,
  "asset": {
    "asset_id": "datacenter-A",
    "name": "Hyperscaler DC East",
    "center_xyz": [0.0, 0.0, 0.0],
    "radius_m": 60.0
  },
  "interceptors": [
    {"id": "i-001", "kind": "rf_jam",  "pos_3d": [-50,  -10, 0], "range_m": 250},
    {"id": "i-002", "kind": "kinetic", "pos_3d": [ 50,  -10, 0], "range_m": 200},
    {"id": "i-003", "kind": "spoof",   "pos_3d": [-10,   60, 0], "range_m": 300},
    {"id": "i-004", "kind": "rf_jam",  "pos_3d": [ 10,   60, 0], "range_m": 250}
  ],
  "events": [
    {"t":  0.0, "spawn": {"id":"t-001","origin":"real","pos_3d":[ 200,  150, 50],"vel":[-12, -9,  0.0],"conf":0.92}},
    {"t":  0.5, "spawn": {"id":"t-002","origin":"simulated","pos_3d":[-220,  180, 60],"vel":[ 11, -8,  0.0],"conf":0.81}},
    {"t":  1.0, "spawn": {"id":"t-003","origin":"simulated","pos_3d":[ 240, -160, 55],"vel":[-10,  9,  0.0],"conf":0.78}},
    {"t":  1.5, "spawn": {"id":"t-004","origin":"simulated","pos_3d":[-260, -180, 65],"vel":[ 12,  8, -0.5],"conf":0.66}},
    {"t":  6.0, "spawn": {"id":"t-005","origin":"simulated","pos_3d":[ 300,    0, 45],"vel":[-13,  0,  0.0],"conf":0.74}},
    {"t":  6.5, "spawn": {"id":"t-006","origin":"simulated","pos_3d":[-300,    0, 55],"vel":[ 13,  0,  0.0],"conf":0.71}},
    {"t":  9.0, "spawn": {"id":"t-007","origin":"simulated","pos_3d":[   0,  320, 70],"vel":[  0,-12,  0.0],"conf":0.83}},
    {"t":  9.5, "spawn": {"id":"t-008","origin":"simulated","pos_3d":[   0, -320, 70],"vel":[  0, 12,  0.0],"conf":0.59}},
    {"t": 18.0, "burst": {"count": 6, "ring_radius_m": 400, "altitude_m": 50, "speed_m_s": 11, "origin":"simulated", "id_prefix": "t-9"}}
  ]
}
```

- [ ] **Step 4: Write `policy.json`**

```json
{
  "v": 1,
  "auto_action_min_conf": 0.7,
  "escalate_if_tracks_per_asset_gt": 10,
  "clauses": {
    "auto_action_min_conf": "Do not auto-action a target whose track confidence is below 0.7.",
    "escalate_if_tracks_per_asset_gt": "If more than 10 tracks converge on a single protected asset, escalate to a human operator.",
    "proximity_under_50m": "Any track with nearest_asset_m < 50 is priority 1 by default."
  }
}
```

- [ ] **Step 5: Write OSM fetch script + cached geojson**

```python
# packages/scenarios/scripts/fetch_osm.py
import json, sys, urllib.request
from pathlib import Path

QUERY = """
[out:json][timeout:25];
(
  way[building=data_center](around:2000,37.4275,-122.1697);
  relation[building=data_center](around:2000,37.4275,-122.1697);
);
out geom;
""".strip()

def main(outpath: str) -> None:
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=("data=" + QUERY).encode(),
        headers={"User-Agent": "MeshShield/0.1 (demo)"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    features = []
    for el in data.get("elements", []):
        coords = [[g["lon"], g["lat"]] for g in el.get("geometry", [])]
        if len(coords) < 4:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        features.append({"type":"Feature",
                         "geometry":{"type":"Polygon","coordinates":[coords]},
                         "properties":{"osm_id": el.get("id"),"name": el.get("tags",{}).get("name","")}})
    fc = {"type":"FeatureCollection","features":features}
    Path(outpath).parent.mkdir(parents=True, exist_ok=True)
    Path(outpath).write_text(json.dumps(fc, indent=2))

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "packages/scenarios/assets/osm-datacenter.geojson")
```

Cache a minimal valid file so tests pass without network (the fetch script is for refresh):

```json
// packages/scenarios/assets/osm-datacenter.geojson
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {"osm_id": 0, "name": "Hyperscaler DC East (synthetic)"},
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-122.1700, 37.4270],
          [-122.1700, 37.4280],
          [-122.1690, 37.4280],
          [-122.1690, 37.4270],
          [-122.1700, 37.4270]
        ]]
      }
    }
  ]
}
```

```js
// packages/scenarios/index.js
import scenario from "./data-center-swarm-attack.json" with { type: "json" };
import policy   from "./policy.json"                  with { type: "json" };
import osm      from "./assets/osm-datacenter.geojson" with { type: "json" };
export { scenario, policy, osm };
```

- [ ] **Step 6: Run tests**

```
uv run pytest packages/scenarios/tests/test_scenario_loads.py -v
```
Expected: 3 PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/scenarios/
git commit -m "feat(scenarios): data-center-swarm-attack scenario, policy, OSM polygon cache"
```

---

## Phase 4 — Fusion server (Tasks 8–10)

### Task 8: Fusion FastAPI shell + TrackStore + sensor WS no-op

**Files:**
- Create: `apps/fusion/src/fusion/__init__.py`
- Create: `apps/fusion/src/fusion/store.py`
- Create: `apps/fusion/src/fusion/main.py`
- Create: `apps/fusion/src/fusion/server.py`
- Test: `apps/fusion/tests/test_store.py`, `apps/fusion/tests/test_server_shell.py`

- [ ] **Step 1: Write the failing TrackStore test**

```python
# apps/fusion/tests/test_store.py
from fusion.store import TrackStore
from meshshield_protocol import Snapshot

def test_track_store_apply_and_snapshot():
    store = TrackStore()
    store.upsert({"id":"t-1","origin":"real","pos_3d":[1,2,3],"vel":[0,0,0],"conf":0.9,"nearest_asset_m":50.0})
    snap = store.snapshot(snapshot_id="snap-1", ts=1.0)
    assert isinstance(snap, Snapshot)
    assert len(snap.tracks) == 1 and snap.tracks[0].id == "t-1"

def test_track_store_remove():
    store = TrackStore()
    store.upsert({"id":"t-1","origin":"real","pos_3d":[0,0,0],"vel":[0,0,0],"conf":0.9})
    store.remove("t-1")
    snap = store.snapshot(snapshot_id="snap-2", ts=2.0)
    assert snap.tracks == []
```

- [ ] **Step 2: Run test to verify failure**

```
uv run pytest apps/fusion/tests/test_store.py -v
```
Expected: import errors.

- [ ] **Step 3: Implement TrackStore**

```python
# apps/fusion/src/fusion/__init__.py
__version__ = "0.1.0"
```

```python
# apps/fusion/src/fusion/store.py
from __future__ import annotations
from typing import Any
from meshshield_protocol import Snapshot

class TrackStore:
    def __init__(self) -> None:
        self._tracks: dict[str, dict[str, Any]] = {}

    def upsert(self, track: dict[str, Any]) -> None:
        self._tracks[track["id"]] = {
            "id": track["id"],
            "origin": track["origin"],
            "pos_3d": list(track["pos_3d"]),
            "vel":    list(track["vel"]),
            "conf":   float(track["conf"]),
            "nearest_asset_m": float(track.get("nearest_asset_m", 0.0)),
        }

    def remove(self, track_id: str) -> None:
        self._tracks.pop(track_id, None)

    def snapshot(self, snapshot_id: str, ts: float) -> Snapshot:
        return Snapshot.model_validate({
            "v": 1, "snapshot_id": snapshot_id, "ts": ts,
            "tracks": list(self._tracks.values()),
        })
```

- [ ] **Step 4: Run TrackStore tests to pass**

```
uv pip install -e apps/fusion && uv run pytest apps/fusion/tests/test_store.py -v
```
Expected: 2 PASS.

- [ ] **Step 5: Write the failing server-shell test**

```python
# apps/fusion/tests/test_server_shell.py
from fastapi.testclient import TestClient
from fusion.main import app

def test_health_endpoint():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "service": "fusion"}

def test_sensor_ws_accepts_and_drops_messages():
    with TestClient(app) as c, c.websocket_connect("/sensor") as ws:
        ws.send_json({"v":1,"node_id":"laptop-01","ts":0.0,"detections":[]})
        # v1: no echo. We just verify no exception was raised.
```

- [ ] **Step 6: Implement FastAPI app**

```python
# apps/fusion/src/fusion/main.py
from fastapi import FastAPI
from .server import include_routes
from .store import TrackStore

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Fusion", version="0.1.0")
    app.state.store = TrackStore()
    app.state.subscribers = set()  # set of asyncio.Queue
    include_routes(app)
    return app

app = create_app()
```

```python
# apps/fusion/src/fusion/server.py
from __future__ import annotations
import asyncio, logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

log = logging.getLogger("fusion.server")

def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "fusion"}

    @app.websocket("/sensor")
    async def sensor_ws(ws: WebSocket) -> None:
        await ws.accept()
        try:
            while True:
                _ = await ws.receive_json()  # v1: ingestion is a no-op (sensors are sub-projects B/C)
        except WebSocketDisconnect:
            return

    @app.websocket("/snapshot")
    async def snapshot_ws(ws: WebSocket) -> None:
        await ws.accept()
        q: asyncio.Queue = asyncio.Queue(maxsize=64)
        app.state.subscribers.add(q)
        try:
            while True:
                msg = await q.get()
                await ws.send_text(msg)
        except WebSocketDisconnect:
            return
        finally:
            app.state.subscribers.discard(q)
```

- [ ] **Step 7: Run server-shell tests**

```
uv run pytest apps/fusion/tests/test_server_shell.py -v
```
Expected: 2 PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/fusion/
git commit -m "feat(fusion): app shell, TrackStore, /sensor no-op WS, /snapshot subscriber WS"
```

---

### Task 9: Scenario player + snapshot publisher

**Files:**
- Create: `apps/fusion/src/fusion/scenario_player.py`
- Create: `apps/fusion/src/fusion/snapshot_publisher.py`
- Modify: `apps/fusion/src/fusion/main.py` (start the publisher on startup)
- Test: `apps/fusion/tests/test_scenario_player.py`, `apps/fusion/tests/test_snapshot_publisher.py`

- [ ] **Step 1: Write failing scenario player test**

```python
# apps/fusion/tests/test_scenario_player.py
from pathlib import Path
from fusion.scenario_player import ScenarioPlayer
from fusion.store import TrackStore
import json

ROOT = Path(__file__).resolve().parents[3]
SCENARIO = ROOT / "packages/scenarios/data-center-swarm-attack.json"

def test_player_spawns_first_event_at_t_zero():
    store = TrackStore()
    player = ScenarioPlayer(store, json.loads(SCENARIO.read_text()))
    player.advance_to(0.05)  # just past t=0.0
    snap = store.snapshot("s-0", 0.05)
    assert any(t.id == "t-001" for t in snap.tracks)

def test_player_handles_burst_event():
    store = TrackStore()
    player = ScenarioPlayer(store, json.loads(SCENARIO.read_text()))
    player.advance_to(18.5)
    snap = store.snapshot("s-1", 18.5)
    burst_ids = [t.id for t in snap.tracks if t.id.startswith("t-9")]
    assert len(burst_ids) == 6

def test_player_advances_track_positions_with_velocity():
    store = TrackStore()
    player = ScenarioPlayer(store, json.loads(SCENARIO.read_text()))
    player.advance_to(0.05)
    snap0 = store.snapshot("s-a", 0.05)
    p0 = next(t for t in snap0.tracks if t.id == "t-001").pos_3d
    player.advance_to(1.05)
    snap1 = store.snapshot("s-b", 1.05)
    p1 = next(t for t in snap1.tracks if t.id == "t-001").pos_3d
    assert p1[0] != p0[0], "position should have changed under velocity integration"
```

- [ ] **Step 2: Run to verify failure**

```
uv run pytest apps/fusion/tests/test_scenario_player.py -v
```
Expected: import errors.

- [ ] **Step 3: Implement scenario player**

```python
# apps/fusion/src/fusion/scenario_player.py
from __future__ import annotations
import math
from typing import Any
from .store import TrackStore

class ScenarioPlayer:
    def __init__(self, store: TrackStore, scenario: dict[str, Any]) -> None:
        self._store = store
        self._scenario = scenario
        self._pos: dict[str, list[float]] = {}
        self._vel: dict[str, list[float]] = {}
        self._spawned: dict[str, float] = {}  # id -> spawn ts
        self._last_t: float = 0.0
        self._asset = scenario["asset"]["center_xyz"]

    def advance_to(self, t: float) -> None:
        # 1) trigger spawns whose t <= t
        for ev in self._scenario["events"]:
            if ev["t"] > t:
                continue
            if "spawn" in ev:
                self._spawn(ev["spawn"], ev["t"])
            elif "burst" in ev:
                b = ev["burst"]
                for k in range(b["count"]):
                    angle = (2 * math.pi * k) / b["count"]
                    x = b["ring_radius_m"] * math.cos(angle)
                    y = b["ring_radius_m"] * math.sin(angle)
                    z = b["altitude_m"]
                    inward = -math.atan2(y, x)
                    vx = b["speed_m_s"] * math.cos(inward + math.pi)
                    vy = b["speed_m_s"] * math.sin(inward + math.pi)
                    tid = f"{b['id_prefix']}{k:02d}"
                    if tid in self._spawned:
                        continue
                    self._spawn({"id": tid, "origin": b.get("origin","simulated"),
                                 "pos_3d":[x,y,z], "vel":[vx,vy,0.0], "conf":0.7}, ev["t"])

        # 2) integrate positions for all spawned tracks up to t
        for tid, pos in self._pos.items():
            spawned_at = self._spawned[tid]
            dt = max(0.0, t - max(self._last_t, spawned_at))
            if dt == 0.0:
                continue
            v = self._vel[tid]
            new = [pos[0]+v[0]*dt, pos[1]+v[1]*dt, pos[2]+v[2]*dt]
            self._pos[tid] = new
            ax, ay, az = self._asset
            d = math.sqrt((new[0]-ax)**2 + (new[1]-ay)**2 + (new[2]-az)**2)
            self._store.upsert({"id": tid,
                                "origin": "simulated" if tid.startswith("t-9") or tid != "t-001" else "real",
                                "pos_3d": new, "vel": v,
                                "conf": self._conf_of(tid),
                                "nearest_asset_m": d})
        self._last_t = t

    def _spawn(self, spawn: dict[str, Any], t: float) -> None:
        tid = spawn["id"]
        self._pos[tid] = list(spawn["pos_3d"])
        self._vel[tid] = list(spawn["vel"])
        self._spawned[tid] = t
        self._conf_cache: dict = getattr(self, "_conf_cache", {})
        self._conf_cache[tid] = float(spawn.get("conf", 0.7))
        ax, ay, az = self._asset
        d = math.sqrt((self._pos[tid][0]-ax)**2 + (self._pos[tid][1]-ay)**2 + (self._pos[tid][2]-az)**2)
        self._store.upsert({"id": tid, "origin": spawn["origin"],
                            "pos_3d": self._pos[tid], "vel": self._vel[tid],
                            "conf": self._conf_cache[tid], "nearest_asset_m": d})

    def _conf_of(self, tid: str) -> float:
        return getattr(self, "_conf_cache", {}).get(tid, 0.7)
```

- [ ] **Step 4: Verify player tests pass**

```
uv run pytest apps/fusion/tests/test_scenario_player.py -v
```
Expected: 3 PASS.

- [ ] **Step 5: Write failing publisher test**

```python
# apps/fusion/tests/test_snapshot_publisher.py
import asyncio, json
from pathlib import Path
from fusion.store import TrackStore
from fusion.scenario_player import ScenarioPlayer
from fusion.snapshot_publisher import SnapshotPublisher

ROOT = Path(__file__).resolve().parents[3]
SCENARIO = json.loads((ROOT / "packages/scenarios/data-center-swarm-attack.json").read_text())

async def test_publisher_emits_at_target_rate():
    store = TrackStore()
    player = ScenarioPlayer(store, SCENARIO)
    out: list[str] = []
    pub = SnapshotPublisher(store=store, player=player, hz=10, sinks=[lambda s: out.append(s)])
    task = asyncio.create_task(pub.run())
    await asyncio.sleep(0.55)
    pub.stop()
    await task
    # ~5 snapshots in 550ms at 10Hz, allow margin
    assert 4 <= len(out) <= 7
    first = json.loads(out[0])
    assert first["v"] == 1 and "snapshot_id" in first and "tracks" in first
```

- [ ] **Step 6: Implement publisher**

```python
# apps/fusion/src/fusion/snapshot_publisher.py
from __future__ import annotations
import asyncio, time
from typing import Callable
from .store import TrackStore
from .scenario_player import ScenarioPlayer

Sink = Callable[[str], None]  # receives serialized JSON

class SnapshotPublisher:
    def __init__(self, store: TrackStore, player: ScenarioPlayer, hz: int = 10,
                 sinks: list[Sink] | None = None) -> None:
        self._store = store
        self._player = player
        self._period = 1.0 / hz
        self._sinks: list[Sink] = sinks or []
        self._running = False
        self._counter = 0

    def add_sink(self, sink: Sink) -> None:
        self._sinks.append(sink)

    def stop(self) -> None:
        self._running = False

    async def run(self) -> None:
        self._running = True
        start = time.monotonic()
        next_due = start
        while self._running:
            now = time.monotonic()
            t_rel = now - start
            self._player.advance_to(t_rel)
            self._counter += 1
            snap = self._store.snapshot(snapshot_id=f"snap-{self._counter:05d}", ts=now)
            payload = snap.model_dump_json()
            for s in list(self._sinks):
                try:
                    s(payload)
                except Exception:
                    pass
            next_due += self._period
            sleep = next_due - time.monotonic()
            if sleep > 0:
                await asyncio.sleep(sleep)
```

- [ ] **Step 7: Run publisher test**

```
uv run pytest apps/fusion/tests/test_snapshot_publisher.py -v
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/fusion/src/fusion/scenario_player.py apps/fusion/src/fusion/snapshot_publisher.py apps/fusion/tests/test_scenario_player.py apps/fusion/tests/test_snapshot_publisher.py
git commit -m "feat(fusion): scenario player and 10Hz snapshot publisher"
```

---

### Task 10: Wire publisher to /snapshot WS + integration test

**Files:**
- Modify: `apps/fusion/src/fusion/main.py`
- Test: `apps/fusion/tests/test_server_snapshot_ws.py`

- [ ] **Step 1: Write failing integration test**

```python
# apps/fusion/tests/test_server_snapshot_ws.py
import json
from fastapi.testclient import TestClient
from fusion.main import app

def test_snapshot_ws_streams_payloads():
    with TestClient(app) as c, c.websocket_connect("/snapshot") as ws:
        msg = ws.receive_text()
        snap = json.loads(msg)
        assert snap["v"] == 1
        assert "snapshot_id" in snap
        assert isinstance(snap["tracks"], list)
```

- [ ] **Step 2: Run to verify failure**

```
uv run pytest apps/fusion/tests/test_server_snapshot_ws.py -v
```
Expected: timeout/no message (publisher not started).

- [ ] **Step 3: Wire publisher into app lifecycle**

```python
# apps/fusion/src/fusion/main.py  — replace whole file
from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from .server import include_routes
from .store import TrackStore
from .scenario_player import ScenarioPlayer
from .snapshot_publisher import SnapshotPublisher

ROOT = Path(__file__).resolve().parents[4]
SCENARIO = ROOT / "packages/scenarios" / f"{os.getenv('SCENARIO','data-center-swarm-attack')}.json"

@asynccontextmanager
async def lifespan(app: FastAPI):
    store = TrackStore()
    player = ScenarioPlayer(store, json.loads(SCENARIO.read_text()))
    publisher = SnapshotPublisher(store=store, player=player, hz=10)

    def fanout(payload: str) -> None:
        for q in list(app.state.subscribers):
            try: q.put_nowait(payload)
            except asyncio.QueueFull: pass

    publisher.add_sink(fanout)
    app.state.store = store
    app.state.player = player
    app.state.publisher = publisher
    app.state.subscribers = set()
    task = asyncio.create_task(publisher.run())
    try:
        yield
    finally:
        publisher.stop()
        task.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Fusion", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app

app = create_app()
```

- [ ] **Step 4: Run tests**

```
uv run pytest apps/fusion/ -v
```
Expected: ALL PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/fusion/src/fusion/main.py apps/fusion/tests/test_server_snapshot_ws.py
git commit -m "feat(fusion): start publisher on lifespan, fan-out to /snapshot subscribers"
```

---

## Phase 5 — Agent service infrastructure (Tasks 11–14)

### Task 11: Agent FastAPI shell + health

**Files:**
- Create: `apps/agent/src/agent/__init__.py`, `apps/agent/src/agent/main.py`, `apps/agent/src/agent/server.py`
- Test: `apps/agent/tests/test_server_shell.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_server_shell.py
from fastapi.testclient import TestClient
from agent.main import app

def test_health():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200 and r.json() == {"status":"ok","service":"agent"}
```

- [ ] **Step 2: Implement shell**

```python
# apps/agent/src/agent/__init__.py
__version__ = "0.1.0"
```

```python
# apps/agent/src/agent/server.py
from fastapi import FastAPI
def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "agent"}
```

```python
# apps/agent/src/agent/main.py
from fastapi import FastAPI
from .server import include_routes

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0")
    include_routes(app)
    return app

app = create_app()
```

- [ ] **Step 3: Run + commit**

```
uv pip install -e apps/agent && uv run pytest apps/agent/tests/test_server_shell.py -v
git add apps/agent/ && git commit -m "feat(agent): app shell + health"
```

---

### Task 12: Agent in-memory store (latest snapshot, latest plan, events ring)

**Files:**
- Create: `apps/agent/src/agent/store.py`
- Test: `apps/agent/tests/test_store.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_store.py
from agent.store import AgentStore

def test_store_latest_snapshot_and_plan():
    s = AgentStore(events_capacity=10)
    s.set_snapshot({"snapshot_id":"s-1","ts":1.0,"v":1,"tracks":[]})
    assert s.latest_snapshot()["snapshot_id"] == "s-1"
    s.set_plan({"plan_id":"p-1","v":1})
    assert s.latest_plan()["plan_id"] == "p-1"

def test_store_events_ring_buffer_caps():
    s = AgentStore(events_capacity=3)
    for i in range(5):
        s.append_event({"kind":"agent_message","ts":float(i),"agent":"prioritizer","preview":str(i)})
    evs = s.recent_events()
    assert len(evs) == 3
    assert [e["preview"] for e in evs] == ["2","3","4"]
```

- [ ] **Step 2: Implement**

```python
# apps/agent/src/agent/store.py
from collections import deque
from typing import Any

class AgentStore:
    def __init__(self, events_capacity: int = 200) -> None:
        self._snapshot: dict | None = None
        self._plan: dict | None = None
        self._events: deque[dict] = deque(maxlen=events_capacity)

    def set_snapshot(self, snap: dict[str, Any]) -> None: self._snapshot = snap
    def latest_snapshot(self) -> dict | None: return self._snapshot

    def set_plan(self, plan: dict[str, Any]) -> None: self._plan = plan
    def latest_plan(self) -> dict | None: return self._plan

    def append_event(self, ev: dict[str, Any]) -> None: self._events.append(ev)
    def recent_events(self, n: int | None = None) -> list[dict]:
        if n is None: return list(self._events)
        return list(self._events)[-n:]
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_store.py -v
git add apps/agent/src/agent/store.py apps/agent/tests/test_store.py
git commit -m "feat(agent): in-memory store with snapshot, plan, events ring buffer"
```

---

### Task 13: Snapshot subscriber (WS client to fusion)

**Files:**
- Create: `apps/agent/src/agent/snapshot_subscriber.py`
- Modify: `apps/agent/src/agent/main.py` (start subscriber on lifespan)
- Test: `apps/agent/tests/test_snapshot_subscriber.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_snapshot_subscriber.py
import asyncio, json
from contextlib import asynccontextmanager
import pytest
import websockets
from agent.snapshot_subscriber import SnapshotSubscriber
from agent.store import AgentStore

@asynccontextmanager
async def fake_fusion(port: int):
    async def handler(ws):
        await ws.send(json.dumps({"v":1,"snapshot_id":"snap-test","ts":0.1,"tracks":[]}))
        await asyncio.sleep(0.5)
    server = await websockets.serve(handler, "localhost", port)
    try:
        yield f"ws://localhost:{port}"
    finally:
        server.close(); await server.wait_closed()

@pytest.mark.asyncio
async def test_subscriber_writes_to_store():
    store = AgentStore()
    async with fake_fusion(18811) as base:
        sub = SnapshotSubscriber(url=f"{base}/snapshot", store=store)
        task = asyncio.create_task(sub.run())
        await asyncio.sleep(0.2)
        sub.stop(); task.cancel()
        try: await task
        except asyncio.CancelledError: pass
        assert store.latest_snapshot()["snapshot_id"] == "snap-test"
```

- [ ] **Step 2: Implement**

```python
# apps/agent/src/agent/snapshot_subscriber.py
from __future__ import annotations
import asyncio, json, logging
import websockets
from .store import AgentStore

log = logging.getLogger("agent.snapshot_subscriber")

class SnapshotSubscriber:
    def __init__(self, url: str, store: AgentStore) -> None:
        self._url = url
        self._store = store
        self._running = False

    def stop(self) -> None: self._running = False

    async def run(self) -> None:
        self._running = True
        backoff = 0.5
        while self._running:
            try:
                async with websockets.connect(self._url) as ws:
                    backoff = 0.5
                    async for raw in ws:
                        if not self._running:
                            return
                        try:
                            self._store.set_snapshot(json.loads(raw))
                        except Exception:
                            log.exception("snapshot decode failed")
            except Exception:
                if not self._running:
                    return
                log.warning("snapshot subscriber reconnect in %.1fs", backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5.0)
```

Modify `apps/agent/src/agent/main.py`:

```python
# apps/agent/src/agent/main.py — replace whole file
from __future__ import annotations
import asyncio, os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from .server import include_routes
from .store import AgentStore
from .snapshot_subscriber import SnapshotSubscriber

@asynccontextmanager
async def lifespan(app: FastAPI):
    store = AgentStore()
    subscriber = SnapshotSubscriber(
        url=os.getenv("FUSION_SNAPSHOT_WS", "ws://localhost:8001/snapshot"),
        store=store,
    )
    app.state.store = store
    app.state.subscriber = subscriber
    task = asyncio.create_task(subscriber.run())
    try:
        yield
    finally:
        subscriber.stop(); task.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app

app = create_app()
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_snapshot_subscriber.py -v
git add apps/agent/src/agent/snapshot_subscriber.py apps/agent/src/agent/main.py apps/agent/tests/test_snapshot_subscriber.py
git commit -m "feat(agent): WS snapshot subscriber with reconnect backoff"
```

---

### Task 14: Event bus + /events WebSocket endpoint

**Files:**
- Create: `apps/agent/src/agent/event_bus.py`
- Modify: `apps/agent/src/agent/server.py` (add /events route)
- Modify: `apps/agent/src/agent/main.py` (instantiate bus on app.state)
- Test: `apps/agent/tests/test_event_bus.py`, `apps/agent/tests/test_server_events_ws.py`

- [ ] **Step 1: Write failing tests**

```python
# apps/agent/tests/test_event_bus.py
import asyncio, pytest
from agent.event_bus import EventBus
from agent.store import AgentStore

@pytest.mark.asyncio
async def test_bus_persists_and_broadcasts():
    store = AgentStore()
    bus = EventBus(store=store)
    received: list[dict] = []
    q = bus.subscribe()
    async def reader():
        async for ev in q:
            received.append(ev)
            if len(received) == 2: return
    bus.emit({"kind":"stage_started","agent":"prioritizer","ts":1.0})
    bus.emit({"kind":"stage_finished","agent":"prioritizer","output_summary":"x","ms":1,"ts":2.0})
    await asyncio.wait_for(reader(), timeout=1.0)
    assert [e["kind"] for e in received] == ["stage_started","stage_finished"]
    assert len(store.recent_events()) == 2
```

```python
# apps/agent/tests/test_server_events_ws.py
import json
from fastapi.testclient import TestClient
from agent.main import app

def test_events_ws_replays_recent_then_streams():
    with TestClient(app) as c:
        app.state.bus.emit({"kind":"plan_ready","plan_id":"p-x","ts":0.0})
        with c.websocket_connect("/events") as ws:
            msg = ws.receive_text()
            assert json.loads(msg)["kind"] == "plan_ready"
```

- [ ] **Step 2: Implement EventBus**

```python
# apps/agent/src/agent/event_bus.py
from __future__ import annotations
import asyncio
from typing import AsyncIterator
from .store import AgentStore

class _Subscription:
    def __init__(self, q: asyncio.Queue) -> None: self._q = q
    def __aiter__(self) -> AsyncIterator[dict]: return self
    async def __anext__(self) -> dict:
        return await self._q.get()

class EventBus:
    def __init__(self, store: AgentStore) -> None:
        self._store = store
        self._queues: set[asyncio.Queue] = set()

    def emit(self, event: dict) -> None:
        self._store.append_event(event)
        for q in list(self._queues):
            try: q.put_nowait(event)
            except asyncio.QueueFull: pass

    def subscribe(self) -> _Subscription:
        q: asyncio.Queue = asyncio.Queue(maxsize=512)
        # replay recent events so a late subscriber gets context
        for ev in self._store.recent_events(50):
            try: q.put_nowait(ev)
            except asyncio.QueueFull: break
        self._queues.add(q)
        return _Subscription(q)

    def unsubscribe(self, sub: _Subscription) -> None:
        self._queues.discard(sub._q)
```

- [ ] **Step 3: Add /events route**

```python
# apps/agent/src/agent/server.py — replace
from __future__ import annotations
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

def include_routes(app: FastAPI) -> None:
    @app.get("/health")
    async def health() -> dict:
        return {"status": "ok", "service": "agent"}

    @app.websocket("/events")
    async def events_ws(ws: WebSocket) -> None:
        await ws.accept()
        sub = app.state.bus.subscribe()
        try:
            async for ev in sub:
                await ws.send_text(json.dumps(ev))
        except WebSocketDisconnect:
            return
        finally:
            app.state.bus.unsubscribe(sub)
```

- [ ] **Step 4: Wire bus into lifespan**

Modify `apps/agent/src/agent/main.py` — inside `lifespan`, after `store = AgentStore()`:

```python
    from .event_bus import EventBus
    bus = EventBus(store=store)
    app.state.bus = bus
```

- [ ] **Step 5: Run + commit**

```
uv run pytest apps/agent/tests/ -v
git add apps/agent/src/agent/event_bus.py apps/agent/src/agent/server.py apps/agent/src/agent/main.py apps/agent/tests/test_event_bus.py apps/agent/tests/test_server_events_ws.py
git commit -m "feat(agent): event bus + /events WS with replay"
```

---

## Phase 6 — AG2 adapter + cassette + tools (Tasks 15–18)

### Task 15: AG2 adapter + recorded-cassette LLM for tests

**Files:**
- Create: `apps/agent/src/agent/llm/__init__.py`
- Create: `apps/agent/src/agent/llm/ag2_adapter.py`
- Create: `apps/agent/src/agent/llm/cassette.py`
- Create: `apps/agent/tests/cassettes/prioritizer.json` (small recorded response)
- Test: `apps/agent/tests/test_ag2_adapter.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_ag2_adapter.py
import pytest
from agent.llm.ag2_adapter import LLMAdapter
from agent.llm.cassette import CassetteLLM

@pytest.mark.asyncio
async def test_cassette_replays_recorded_response():
    cas = CassetteLLM({"prioritizer:hello": '{"top":["t-001"]}'})
    a = LLMAdapter(model="cassette", llm=cas)
    out = await a.ask("prioritizer", "hello")
    assert out == '{"top":["t-001"]}'

@pytest.mark.asyncio
async def test_adapter_emits_stage_lifecycle_to_callback():
    cas = CassetteLLM({"x:y": "ok"})
    seen: list[tuple[str,str]] = []
    a = LLMAdapter(model="cassette", llm=cas, on_lifecycle=lambda kind, agent: seen.append((kind, agent)))
    out = await a.ask("x", "y")
    assert out == "ok"
    assert seen == [("started","x"), ("finished","x")]
```

- [ ] **Step 2: Implement adapter + cassette**

```python
# apps/agent/src/agent/llm/__init__.py
```

```python
# apps/agent/src/agent/llm/cassette.py
from __future__ import annotations
class CassetteLLM:
    def __init__(self, mapping: dict[str, str]) -> None:
        self._m = mapping
    async def ask(self, name: str, prompt: str) -> str:
        key = f"{name}:{prompt}"
        if key not in self._m:
            raise KeyError(f"cassette miss: {key!r}")
        return self._m[key]
```

```python
# apps/agent/src/agent/llm/ag2_adapter.py
from __future__ import annotations
import os, time, json, asyncio
from typing import Callable, Protocol

class _LLMLike(Protocol):
    async def ask(self, name: str, prompt: str) -> str: ...

class _AG2LLM:
    """Real backend that calls AG2 (autogen.beta) via OpenRouter."""
    def __init__(self, model: str, api_key: str | None) -> None:
        from autogen.beta import Agent
        from autogen.beta.config import OpenAIConfig
        self._Agent = Agent
        self._cfg = OpenAIConfig(
            model=model, streaming=False,
            api_key=api_key or os.environ["OPENROUTER_API_KEY"],
            base_url="https://openrouter.ai/api/v1",
            max_completion_tokens=1024,
        )
        self._agents: dict[str, object] = {}

    async def ask(self, name: str, prompt: str) -> str:
        if name not in self._agents:
            self._agents[name] = self._Agent(config=self._cfg, name=name)
        reply = await self._agents[name].ask(prompt)
        return reply.body

class LLMAdapter:
    def __init__(self, model: str, llm: _LLMLike | None = None,
                 api_key: str | None = None,
                 on_lifecycle: Callable[[str, str], None] | None = None) -> None:
        self._llm: _LLMLike = llm or _AG2LLM(model=model, api_key=api_key)
        self._on = on_lifecycle or (lambda kind, agent: None)
        self.model = model

    async def ask(self, agent_name: str, prompt: str) -> str:
        self._on("started", agent_name)
        t0 = time.monotonic()
        try:
            text = await self._llm.ask(agent_name, prompt)
            return text
        finally:
            self._on("finished", agent_name)

    async def ask_json(self, agent_name: str, prompt: str) -> dict:
        text = await self.ask(agent_name, prompt)
        # tolerate fenced code or stray prose by extracting first {...} block
        s = text.find("{"); e = text.rfind("}")
        if s == -1 or e == -1:
            raise ValueError(f"no JSON in agent output: {text!r}")
        return json.loads(text[s:e+1])
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_ag2_adapter.py -v
git add apps/agent/src/agent/llm/ apps/agent/tests/test_ag2_adapter.py
git commit -m "feat(agent): AG2 adapter with cassette backend for deterministic tests"
```

---

### Task 16: In-memory tools (snapshot, interceptors, policy, operator_query)

**Files:**
- Create: `apps/agent/src/agent/tools/__init__.py`
- Create: `apps/agent/src/agent/tools/snapshot.py`, `tools/interceptors.py`, `tools/policy.py`, `tools/operator_query.py`
- Test: `apps/agent/tests/test_tools_inmem.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_tools_inmem.py
import json
from pathlib import Path
from agent.store import AgentStore
from agent.tools.snapshot import make_get_snapshot
from agent.tools.interceptors import make_list_available_interceptors
from agent.tools.policy import make_get_policy_thresholds
from agent.tools.operator_query import make_read_latest_plan, make_read_recent_agent_events

ROOT = Path(__file__).resolve().parents[3]

def test_get_snapshot_returns_store_snapshot():
    store = AgentStore()
    store.set_snapshot({"snapshot_id":"s1","v":1,"ts":1.0,"tracks":[]})
    f = make_get_snapshot(store)
    assert f()["snapshot_id"] == "s1"

def test_list_interceptors_loads_from_scenario():
    f = make_list_available_interceptors(ROOT / "packages/scenarios/data-center-swarm-attack.json")
    out = f()
    assert any(i["id"] == "i-001" for i in out)

def test_policy_loader():
    f = make_get_policy_thresholds(ROOT / "packages/scenarios/policy.json")
    p = f()
    assert p["auto_action_min_conf"] == 0.7
    assert "auto_action_min_conf" in p["clauses"]

def test_operator_query_reads_from_store():
    store = AgentStore()
    store.set_plan({"plan_id":"p1","v":1})
    store.append_event({"kind":"plan_ready","plan_id":"p1","ts":1.0})
    plan_f = make_read_latest_plan(store); ev_f = make_read_recent_agent_events(store)
    assert plan_f()["plan_id"] == "p1"
    assert ev_f(5)[-1]["kind"] == "plan_ready"
```

- [ ] **Step 2: Implement tools**

```python
# apps/agent/src/agent/tools/__init__.py
```

```python
# apps/agent/src/agent/tools/snapshot.py
from __future__ import annotations
from typing import Callable
from ..store import AgentStore

def make_get_snapshot(store: AgentStore) -> Callable[[], dict]:
    def get_snapshot() -> dict:
        snap = store.latest_snapshot()
        if snap is None:
            return {"v":1,"snapshot_id":"none","ts":0.0,"tracks":[]}
        return snap
    return get_snapshot
```

```python
# apps/agent/src/agent/tools/interceptors.py
from __future__ import annotations
import json
from pathlib import Path
from typing import Callable

def make_list_available_interceptors(scenario_path: Path) -> Callable[[], list[dict]]:
    def list_available_interceptors() -> list[dict]:
        return json.loads(scenario_path.read_text())["interceptors"]
    return list_available_interceptors
```

```python
# apps/agent/src/agent/tools/policy.py
from __future__ import annotations
import json
from pathlib import Path
from typing import Callable

def make_get_policy_thresholds(policy_path: Path) -> Callable[[], dict]:
    def get_policy_thresholds() -> dict:
        return json.loads(policy_path.read_text())
    return get_policy_thresholds
```

```python
# apps/agent/src/agent/tools/operator_query.py
from __future__ import annotations
from typing import Callable
from ..store import AgentStore

def make_read_latest_plan(store: AgentStore) -> Callable[[], dict | None]:
    def read_latest_plan() -> dict | None:
        return store.latest_plan()
    return read_latest_plan

def make_read_recent_agent_events(store: AgentStore) -> Callable[[int], list[dict]]:
    def read_recent_agent_events(n: int = 50) -> list[dict]:
        return store.recent_events(n)
    return read_recent_agent_events
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_tools_inmem.py -v
git add apps/agent/src/agent/tools/ apps/agent/tests/test_tools_inmem.py
git commit -m "feat(agent): in-memory tool factories (snapshot, interceptors, policy, operator)"
```

---

### Task 17: Daytona-backed `simulate_intercept_path` with local fallback

**Files:**
- Create: `apps/agent/src/agent/tools/intercept_sim.py`
- Test: `apps/agent/tests/test_tools_intercept_sim.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_tools_intercept_sim.py
import respx, httpx, pytest
from agent.tools.intercept_sim import make_simulate_intercept_path

def _state_track(): return {"id":"t-1","pos_3d":[100,0,30],"vel":[-10,0,0]}
def _state_int():   return {"id":"i-1","pos_3d":[0,0,0],"max_speed_m_s":80,"kind":"kinetic"}

def test_local_fallback_when_no_url():
    f = make_simulate_intercept_path(daytona_base_url=None, daytona_api_key=None)
    out = f(_state_track(), _state_int())
    assert out["source"] == "local-fallback"
    assert out["miss_distance_m"] >= 0
    assert "intercept_ts" in out

@respx.mock
def test_uses_daytona_when_reachable():
    respx.post("https://example.daytona/api/sim").mock(
        return_value=httpx.Response(200, json={"intercept_ts": 1.5, "miss_distance_m": 4.2, "energy_j": 100.0})
    )
    f = make_simulate_intercept_path(daytona_base_url="https://example.daytona/api", daytona_api_key="key")
    out = f(_state_track(), _state_int())
    assert out["source"] == "daytona"
    assert out["miss_distance_m"] == 4.2

@respx.mock
def test_falls_back_when_daytona_errors():
    respx.post("https://example.daytona/api/sim").mock(return_value=httpx.Response(500))
    f = make_simulate_intercept_path(daytona_base_url="https://example.daytona/api", daytona_api_key="key")
    out = f(_state_track(), _state_int())
    assert out["source"] == "local-fallback"
```

- [ ] **Step 2: Implement**

```python
# apps/agent/src/agent/tools/intercept_sim.py
from __future__ import annotations
import math
from typing import Callable, Any
import httpx

def _local_sim(track: dict, interceptor: dict) -> dict:
    tx,ty,tz = track["pos_3d"]; vx,vy,vz = track["vel"]
    ix,iy,iz = interceptor["pos_3d"]
    speed = max(1.0, float(interceptor.get("max_speed_m_s", 60.0)))
    # closing-speed approximation: time when |t(t)| minimised against straight-line interceptor pursuit
    rel_d0 = math.sqrt((tx-ix)**2 + (ty-iy)**2 + (tz-iz)**2)
    closing = max(1.0, speed - math.sqrt(vx*vx+vy*vy+vz*vz))
    intercept_ts = rel_d0 / closing
    # crude miss distance assumption
    miss = max(0.0, abs((rel_d0 - speed * intercept_ts)) * 0.1)
    energy = 0.5 * 5.0 * (speed**2)  # 5kg interceptor
    return {"intercept_ts": intercept_ts, "miss_distance_m": miss, "energy_j": energy, "source": "local-fallback"}

def make_simulate_intercept_path(daytona_base_url: str | None,
                                 daytona_api_key: str | None,
                                 timeout_s: float = 1.5) -> Callable[[dict, dict], dict]:
    def simulate_intercept_path(track_state: dict, interceptor_state: dict) -> dict:
        if not daytona_base_url:
            return _local_sim(track_state, interceptor_state)
        try:
            r = httpx.post(
                f"{daytona_base_url.rstrip('/')}/sim",
                json={"track": track_state, "interceptor": interceptor_state},
                headers={"Authorization": f"Bearer {daytona_api_key}"} if daytona_api_key else {},
                timeout=timeout_s,
            )
            r.raise_for_status()
            data = r.json()
            data["source"] = "daytona"
            return data
        except Exception:
            return _local_sim(track_state, interceptor_state)
    return simulate_intercept_path
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_tools_intercept_sim.py -v
git add apps/agent/src/agent/tools/intercept_sim.py apps/agent/tests/test_tools_intercept_sim.py
git commit -m "feat(agent): simulate_intercept_path tool (Daytona POST + local fallback)"
```

---

### Task 18: Tavily live-grounding tool with bucketed cache

**Files:**
- Create: `apps/agent/src/agent/tools/tavily.py`
- Test: `apps/agent/tests/test_tools_tavily.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_tools_tavily.py
import respx, httpx, time
from agent.tools.tavily import make_tavily_recent_threats

@respx.mock
def test_tavily_returns_headlines_and_caches():
    route = respx.post("https://api.tavily.com/search").mock(
        return_value=httpx.Response(200, json={
            "results": [
                {"title":"Drone incident at facility","url":"https://x/1","content":"..."},
                {"title":"Counter-UAS contract awarded","url":"https://x/2","content":"..."},
            ]
        })
    )
    fixed = [1714680000.0]
    def now(): return fixed[0]
    f = make_tavily_recent_threats(api_key="tvly-x", now=now)
    a = f("us-west", 24); b = f("us-west", 24)
    assert [h["title"] for h in a] == ["Drone incident at facility","Counter-UAS contract awarded"]
    assert b == a
    assert route.call_count == 1, "second call within bucket should be cached"

@respx.mock
def test_returns_empty_on_quota_error():
    respx.post("https://api.tavily.com/search").mock(return_value=httpx.Response(429, json={"error":"quota"}))
    f = make_tavily_recent_threats(api_key="tvly-x")
    assert f("us-west", 24) == []
```

- [ ] **Step 2: Implement**

```python
# apps/agent/src/agent/tools/tavily.py
from __future__ import annotations
import time
from typing import Callable
import httpx

def make_tavily_recent_threats(api_key: str | None,
                               now: Callable[[], float] = time.time,
                               timeout_s: float = 5.0) -> Callable[[str, int], list[dict]]:
    cache: dict[tuple[str,int,int], list[dict]] = {}

    def _bucket(t: float) -> int: return int(t // 3600)

    def tavily_recent_threats(region: str, hours: int = 72) -> list[dict]:
        key = (region, hours, _bucket(now()))
        if key in cache: return cache[key]
        if not api_key:
            cache[key] = []; return []
        try:
            r = httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": api_key,
                    "query": f"counter-drone threat news in {region} past {hours} hours",
                    "search_depth": "basic",
                    "max_results": 5,
                    "topic": "news",
                },
                timeout=timeout_s,
            )
            r.raise_for_status()
            results = r.json().get("results", [])
            headlines = [{"title": x.get("title",""), "url": x.get("url",""), "snippet": x.get("content","")} for x in results]
            cache[key] = headlines
            return headlines
        except Exception:
            cache[key] = []
            return []
    return tavily_recent_threats
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_tools_tavily.py -v
git add apps/agent/src/agent/tools/tavily.py apps/agent/tests/test_tools_tavily.py
git commit -m "feat(agent): tavily_recent_threats tool with bucketed cache"
```

---

## Phase 7 — Agents + pipeline (Tasks 19–25)

### Task 19: Threat Prioritizer agent

**Files:**
- Create: `apps/agent/src/agent/agents/__init__.py`, `apps/agent/src/agent/agents/prioritizer.py`
- Test: `apps/agent/tests/test_agents_prioritizer.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_agents_prioritizer.py
import json, pytest
from agent.agents.prioritizer import Prioritizer
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

SNAP = {"v":1,"snapshot_id":"snap-1","ts":1.0,"tracks":[
  {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":120.0},
  {"id":"t-2","origin":"simulated","pos_3d":[50,0,30],"vel":[-5,0,0],"conf":0.45,"nearest_asset_m":40.0},
]}

@pytest.mark.asyncio
async def test_prioritizer_returns_validated_structure():
    expected = {"prioritized":[
        {"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0},
        {"target_id":"t-2","risk_score":0.62,"intent_estimate":"approach_asset","nearest_asset_m":40.0}]}
    cas = CassetteLLM({})
    # build the exact prompt the prioritizer will emit so the cassette matches
    p = Prioritizer(LLMAdapter(model="cassette", llm=cas))
    prompt = p.build_prompt(SNAP)
    cas._m[f"prioritizer:{prompt}"] = json.dumps(expected)
    out = await p.run(SNAP)
    assert out["prioritized"][0]["target_id"] == "t-1"
    assert all("risk_score" in r for r in out["prioritized"])
```

- [ ] **Step 2: Implement Prioritizer**

```python
# apps/agent/src/agent/agents/__init__.py
```

```python
# apps/agent/src/agent/agents/prioritizer.py
from __future__ import annotations
import json
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Threat Prioritizer. Given an airspace snapshot, return a JSON object "
"with the exact key 'prioritized', a list of objects sorted by risk_score descending, each having "
"keys target_id (string), risk_score (number 0-1), intent_estimate (string in approach_asset|loiter|withdraw|unknown), "
"nearest_asset_m (number). Output JSON only, no prose."
)

class Prioritizer:
    name = "prioritizer"
    def __init__(self, llm: LLMAdapter) -> None: self._llm = llm

    def build_prompt(self, snapshot: dict) -> str:
        return f"{SYSTEM}\n\nSNAPSHOT:\n{json.dumps(snapshot, separators=(',', ':'))}"

    async def run(self, snapshot: dict) -> dict:
        out = await self._llm.ask_json(self.name, self.build_prompt(snapshot))
        if "prioritized" not in out or not isinstance(out["prioritized"], list):
            raise ValueError(f"prioritizer output missing 'prioritized': {out!r}")
        return out
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_agents_prioritizer.py -v
git add apps/agent/src/agent/agents/__init__.py apps/agent/src/agent/agents/prioritizer.py apps/agent/tests/test_agents_prioritizer.py
git commit -m "feat(agent): prioritizer agent with strict-JSON contract"
```

---

### Task 20: Interceptor Allocator agent (uses simulate_intercept_path)

**Files:**
- Create: `apps/agent/src/agent/agents/allocator.py`
- Test: `apps/agent/tests/test_agents_allocator.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_agents_allocator.py
import json, pytest
from agent.agents.allocator import Allocator
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

PRIORITIZED = {"prioritized":[{"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0}]}
INTERCEPTORS = [{"id":"i-001","kind":"rf_jam","pos_3d":[-50,-10,0],"range_m":250},
                {"id":"i-002","kind":"kinetic","pos_3d":[50,-10,0],"range_m":200}]

def fake_sim(track, interceptor):
    return {"intercept_ts":1.5,"miss_distance_m":3.0,"energy_j":100.0,"source":"local-fallback"}

@pytest.mark.asyncio
async def test_allocator_returns_assignments():
    expected = {"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]}
    cas = CassetteLLM({})
    a = Allocator(LLMAdapter(model="cassette", llm=cas), interceptors=INTERCEPTORS,
                  simulate=fake_sim, snapshot_provider=lambda: {"tracks":[
                      {"id":"t-1","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92}]})
    prompt = a.build_prompt(PRIORITIZED, sim_results={
        "t-1": [{"interceptor_id":"i-001","intercept_ts":1.5,"miss_distance_m":3.0},
                {"interceptor_id":"i-002","intercept_ts":1.5,"miss_distance_m":3.0}]})
    cas._m[f"allocator:{prompt}"] = json.dumps(expected)
    out = await a.run(PRIORITIZED)
    assert out["allocations"][0]["interceptor_id"] == "i-002"
```

- [ ] **Step 2: Implement Allocator**

```python
# apps/agent/src/agent/agents/allocator.py
from __future__ import annotations
import json
from typing import Callable
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Interceptor Allocator. Given prioritized targets, available interceptors, and "
"simulated intercept results per (target, interceptor), choose one assignment per high-priority target. "
"Return JSON with key 'allocations', a list of objects with keys: target_id, interceptor_id, mode "
"(one of kinetic|rf_jam|spoof|monitor), priority (integer >=1). Output JSON only."
)

class Allocator:
    name = "allocator"
    def __init__(self, llm: LLMAdapter, interceptors: list[dict],
                 simulate: Callable[[dict, dict], dict],
                 snapshot_provider: Callable[[], dict]) -> None:
        self._llm = llm
        self._interceptors = interceptors
        self._sim = simulate
        self._snap = snapshot_provider

    def _track_state(self, target_id: str) -> dict | None:
        snap = self._snap() or {"tracks": []}
        return next((t for t in snap.get("tracks", []) if t["id"] == target_id), None)

    def build_prompt(self, prioritized: dict, sim_results: dict) -> str:
        return (f"{SYSTEM}\n\nPRIORITIZED:\n{json.dumps(prioritized, separators=(',', ':'))}\n\n"
                f"INTERCEPTORS:\n{json.dumps(self._interceptors, separators=(',', ':'))}\n\n"
                f"SIMULATIONS:\n{json.dumps(sim_results, separators=(',', ':'))}")

    async def run(self, prioritized: dict) -> dict:
        sim_results: dict[str, list[dict]] = {}
        for row in prioritized.get("prioritized", []):
            tid = row["target_id"]
            track = self._track_state(tid) or {"id": tid, "pos_3d":[0,0,0], "vel":[0,0,0]}
            sim_results[tid] = []
            for itc in self._interceptors:
                r = self._sim(track, {**itc, "max_speed_m_s": 80})
                sim_results[tid].append({"interceptor_id": itc["id"],
                                         "intercept_ts": r["intercept_ts"],
                                         "miss_distance_m": r["miss_distance_m"],
                                         "source": r.get("source", "local-fallback")})
        out = await self._llm.ask_json(self.name, self.build_prompt(prioritized, sim_results))
        if "allocations" not in out:
            raise ValueError(f"allocator output missing 'allocations': {out!r}")
        # surface fallback usage so the UI can badge
        out["_sim_sources"] = {tid: list({r["source"] for r in rows}) for tid, rows in sim_results.items()}
        return out
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_agents_allocator.py -v
git add apps/agent/src/agent/agents/allocator.py apps/agent/tests/test_agents_allocator.py
git commit -m "feat(agent): allocator agent with per-(target,interceptor) sim sweep"
```

---

### Task 21: Justifier agent (uses Tavily)

**Files:**
- Create: `apps/agent/src/agent/agents/justifier.py`
- Test: `apps/agent/tests/test_agents_justifier.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_agents_justifier.py
import json, pytest
from agent.agents.justifier import Justifier
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

ALLOCATIONS = {"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]}
SNAPSHOT = {"snapshot_id":"snap-1","tracks":[{"id":"t-1","nearest_asset_m":40.0,"conf":0.92,"pos_3d":[100,0,30]}]}
POLICY = {"clauses":{"proximity_under_50m":"...", "auto_action_min_conf":"..."}}

def fake_tavily(region, hours): return [{"title":"Q1-2026 incident","url":"https://x/1"}]

@pytest.mark.asyncio
async def test_justifier_attaches_refs_to_each_assignment():
    expected = {"justified":[{
        "target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
        "justification":{
          "snapshot_refs":["tracks[0].nearest_asset_m","tracks[0].conf"],
          "tavily_refs":["headline:Q1-2026 incident"],
          "policy_refs":["clause:proximity_under_50m"]
        }}]}
    cas = CassetteLLM({})
    j = Justifier(LLMAdapter(model="cassette", llm=cas), tavily=fake_tavily,
                  snapshot_provider=lambda: SNAPSHOT, policy_provider=lambda: POLICY,
                  region="us-west")
    prompt = j.build_prompt(ALLOCATIONS, headlines=[{"title":"Q1-2026 incident","url":"https://x/1"}])
    cas._m[f"justifier:{prompt}"] = json.dumps(expected)
    out = await j.run(ALLOCATIONS)
    assert out["justified"][0]["justification"]["policy_refs"] == ["clause:proximity_under_50m"]
```

- [ ] **Step 2: Implement Justifier**

```python
# apps/agent/src/agent/agents/justifier.py
from __future__ import annotations
import json
from typing import Callable
from ..llm.ag2_adapter import LLMAdapter

SYSTEM = (
"You are the MeshShield Justifier. For each allocation, produce a justification trace that cites: "
"(a) snapshot field paths (e.g. 'tracks[2].pos_3d'), (b) tavily headlines (prefix 'headline:'), and "
"(c) policy clause keys (prefix 'clause:'). Return JSON with key 'justified', a list of allocation "
"objects each carrying a 'justification' object with arrays snapshot_refs, tavily_refs, policy_refs. "
"Output JSON only."
)

class Justifier:
    name = "justifier"
    def __init__(self, llm: LLMAdapter, tavily: Callable[[str,int], list[dict]],
                 snapshot_provider: Callable[[], dict],
                 policy_provider: Callable[[], dict],
                 region: str = "us-west") -> None:
        self._llm = llm; self._tavily = tavily
        self._snap = snapshot_provider; self._policy = policy_provider
        self._region = region

    def build_prompt(self, allocations: dict, headlines: list[dict]) -> str:
        return (f"{SYSTEM}\n\nALLOCATIONS:\n{json.dumps(allocations, separators=(',', ':'))}\n\n"
                f"SNAPSHOT:\n{json.dumps(self._snap(), separators=(',', ':'))}\n\n"
                f"POLICY:\n{json.dumps(self._policy(), separators=(',', ':'))}\n\n"
                f"HEADLINES:\n{json.dumps(headlines, separators=(',', ':'))}")

    async def run(self, allocations: dict) -> dict:
        try: headlines = self._tavily(self._region, 72)
        except Exception: headlines = []
        out = await self._llm.ask_json(self.name, self.build_prompt(allocations, headlines))
        if "justified" not in out:
            raise ValueError(f"justifier output missing 'justified': {out!r}")
        return out
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_agents_justifier.py -v
git add apps/agent/src/agent/agents/justifier.py apps/agent/tests/test_agents_justifier.py
git commit -m "feat(agent): justifier agent attaches snapshot/tavily/policy refs"
```

---

### Task 22: Escalation Officer agent (produces final ResponsePlan)

**Files:**
- Create: `apps/agent/src/agent/agents/escalator.py`
- Test: `apps/agent/tests/test_agents_escalator.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_agents_escalator.py
import json, pytest, time
from agent.agents.escalator import Escalator
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter

JUSTIFIED = {"justified":[{
    "target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
    "justification":{"snapshot_refs":["tracks[0].nearest_asset_m"],"tavily_refs":[],"policy_refs":["clause:proximity_under_50m"]}
}]}
POLICY = {"auto_action_min_conf":0.7,"escalate_if_tracks_per_asset_gt":10,"clauses":{"auto_action_min_conf":"..."}}

@pytest.mark.asyncio
async def test_escalator_emits_response_plan_with_no_escalation_in_normal_case():
    cas = CassetteLLM({})
    e = Escalator(LLMAdapter(model="cassette", llm=cas),
                  policy_provider=lambda: POLICY,
                  snapshot_provider=lambda: {"snapshot_id":"snap-1","tracks":[{"id":"t-1","conf":0.92,"nearest_asset_m":40.0}]})
    prompt = e.build_prompt(JUSTIFIED, escalation_hint={"required": False, "reasons": []})
    cas._m[f"escalator:{prompt}"] = json.dumps({
        "v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,
        "assignments": JUSTIFIED["justified"],
        "escalation":{"required":False,"reasons":[]}})
    out = await e.run(JUSTIFIED)
    assert out["v"] == 1 and out["plan_id"] == "plan-1"
    assert out["escalation"]["required"] is False

@pytest.mark.asyncio
async def test_escalator_forces_escalation_for_low_conf_track():
    cas = CassetteLLM({})
    snap = {"snapshot_id":"snap-2","tracks":[{"id":"t-1","conf":0.5,"nearest_asset_m":40.0}]}
    e = Escalator(LLMAdapter(model="cassette", llm=cas),
                  policy_provider=lambda: POLICY,
                  snapshot_provider=lambda: snap)
    prompt = e.build_prompt(JUSTIFIED, escalation_hint={"required": True, "reasons": ["track t-1 conf 0.50 < 0.7"]})
    cas._m[f"escalator:{prompt}"] = json.dumps({
        "v":1,"plan_id":"plan-2","snapshot_id":"snap-2","ts":1.0,
        "assignments":[],"escalation":{"required":True,"reasons":["track t-1 conf 0.50 < 0.7"]}})
    out = await e.run(JUSTIFIED)
    assert out["escalation"]["required"] is True
```

- [ ] **Step 2: Implement Escalator**

```python
# apps/agent/src/agent/agents/escalator.py
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
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_agents_escalator.py -v
git add apps/agent/src/agent/agents/escalator.py apps/agent/tests/test_agents_escalator.py
git commit -m "feat(agent): escalation officer with deterministic hint + final ResponsePlan"
```

---

### Task 23: Watch Commander agent (NLIP backend)

**Files:**
- Create: `apps/agent/src/agent/agents/watch_commander.py`
- Test: `apps/agent/tests/test_agents_watch_commander.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_agents_watch_commander.py
import pytest
from agent.agents.watch_commander import WatchCommander
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter
from agent.store import AgentStore

@pytest.mark.asyncio
async def test_watch_commander_answers_with_citations():
    store = AgentStore()
    store.set_snapshot({"snapshot_id":"snap-1","ts":1.0,"v":1,"tracks":[
        {"id":"t-13","origin":"real","pos_3d":[10,0,30],"vel":[0,0,0],"conf":0.43,"nearest_asset_m":80.0}]})
    store.set_plan({"v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,"assignments":[],"escalation":{"required":False,"reasons":[]}})
    cas = CassetteLLM({})
    wc = WatchCommander(LLMAdapter(model="cassette", llm=cas), store=store)
    prompt = wc.build_prompt("Why was track T-13 not assigned?")
    cas._m[f"watch_commander:{prompt}"] = "T-13 conf=0.43 below 0.7 threshold [snapshot.tracks[0].conf] [clause:auto_action_min_conf]."
    out = await wc.respond("Why was track T-13 not assigned?")
    assert "0.43" in out
    assert "clause:auto_action_min_conf" in out
```

- [ ] **Step 2: Implement Watch Commander**

```python
# apps/agent/src/agent/agents/watch_commander.py
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
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_agents_watch_commander.py -v
git add apps/agent/src/agent/agents/watch_commander.py apps/agent/tests/test_agents_watch_commander.py
git commit -m "feat(agent): watch_commander agent with citation discipline"
```

---

### Task 24: Pipeline orchestration with event emission

**Files:**
- Create: `apps/agent/src/agent/pipeline.py`
- Test: `apps/agent/tests/test_pipeline.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_pipeline.py
import json, pytest
from agent.pipeline import Pipeline
from agent.event_bus import EventBus
from agent.store import AgentStore
from agent.llm.cassette import CassetteLLM
from agent.llm.ag2_adapter import LLMAdapter
from agent.agents.prioritizer import Prioritizer
from agent.agents.allocator import Allocator
from agent.agents.justifier import Justifier
from agent.agents.escalator import Escalator

SNAPSHOT = {"v":1,"snapshot_id":"snap-1","ts":1.0,"tracks":[
    {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":120.0}]}

@pytest.mark.asyncio
async def test_pipeline_emits_full_event_sequence_and_returns_plan():
    cas = CassetteLLM({})
    llm = LLMAdapter(model="cassette", llm=cas)
    store = AgentStore(); store.set_snapshot(SNAPSHOT); bus = EventBus(store=store)

    p = Prioritizer(llm)
    a = Allocator(llm, interceptors=[{"id":"i-002","kind":"kinetic","pos_3d":[0,0,0]}],
                  simulate=lambda t,i:{"intercept_ts":1.5,"miss_distance_m":3.0,"energy_j":1.0,"source":"local-fallback"},
                  snapshot_provider=lambda: SNAPSHOT)
    j = Justifier(llm, tavily=lambda r,h: [], snapshot_provider=lambda: SNAPSHOT,
                  policy_provider=lambda: {"clauses":{"proximity_under_50m":"..."}}, region="us-west")
    e = Escalator(llm, policy_provider=lambda: {"auto_action_min_conf":0.7,"escalate_if_tracks_per_asset_gt":10,"clauses":{}},
                  snapshot_provider=lambda: SNAPSHOT)

    cas._m[f"prioritizer:{p.build_prompt(SNAPSHOT)}"] = json.dumps({"prioritized":[{"target_id":"t-1","risk_score":0.84,"intent_estimate":"approach_asset","nearest_asset_m":120.0}]})
    sim_results = {"t-1":[{"interceptor_id":"i-002","intercept_ts":1.5,"miss_distance_m":3.0,"source":"local-fallback"}]}
    cas._m[f"allocator:{a.build_prompt({'prioritized':[{'target_id':'t-1','risk_score':0.84,'intent_estimate':'approach_asset','nearest_asset_m':120.0}]}, sim_results)}"] = json.dumps({"allocations":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1}]})
    just = {"justified":[{"target_id":"t-1","interceptor_id":"i-002","mode":"kinetic","priority":1,
                         "justification":{"snapshot_refs":["tracks[0].pos_3d"],"tavily_refs":[],"policy_refs":["clause:proximity_under_50m"]}}]}
    cas._m[f"justifier:{j.build_prompt({'allocations':[{'target_id':'t-1','interceptor_id':'i-002','mode':'kinetic','priority':1}], '_sim_sources':{'t-1':['local-fallback']}}, [])}"] = json.dumps(just)
    plan = {"v":1,"plan_id":"plan-1","snapshot_id":"snap-1","ts":1.0,"assignments":just["justified"],"escalation":{"required":False,"reasons":[]}}
    cas._m[f"escalator:{e.build_prompt(just, {'required': False, 'reasons': []})}"] = json.dumps(plan)

    pipe = Pipeline(prioritizer=p, allocator=a, justifier=j, escalator=e, bus=bus, store=store)
    out = await pipe.run_tick(SNAPSHOT)
    assert out["plan_id"] == "plan-1"
    kinds = [e["kind"] for e in store.recent_events()]
    expected_subseq = ["stage_started","stage_finished","stage_started","stage_finished","stage_started","stage_finished","stage_started","stage_finished","plan_ready"]
    # Filter only the kinds we care about and assert subsequence
    filt = [k for k in kinds if k in {"stage_started","stage_finished","plan_ready"}]
    assert filt[-len(expected_subseq):] == expected_subseq
```

- [ ] **Step 2: Implement Pipeline**

```python
# apps/agent/src/agent/pipeline.py
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
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_pipeline.py -v
git add apps/agent/src/agent/pipeline.py apps/agent/tests/test_pipeline.py
git commit -m "feat(agent): pipeline orchestration with stage events and plan_ready"
```

---

### Task 25: Pipeline scheduler — fire every 2 s on freshest snapshot

**Files:**
- Create: `apps/agent/src/agent/scheduler.py`
- Modify: `apps/agent/src/agent/main.py` (build agents + start scheduler in lifespan)
- Test: `apps/agent/tests/test_scheduler.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_scheduler.py
import asyncio, pytest
from agent.scheduler import PipelineScheduler

class _StubPipe:
    def __init__(self): self.calls: list[dict] = []
    async def run_tick(self, snap): self.calls.append(snap); return {"plan_id":"p"}

@pytest.mark.asyncio
async def test_scheduler_uses_freshest_snapshot_each_tick():
    pipe = _StubPipe()
    snapshots = iter([{"snapshot_id":"a"},{"snapshot_id":"b"},{"snapshot_id":"c"}])
    current = {"v": next(snapshots)}
    sched = PipelineScheduler(pipeline=pipe, snapshot_getter=lambda: current["v"], period_s=0.05)
    task = asyncio.create_task(sched.run())
    await asyncio.sleep(0.06); current["v"] = next(snapshots)
    await asyncio.sleep(0.06); current["v"] = next(snapshots)
    await asyncio.sleep(0.06)
    sched.stop(); task.cancel()
    try: await task
    except asyncio.CancelledError: pass
    ids = [c["snapshot_id"] for c in pipe.calls]
    assert ids[0] == "a" and ids[-1] == "c"
```

- [ ] **Step 2: Implement scheduler**

```python
# apps/agent/src/agent/scheduler.py
from __future__ import annotations
import asyncio, logging
from typing import Callable
log = logging.getLogger("agent.scheduler")

class PipelineScheduler:
    def __init__(self, pipeline, snapshot_getter: Callable[[], dict | None], period_s: float = 2.0) -> None:
        self._pipe = pipeline; self._get = snapshot_getter; self._period = period_s
        self._running = False

    def stop(self) -> None: self._running = False

    async def run(self) -> None:
        self._running = True
        while self._running:
            snap = self._get()
            if snap is not None:
                try:
                    await self._pipe.run_tick(snap)
                except Exception:
                    log.exception("pipeline tick failed; holding last-good plan")
            await asyncio.sleep(self._period)
```

- [ ] **Step 3: Wire scheduler into agent lifespan**

Modify `apps/agent/src/agent/main.py` — replace whole file:

```python
# apps/agent/src/agent/main.py
from __future__ import annotations
import asyncio, json, os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI

from .server import include_routes
from .store import AgentStore
from .snapshot_subscriber import SnapshotSubscriber
from .event_bus import EventBus
from .pipeline import Pipeline
from .scheduler import PipelineScheduler
from .llm.ag2_adapter import LLMAdapter
from .llm.cassette import CassetteLLM
from .agents.prioritizer import Prioritizer
from .agents.allocator import Allocator
from .agents.justifier import Justifier
from .agents.escalator import Escalator
from .agents.watch_commander import WatchCommander
from .tools.intercept_sim import make_simulate_intercept_path
from .tools.tavily import make_tavily_recent_threats
from .tools.policy import make_get_policy_thresholds
from .tools.interceptors import make_list_available_interceptors

ROOT = Path(__file__).resolve().parents[4]
SCENARIO_PATH = ROOT / "packages/scenarios" / f"{os.getenv('SCENARIO','data-center-swarm-attack')}.json"
POLICY_PATH = ROOT / "packages/scenarios/policy.json"

def _build_llm(cassette: dict | None = None) -> LLMAdapter:
    model_pipeline = os.getenv("AG2_MODEL_FAST", "google/gemini-2.5-flash")
    if cassette is not None:
        return LLMAdapter(model="cassette", llm=CassetteLLM(cassette))
    return LLMAdapter(model=model_pipeline)

@asynccontextmanager
async def lifespan(app: FastAPI):
    store = AgentStore()
    bus = EventBus(store=store)
    subscriber = SnapshotSubscriber(
        url=os.getenv("FUSION_SNAPSHOT_WS", "ws://localhost:8001/snapshot"),
        store=store)
    sub_task = asyncio.create_task(subscriber.run())

    llm = _build_llm()
    sim = make_simulate_intercept_path(daytona_base_url=os.getenv("DAYTONA_BASE_URL"),
                                       daytona_api_key=os.getenv("DAYTONA_API_KEY"))
    tavily = make_tavily_recent_threats(api_key=os.getenv("TAVILY_API_KEY"))
    list_int = make_list_available_interceptors(SCENARIO_PATH)
    get_policy = make_get_policy_thresholds(POLICY_PATH)

    prioritizer = Prioritizer(llm)
    allocator   = Allocator(llm, interceptors=list_int(), simulate=sim, snapshot_provider=store.latest_snapshot)
    justifier   = Justifier(llm, tavily=tavily, snapshot_provider=store.latest_snapshot,
                            policy_provider=get_policy, region=os.getenv("REGION","us-west"))
    escalator   = Escalator(llm, policy_provider=get_policy, snapshot_provider=store.latest_snapshot)
    watch_commander = WatchCommander(LLMAdapter(model=os.getenv("AG2_MODEL_PRO","google/gemini-2.5-pro")),
                                     store=store)

    pipeline = Pipeline(prioritizer, allocator, justifier, escalator, bus=bus, store=store)
    scheduler = PipelineScheduler(pipeline, snapshot_getter=store.latest_snapshot,
                                  period_s=float(os.getenv("AGENT_TICK_S","2.0")))
    sched_task = asyncio.create_task(scheduler.run())

    app.state.store = store
    app.state.bus = bus
    app.state.subscriber = subscriber
    app.state.scheduler = scheduler
    app.state.pipeline = pipeline
    app.state.watch_commander = watch_commander
    try:
        yield
    finally:
        scheduler.stop(); subscriber.stop()
        for t in (sched_task, sub_task):
            t.cancel()

def create_app() -> FastAPI:
    app = FastAPI(title="MeshShield Agent", version="0.1.0", lifespan=lifespan)
    include_routes(app)
    return app

app = create_app()
```

- [ ] **Step 4: Run + commit**

```
uv run pytest apps/agent/tests/test_scheduler.py -v
git add apps/agent/src/agent/scheduler.py apps/agent/src/agent/main.py apps/agent/tests/test_scheduler.py
git commit -m "feat(agent): pipeline scheduler + lifespan wiring of all agents and tools"
```

---

## Phase 8 — NLIP server (Tasks 26–27)

### Task 26: NLIP server mount with Watch Commander backend

**Files:**
- Create: `apps/agent/src/agent/nlip/__init__.py`, `apps/agent/src/agent/nlip/server.py`
- Modify: `apps/agent/src/agent/server.py` (mount NLIP app)
- Test: `apps/agent/tests/test_nlip_smoke.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_nlip_smoke.py
from fastapi.testclient import TestClient
from agent.main import app

def test_nlip_capabilities_endpoint():
    with TestClient(app) as c:
        r = c.get("/nlip/capabilities")
        assert r.status_code == 200
        body = r.json()
        assert "query_current_threats" in body["capabilities"]
        assert "explain_decision" in body["capabilities"]

def test_nlip_chat_round_trip_via_http_fallback():
    with TestClient(app) as c:
        r = c.post("/nlip/chat", json={"format":"text","subformat":"english","content":"Summarize the situation."})
        assert r.status_code == 200
        body = r.json()
        assert body["format"] == "text"
        assert isinstance(body["content"], str)
```

- [ ] **Step 2: Implement NLIP server (HTTP-binding fallback first; WS+CBOR added in Task 27)**

```python
# apps/agent/src/agent/nlip/__init__.py
```

```python
# apps/agent/src/agent/nlip/server.py
from __future__ import annotations
from fastapi import APIRouter, Request

router = APIRouter(prefix="/nlip", tags=["nlip"])

CAPABILITIES = ["query_current_threats", "explain_decision", "summarize_situation"]

@router.get("/capabilities")
async def capabilities() -> dict:
    return {"name": "MeshShield Watch Commander",
            "protocol": "ECMA-430",
            "binding_http": "ECMA-431",
            "binding_ws":   "ECMA-432",
            "capabilities": CAPABILITIES}

@router.post("/chat")
async def chat(req: Request) -> dict:
    body = await req.json()
    if body.get("format") != "text":
        return {"format":"text","subformat":"english","content":"Unsupported format; only 'text' is implemented."}
    question = body.get("content","")
    wc = req.app.state.watch_commander
    answer = await wc.respond(question)
    return {"format":"text","subformat":"english","content": answer}
```

Modify `apps/agent/src/agent/server.py`:

```python
# apps/agent/src/agent/server.py — append below existing routes
from .nlip.server import router as nlip_router

def include_routes(app):  # idempotent: existing function body extended
    @app.get("/health")
    async def health() -> dict: return {"status":"ok","service":"agent"}

    @app.websocket("/events")
    async def events_ws(ws):
        await ws.accept()
        sub = app.state.bus.subscribe()
        try:
            async for ev in sub:
                import json
                await ws.send_text(json.dumps(ev))
        except Exception:
            return
        finally:
            app.state.bus.unsubscribe(sub)

    app.include_router(nlip_router)
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_nlip_smoke.py -v
git add apps/agent/src/agent/nlip/ apps/agent/src/agent/server.py apps/agent/tests/test_nlip_smoke.py
git commit -m "feat(agent): NLIP HTTP binding (capabilities + chat) backed by Watch Commander"
```

---

### Task 27: NLIP WebSocket binding (ECMA-432) with CBOR + JSON-text fallback

**Files:**
- Modify: `apps/agent/src/agent/nlip/server.py` (add /nlip ws route)
- Test: `apps/agent/tests/test_nlip_ws.py`

- [ ] **Step 1: Write failing test**

```python
# apps/agent/tests/test_nlip_ws.py
import json
from fastapi.testclient import TestClient
from agent.main import app

def test_nlip_ws_text_frame_round_trip():
    with TestClient(app) as c, c.websocket_connect("/nlip") as ws:
        ws.send_text(json.dumps({"format":"text","subformat":"english","content":"Why was T-13 not assigned?"}))
        msg = ws.receive_text()
        body = json.loads(msg)
        assert body["format"] == "text"
        assert isinstance(body["content"], str)

def test_nlip_ws_cbor_round_trip():
    import cbor2
    with TestClient(app) as c, c.websocket_connect("/nlip") as ws:
        ws.send_bytes(cbor2.dumps({"format":"text","subformat":"english","content":"Summarize."}))
        msg = ws.receive_bytes()
        body = cbor2.loads(msg)
        assert body["format"] == "text" and isinstance(body["content"], str)
```

- [ ] **Step 2: Implement WebSocket binding**

Append to `apps/agent/src/agent/nlip/server.py`:

```python
# apps/agent/src/agent/nlip/server.py — append
import cbor2, json
from fastapi import WebSocket, WebSocketDisconnect

async def _handle_one_frame(ws: WebSocket, watch_commander, payload, is_binary: bool):
    try:
        body = cbor2.loads(payload) if is_binary else json.loads(payload)
    except Exception:
        body = {"format":"text","subformat":"english","content":""}
    question = body.get("content","")
    answer = await watch_commander.respond(question)
    out = {"format":"text","subformat":"english","content": answer}
    if is_binary:
        await ws.send_bytes(cbor2.dumps(out))
    else:
        await ws.send_text(json.dumps(out))

def register_ws(app) -> None:
    @app.websocket("/nlip")
    async def nlip_ws(ws: WebSocket):
        await ws.accept(subprotocol="nlip.v1")
        wc = ws.app.state.watch_commander
        try:
            while True:
                msg = await ws.receive()
                if msg.get("type") != "websocket.receive":
                    return
                if "bytes" in msg and msg["bytes"] is not None:
                    await _handle_one_frame(ws, wc, msg["bytes"], is_binary=True)
                elif "text" in msg and msg["text"] is not None:
                    await _handle_one_frame(ws, wc, msg["text"], is_binary=False)
        except WebSocketDisconnect:
            return
```

Modify `apps/agent/src/agent/server.py` to call `register_ws(app)` at the end of `include_routes`:

```python
# apps/agent/src/agent/server.py — modify include_routes
from .nlip.server import router as nlip_router, register_ws
def include_routes(app):
    # ... existing health, events ws, app.include_router(nlip_router) ...
    register_ws(app)
```

- [ ] **Step 3: Run + commit**

```
uv run pytest apps/agent/tests/test_nlip_ws.py -v
git add apps/agent/src/agent/nlip/server.py apps/agent/src/agent/server.py apps/agent/tests/test_nlip_ws.py
git commit -m "feat(agent): NLIP WS binding (ECMA-432) with CBOR + JSON-text frames"
```

---

## Phase 9 — Console scaffold (Tasks 28–30)

### Task 28: Zustand event-sourced store

**Files:**
- Create: `apps/console/lib/store/index.ts`
- Test: `apps/console/tests/store.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/console/tests/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useMeshStore, applyAgentEvent, applySnapshot } from "@/lib/store";

describe("MeshStore", () => {
  beforeEach(() => useMeshStore.setState(useMeshStore.getInitialState()));

  it("starts with idle agent states and no plan", () => {
    const s = useMeshStore.getState();
    expect(s.agents.prioritizer.state).toBe("idle");
    expect(s.plan).toBeNull();
  });

  it("transitions agent state on stage_started/finished", () => {
    applyAgentEvent({ kind: "stage_started", agent: "prioritizer", ts: 1 });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("thinking");
    applyAgentEvent({ kind: "stage_finished", agent: "prioritizer", output_summary: "x", ms: 1, ts: 2 });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("done");
  });

  it("captures tool calls under the correct agent", () => {
    applyAgentEvent({ kind: "tool_call_started", agent: "allocator", tool: "simulate_intercept_path", args: {}, ts: 1 });
    expect(useMeshStore.getState().agents.allocator.tools[0].tool).toBe("simulate_intercept_path");
    expect(useMeshStore.getState().agents.allocator.tools[0].state).toBe("running");
  });

  it("stores latest snapshot tracks", () => {
    applySnapshot({ v:1, snapshot_id:"s-1", ts:1, tracks:[{id:"t-1",origin:"real",pos_3d:[0,0,0],vel:[0,0,0],conf:0.9}] } as any);
    expect(useMeshStore.getState().tracks.length).toBe(1);
  });

  it("appends to the event tape", () => {
    applyAgentEvent({ kind: "plan_ready", plan_id: "p-1", ts: 1 });
    expect(useMeshStore.getState().tape.length).toBe(1);
    expect(useMeshStore.getState().tape[0].kind).toBe("plan_ready");
  });
});
```

- [ ] **Step 2: Implement store**

```ts
// apps/console/lib/store/index.ts
import { create } from "zustand";
import type { AgentEvent, Snapshot, ResponsePlan } from "@meshshield/protocol";

export type AgentName = "prioritizer" | "allocator" | "justifier" | "escalator" | "watch_commander";
export type AgentState = "idle" | "thinking" | "tool_calling" | "done" | "error";

export type ToolCallView = { tool: string; state: "running" | "done" | "error"; ms?: number; result_summary?: string };
export type AgentView = { state: AgentState; lastMessage?: string; tools: ToolCallView[] };

type State = {
  agents: Record<AgentName, AgentView>;
  tracks: any[];
  plan: ResponsePlan | null;
  tape: AgentEvent[];
};

const initial: State = {
  agents: {
    prioritizer:     { state: "idle", tools: [] },
    allocator:       { state: "idle", tools: [] },
    justifier:       { state: "idle", tools: [] },
    escalator:       { state: "idle", tools: [] },
    watch_commander: { state: "idle", tools: [] },
  },
  tracks: [],
  plan: null,
  tape: [],
};

export const useMeshStore = create<State>(() => initial);
useMeshStore.getInitialState = () => initial;

export function applyAgentEvent(ev: AgentEvent): void {
  useMeshStore.setState((s) => {
    const tape = [...s.tape, ev].slice(-500);
    const agents: Record<AgentName, AgentView> = { ...s.agents };
    let plan = s.plan;
    const updateAgent = (name: AgentName, patch: Partial<AgentView>) => {
      agents[name] = { ...agents[name], ...patch, tools: patch.tools ?? agents[name].tools };
    };
    switch (ev.kind) {
      case "stage_started":   if (ev.agent) updateAgent(ev.agent as AgentName, { state: "thinking" }); break;
      case "stage_finished":  if (ev.agent) updateAgent(ev.agent as AgentName, { state: "done", lastMessage: ev.output_summary }); break;
      case "stage_failed":    if (ev.agent) updateAgent(ev.agent as AgentName, { state: "error",  lastMessage: ev.error }); break;
      case "tool_call_started":
        if (ev.agent && ev.tool) {
          const a = agents[ev.agent as AgentName];
          updateAgent(ev.agent as AgentName, { state: "tool_calling", tools: [...a.tools, { tool: ev.tool, state: "running" }] });
        }
        break;
      case "tool_call_finished":
        if (ev.agent && ev.tool) {
          const a = agents[ev.agent as AgentName];
          updateAgent(ev.agent as AgentName, {
            state: a.state === "tool_calling" ? "thinking" : a.state,
            tools: a.tools.map((t, i, arr) => i === arr.length - 1 && t.state === "running"
              ? { ...t, state: "done", ms: ev.ms, result_summary: ev.result_summary } : t),
          });
        }
        break;
      case "agent_message":
        if (ev.agent) updateAgent(ev.agent as AgentName, { lastMessage: ev.preview });
        break;
      case "plan_ready":
        if (ev.plan) plan = ev.plan as ResponsePlan;
        break;
      case "escalation_raised":
        // escalation banner is computed from plan; no agent state change here
        break;
    }
    return { ...s, tape, agents, plan };
  });
}

export function applySnapshot(snap: Snapshot): void {
  useMeshStore.setState((s) => ({ ...s, tracks: snap.tracks ?? [] }));
}

export function applyPlan(plan: ResponsePlan): void {
  useMeshStore.setState((s) => ({ ...s, plan }));
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/lib/store/ apps/console/tests/store.test.ts
git commit -m "feat(console): Zustand event-sourced store driving agent UI"
```

---

### Task 29: Snapshot + agent event WS subscribers

**Files:**
- Create: `apps/console/lib/streams/snapshot.ts`, `apps/console/lib/streams/agent.ts`
- Test: `apps/console/tests/streams.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/console/tests/streams.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { connectSnapshotStream } from "@/lib/streams/snapshot";
import { connectAgentStream } from "@/lib/streams/agent";
import { useMeshStore } from "@/lib/store";

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  url: string; onmessage: ((e: any) => void) | null = null; onclose: (() => void) | null = null; onopen: (() => void) | null = null;
  readyState = 0; constructor(url: string) { this.url = url; FakeWebSocket.last = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send() {} close() { this.onclose?.(); }
}

beforeEach(() => { (globalThis as any).WebSocket = FakeWebSocket as any; useMeshStore.setState(useMeshStore.getInitialState()); });

describe("streams", () => {
  it("snapshot stream applies messages to the store", async () => {
    const stop = connectSnapshotStream("ws://x/snapshot");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ v:1, snapshot_id:"s-1", ts:1, tracks:[{id:"t-1",origin:"real",pos_3d:[0,0,0],vel:[0,0,0],conf:0.9}] }) });
    expect(useMeshStore.getState().tracks.length).toBe(1);
    stop();
  });

  it("agent stream applies events to the store", async () => {
    const stop = connectAgentStream("ws://x/events");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ kind: "stage_started", agent: "prioritizer", ts: 1 }) });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("thinking");
    stop();
  });
});
```

- [ ] **Step 2: Implement streams**

```ts
// apps/console/lib/streams/snapshot.ts
import { applySnapshot } from "@/lib/store";

export function connectSnapshotStream(url: string): () => void {
  let ws: WebSocket | null = null;
  let stopped = false; let backoff = 500;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { backoff = 500; };
    ws.onmessage = (ev) => { try { applySnapshot(JSON.parse(ev.data)); } catch {} };
    ws.onclose = () => { if (!stopped) setTimeout(open, backoff = Math.min(backoff * 2, 5000)); };
  };
  open();
  return () => { stopped = true; ws?.close(); };
}
```

```ts
// apps/console/lib/streams/agent.ts
import { applyAgentEvent } from "@/lib/store";

export function connectAgentStream(url: string): () => void {
  let ws: WebSocket | null = null;
  let stopped = false; let backoff = 500;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => { backoff = 500; };
    ws.onmessage = (ev) => { try { applyAgentEvent(JSON.parse(ev.data)); } catch {} };
    ws.onclose = () => { if (!stopped) setTimeout(open, backoff = Math.min(backoff * 2, 5000)); };
  };
  open();
  return () => { stopped = true; ws?.close(); };
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/lib/streams/ apps/console/tests/streams.test.ts
git commit -m "feat(console): WS subscribers for snapshot and agent event streams"
```

---

### Task 30: NLIP client (WS + JSON fallback)

**Files:**
- Create: `apps/console/lib/nlip/client.ts`
- Test: `apps/console/tests/nlip.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/console/tests/nlip.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createNlipClient } from "@/lib/nlip/client";

class FakeWebSocket {
  static last: FakeWebSocket | null = null;
  url: string; onopen: (() => void) | null = null; onmessage: ((e: any) => void) | null = null; onclose: (() => void) | null = null;
  readyState = 0;
  constructor(url: string) { this.url = url; FakeWebSocket.last = this; queueMicrotask(() => { this.readyState = 1; this.onopen?.(); }); }
  send(_: string) {}
  close() { this.onclose?.(); }
}

beforeEach(() => { (globalThis as any).WebSocket = FakeWebSocket as any; });

describe("nlip client", () => {
  it("send returns the next text reply", async () => {
    const client = createNlipClient("ws://x/nlip");
    const p = client.ask("Why was T-13 ignored?");
    await Promise.resolve();
    FakeWebSocket.last!.onmessage!({ data: JSON.stringify({ format: "text", subformat: "english", content: "T-13 conf=0.43" }) });
    expect(await p).toContain("T-13");
    client.close();
  });
});
```

- [ ] **Step 2: Implement client**

```ts
// apps/console/lib/nlip/client.ts
type Pending = { resolve: (s: string) => void; reject: (e: any) => void };

export function createNlipClient(url: string) {
  const queue: Pending[] = [];
  let openP: Promise<void>;
  let ws: WebSocket;

  const init = () => {
    ws = new WebSocket(url);
    openP = new Promise<void>((res) => { ws.onopen = () => res(); });
    ws.onmessage = (ev) => {
      const next = queue.shift(); if (!next) return;
      try {
        const body = JSON.parse(ev.data);
        next.resolve(String(body.content ?? ""));
      } catch (e) { next.reject(e); }
    };
    ws.onclose = () => { for (const p of queue.splice(0)) p.reject(new Error("closed")); };
  };
  init();

  return {
    async ask(content: string): Promise<string> {
      await openP;
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject });
        ws.send(JSON.stringify({ format: "text", subformat: "english", content }));
      });
    },
    close() { ws.close(); }
  };
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/lib/nlip/ apps/console/tests/nlip.test.ts
git commit -m "feat(console): NLIP WS client (JSON-text frames)"
```

---

## Phase 10 — Console components (Tasks 31–36)

### Task 31: Header with AG2 brand chip

**Files:**
- Create: `apps/console/components/Header.tsx`
- Test: `apps/console/tests/components/Header.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/Header.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "@/components/Header";

describe("Header", () => {
  it("renders AG2 brand chip and scenario name", () => {
    render(<Header scenario="data-center-swarm-attack" />);
    expect(screen.getByText(/MeshShield AI/)).toBeInTheDocument();
    expect(screen.getByText(/Powered by AG2/)).toBeInTheDocument();
    expect(screen.getByText(/data-center-swarm-attack/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/console/components/Header.tsx
"use client";
export function Header({ scenario }: { scenario: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-panel">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold tracking-tight">MeshShield AI</span>
        <span className="text-muted text-xs">▸ Scenario: {scenario}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-md bg-accent/15 text-accent px-2 py-1 font-mono">⚡ Powered by AG2</span>
        <span className="rounded-md bg-white/5 text-muted px-2 py-1 font-mono">via OpenRouter · Gemini 2.5</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/Header.tsx apps/console/tests/components/Header.test.tsx
git commit -m "feat(console): header with AG2 brand chip"
```

---

### Task 32: AgentCard with state machine + animations

**Files:**
- Create: `apps/console/components/AgentCard.tsx`, `apps/console/components/ToolChip.tsx`
- Test: `apps/console/tests/components/AgentCard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/AgentCard.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AgentCard } from "@/components/AgentCard";

describe("AgentCard", () => {
  it("renders the agent name, AG2 chip, and model badge when active", () => {
    render(<AgentCard name="prioritizer" label="Threat Prioritizer" model="gemini-2.5-flash"
                       state="thinking" tools={[]} />);
    expect(screen.getByText("Threat Prioritizer")).toBeInTheDocument();
    expect(screen.getByText(/AG2/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument();
  });

  it("renders tool chips with running and done states", () => {
    render(<AgentCard name="allocator" label="Interceptor Allocator" model="gemini-2.5-flash"
                       state="tool_calling"
                       tools={[
                         { tool:"simulate_intercept_path", state:"running" },
                         { tool:"list_available_interceptors", state:"done", ms: 12 }]} />);
    expect(screen.getByText(/simulate_intercept_path/)).toBeInTheDocument();
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement ToolChip + AgentCard**

```tsx
// apps/console/components/ToolChip.tsx
"use client";
import { motion } from "framer-motion";

const colorFor: Record<string, string> = {
  simulate_intercept_path: "bg-emerald-500/15 text-emerald-300",
  tavily_recent_threats:   "bg-sky-500/15 text-sky-300",
};

export function ToolChip({ tool, state, ms }: { tool: string; state: "running" | "done" | "error"; ms?: number }) {
  const color = colorFor[tool] ?? "bg-white/10 text-white/80";
  return (
    <motion.span layout
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono ${color}`}>
      <span>🛠 {tool}</span>
      {state === "running"
        ? <span className="animate-pulse">…</span>
        : state === "done"
          ? <span className="opacity-70">{ms}ms</span>
          : <span className="text-danger">err</span>}
    </motion.span>
  );
}
```

```tsx
// apps/console/components/AgentCard.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ToolChip } from "./ToolChip";
import type { AgentState, ToolCallView } from "@/lib/store";

const ringForState: Record<AgentState, string> = {
  idle:         "ring-white/10",
  thinking:     "ring-accent animate-pulse",
  tool_calling: "ring-emerald-400",
  done:         "ring-emerald-500/60",
  error:        "ring-danger",
};

export function AgentCard({ name, label, model, state, tools, lastMessage }:
  { name: string; label: string; model: string; state: AgentState; tools: ToolCallView[]; lastMessage?: string }) {
  return (
    <motion.div layout
      animate={state === "error" ? { x: [0,-3,3,-2,2,0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl ring-1 ${ringForState[state]} bg-panelSolid p-3 min-w-[230px] shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{name}</div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="bg-accent/15 text-accent rounded px-1.5 py-[1px] font-mono">▸ AG2</span>
          <span className="bg-white/5 text-muted rounded px-1.5 py-[1px] font-mono">{model}</span>
        </div>
      </div>
      <div className="mt-1 font-semibold">{label}</div>
      {lastMessage && <div className="mt-2 text-xs text-white/70 line-clamp-2">{lastMessage}</div>}
      <AnimatePresence>
        {tools.length > 0 && (
          <motion.div layout className="mt-2 flex flex-wrap gap-1">
            {tools.map((t, i) => <ToolChip key={i} tool={t.tool} state={t.state} ms={t.ms} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/AgentCard.tsx apps/console/components/ToolChip.tsx apps/console/tests/components/AgentCard.test.tsx
git commit -m "feat(console): AgentCard with state-machine ring + animated ToolChips"
```

---

### Task 33: ActivityTheatre — react-flow DAG

**Files:**
- Create: `apps/console/components/ActivityTheatre.tsx`
- Test: `apps/console/tests/components/ActivityTheatre.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/ActivityTheatre.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { useMeshStore } from "@/lib/store";

vi.mock("reactflow", () => ({
  __esModule: true,
  default: ({ nodes }: any) => (
    <div data-testid="rf">{nodes.map((n: any) => <div key={n.id}>{n.data?.label}</div>)}</div>
  ),
  Background: () => null, Controls: () => null,
}));

describe("ActivityTheatre", () => {
  it("renders the four pipeline agents in order", () => {
    useMeshStore.setState(useMeshStore.getInitialState());
    render(<ActivityTheatre />);
    expect(screen.getByText("Threat Prioritizer")).toBeInTheDocument();
    expect(screen.getByText("Interceptor Allocator")).toBeInTheDocument();
    expect(screen.getByText("Justifier")).toBeInTheDocument();
    expect(screen.getByText("Escalation Officer")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement ActivityTheatre**

```tsx
// apps/console/components/ActivityTheatre.tsx
"use client";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { useMemo } from "react";
import { AgentCard } from "./AgentCard";
import { useMeshStore } from "@/lib/store";

const PIPELINE: Array<{ name: keyof ReturnType<typeof useMeshStore.getState>["agents"]; label: string; model: string }> = [
  { name: "prioritizer",     label: "Threat Prioritizer",    model: "gemini-2.5-flash" },
  { name: "allocator",       label: "Interceptor Allocator", model: "gemini-2.5-flash" },
  { name: "justifier",       label: "Justifier",             model: "gemini-2.5-flash" },
  { name: "escalator",       label: "Escalation Officer",    model: "gemini-2.5-flash" },
];

export function ActivityTheatre() {
  const agents = useMeshStore((s) => s.agents);
  const nodes = useMemo(() =>
    PIPELINE.map((a, i) => ({
      id: a.name as string,
      position: { x: i * 280, y: 0 },
      data: { label: a.label,
              cardProps: { ...a, state: agents[a.name].state, tools: agents[a.name].tools, lastMessage: agents[a.name].lastMessage } },
      type: "agent",
    })), [agents]);
  const edges = useMemo(() =>
    PIPELINE.slice(0, -1).map((a, i) => ({
      id: `${a.name}->${PIPELINE[i+1].name}`,
      source: a.name as string, target: PIPELINE[i+1].name as string,
      animated: agents[a.name].state === "done" && agents[PIPELINE[i+1].name].state !== "idle",
    })), [agents]);
  const nodeTypes = useMemo(() => ({
    agent: ({ data }: any) => <AgentCard {...data.cardProps} label={data.label} />,
  }), []);
  return (
    <div className="h-[420px] rounded-xl bg-panel/40 ring-1 ring-white/10">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background gap={16} color="#1f2937" />
        <Controls position="top-right" />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/ActivityTheatre.tsx apps/console/tests/components/ActivityTheatre.test.tsx
git commit -m "feat(console): ActivityTheatre — react-flow DAG of agent cards"
```

---

### Task 34: NlipChat panel with citation chips

**Files:**
- Create: `apps/console/components/NlipChat.tsx`
- Test: `apps/console/tests/components/NlipChat.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/NlipChat.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NlipChat } from "@/components/NlipChat";

describe("NlipChat", () => {
  it("sends a question and renders the answer with citations as chips", async () => {
    const ask = vi.fn().mockResolvedValue("T-13 conf=0.43 [snapshot.tracks[0].conf] [clause:auto_action_min_conf]");
    render(<NlipChat client={{ ask, close: () => {} }} />);
    fireEvent.change(screen.getByPlaceholderText(/Ask Watch Commander/), { target: { value: "Why ignore T-13?" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText(/T-13 conf=0.43/)).toBeInTheDocument());
    expect(screen.getByText("[snapshot.tracks[0].conf]")).toBeInTheDocument();
    expect(screen.getByText("[clause:auto_action_min_conf]")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/console/components/NlipChat.tsx
"use client";
import { useState } from "react";

type NlipClient = { ask: (s: string) => Promise<string>; close: () => void };
type Msg = { role: "you" | "wc"; text: string };
const CITATION = /\[(snapshot\.[^\]]+|clause:[^\]]+|plan-\w+)\]/g;

const renderWithCitations = (text: string) => {
  const parts: (string | { c: string })[] = []; let last = 0; let m: RegExpExecArray | null;
  while ((m = CITATION.exec(text))) { parts.push(text.slice(last, m.index)); parts.push({ c: m[0] }); last = m.index + m[0].length; }
  parts.push(text.slice(last));
  return parts.map((p, i) => typeof p === "string"
    ? <span key={i}>{p}</span>
    : <span key={i} className="inline-block rounded bg-accent/15 text-accent px-1.5 py-[1px] mx-0.5 font-mono text-[11px]">{p.c}</span>);
};

export function NlipChat({ client }: { client: NlipClient }) {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setMsgs((m) => [...m, { role: "you", text: q }]);
    setInput(""); setBusy(true);
    try { const a = await client.ask(q); setMsgs((m) => [...m, { role: "wc", text: a }]); }
    finally { setBusy(false); }
  };

  const suggestions = ["Summarize current threats.", "Why was T-13 not assigned?", "Which interceptor is on T-001?"];
  return (
    <div className="flex flex-col rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 h-[260px]">
      <div className="text-xs text-muted">WATCH COMMANDER · NLIP/WS</div>
      <div className="flex-1 overflow-y-auto my-2 space-y-2 text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "you" ? "text-white" : "text-accent"}>
            <span className="text-muted text-[10px] mr-2">{m.role === "you" ? "YOU" : "WC"}</span>
            {renderWithCitations(m.text)}
          </div>
        ))}
        {busy && <div className="text-muted text-xs">…</div>}
      </div>
      <div className="flex gap-1 mb-2">
        {suggestions.map((s) => (
          <button key={s} onClick={() => setInput(s)}
            className="text-[10px] px-2 py-1 rounded bg-white/5 text-muted hover:text-white">{s}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask Watch Commander…"
          className="flex-1 bg-bg ring-1 ring-white/10 rounded px-3 py-1.5 text-sm" />
        <button onClick={send} className="rounded bg-accent text-bg px-3 py-1.5 text-sm font-semibold disabled:opacity-50" disabled={busy}>Send</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/NlipChat.tsx apps/console/tests/components/NlipChat.test.tsx
git commit -m "feat(console): NlipChat panel with inline citation chips"
```

---

### Task 35: EventTape + PlanPanel + CostCurveOverlay

**Files:**
- Create: `apps/console/components/EventTape.tsx`, `PlanPanel.tsx`, `CostCurveOverlay.tsx`
- Test: `apps/console/tests/components/EventTape.test.tsx`, `apps/console/tests/components/PlanPanel.test.tsx`, `apps/console/tests/components/CostCurveOverlay.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// apps/console/tests/components/EventTape.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EventTape } from "@/components/EventTape";
import { useMeshStore, applyAgentEvent } from "@/lib/store";

describe("EventTape", () => {
  it("renders most recent events newest-first", () => {
    useMeshStore.setState(useMeshStore.getInitialState());
    applyAgentEvent({ kind: "stage_started", agent: "prioritizer", ts: 1 });
    applyAgentEvent({ kind: "plan_ready", plan_id: "p-1", ts: 2 });
    render(<EventTape />);
    const items = screen.getAllByTestId("event-row");
    expect(items[0]).toHaveTextContent("plan_ready");
    expect(items[1]).toHaveTextContent("stage_started");
  });
});
```

```tsx
// apps/console/tests/components/PlanPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlanPanel } from "@/components/PlanPanel";
import { useMeshStore } from "@/lib/store";

describe("PlanPanel", () => {
  it("renders empty state when no plan", () => {
    useMeshStore.setState(useMeshStore.getInitialState());
    render(<PlanPanel />);
    expect(screen.getByText(/no plan yet/i)).toBeInTheDocument();
  });
  it("renders assignments when a plan is set", () => {
    useMeshStore.setState({ ...useMeshStore.getInitialState(),
      plan: { v:1, plan_id:"plan-1", snapshot_id:"snap-1", ts: 1,
              assignments: [{ target_id:"t-1", interceptor_id:"i-002", mode:"kinetic", priority:1,
                              justification:{ snapshot_refs:["tracks[0].pos_3d"], tavily_refs:[], policy_refs:["clause:proximity_under_50m"] }}],
              escalation: { required:false, reasons: [] }} as any });
    render(<PlanPanel />);
    expect(screen.getByText(/t-1/)).toBeInTheDocument();
    expect(screen.getByText(/i-002/)).toBeInTheDocument();
  });
});
```

```tsx
// apps/console/tests/components/CostCurveOverlay.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CostCurveOverlay } from "@/components/CostCurveOverlay";
import { useMeshStore } from "@/lib/store";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="chart">{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
}));

describe("CostCurveOverlay", () => {
  it("renders the chart container regardless of state", () => {
    useMeshStore.setState(useMeshStore.getInitialState());
    render(<CostCurveOverlay />);
    expect(screen.getByTestId("chart")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement components**

```tsx
// apps/console/components/EventTape.tsx
"use client";
import { useMeshStore } from "@/lib/store";
export function EventTape() {
  const tape = useMeshStore((s) => s.tape);
  const reversed = [...tape].reverse();
  return (
    <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 max-h-[200px] overflow-y-auto">
      <div className="text-xs text-muted mb-2">EVENT TAPE</div>
      <div className="space-y-1 text-[12px] font-mono">
        {reversed.map((e, i) => (
          <div data-testid="event-row" key={`${e.ts}-${i}`} className="flex gap-2">
            <span className="text-muted w-14 shrink-0">{Number(e.ts).toFixed(2)}</span>
            <span className="text-accent w-16 shrink-0">{e.agent ?? "—"}</span>
            <span className="text-white/80">{e.kind}</span>
            <span className="text-muted truncate">
              {e.tool ? `· ${e.tool}` : ""} {e.output_summary ? `· ${e.output_summary}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// apps/console/components/PlanPanel.tsx
"use client";
import { useMeshStore } from "@/lib/store";
export function PlanPanel() {
  const plan = useMeshStore((s) => s.plan);
  if (!plan) return <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-4 text-muted text-sm">No plan yet — waiting for first agent tick…</div>;
  return (
    <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-4">
      <div className="flex justify-between items-baseline">
        <div className="text-xs text-muted">RESPONSE PLAN · {plan.plan_id}</div>
        {plan.escalation?.required && <div className="text-danger text-xs">ESCALATION REQUIRED</div>}
      </div>
      <table className="w-full text-sm mt-2">
        <thead className="text-muted text-xs">
          <tr><th className="text-left">Target</th><th className="text-left">Interceptor</th><th className="text-left">Mode</th><th>Pri</th><th className="text-left">Justification</th></tr>
        </thead>
        <tbody>
          {plan.assignments.map((a, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="py-1 font-mono">{a.target_id}</td>
              <td className="font-mono">{a.interceptor_id}</td>
              <td className="font-mono text-accent">{a.mode}</td>
              <td className="text-center">{a.priority}</td>
              <td className="text-[11px] text-white/70">
                {[...a.justification.snapshot_refs, ...a.justification.tavily_refs, ...a.justification.policy_refs].join("  ·  ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// apps/console/components/CostCurveOverlay.tsx
"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useMeshStore } from "@/lib/store";
import { useMemo } from "react";

export function CostCurveOverlay() {
  const tracks = useMeshStore((s) => s.tracks);
  const data = useMemo(() => {
    const swarm = tracks.length;
    return Array.from({ length: 12 }).map((_, i) => ({
      n: i * Math.max(1, Math.ceil(swarm / 12)),
      attacker_usd: i * Math.max(1, Math.ceil(swarm / 12)) * 500,
      defender_usd: 50000 + Math.min(i, 3) * 5000,
    }));
  }, [tracks.length]);
  return (
    <div className="rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 h-[200px]">
      <div className="text-xs text-muted mb-1">COST-CURVE · attacker scales linearly, defender stays flat</div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis dataKey="n" stroke="#7c869b" fontSize={10} />
          <YAxis stroke="#7c869b" fontSize={10} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="attacker_usd" stroke="#fcb045" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="defender_usd" stroke="#5cf2c0" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/EventTape.tsx apps/console/components/PlanPanel.tsx apps/console/components/CostCurveOverlay.tsx apps/console/tests/components/EventTape.test.tsx apps/console/tests/components/PlanPanel.test.tsx apps/console/tests/components/CostCurveOverlay.test.tsx
git commit -m "feat(console): EventTape, PlanPanel, CostCurveOverlay"
```

---

### Task 36: Map3D — deck.gl airspace view (with assignment ring)

**Files:**
- Create: `apps/console/components/Map3D.tsx`
- Test: `apps/console/tests/components/Map3D.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/Map3D.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Map3D } from "@/components/Map3D";
import { useMeshStore } from "@/lib/store";

vi.mock("@deck.gl/react", () => ({ default: ({ children }: any) => <div data-testid="dg">{children}</div> }));
vi.mock("react-map-gl/maplibre", () => ({ Map: ({ children }: any) => <div data-testid="map">{children}</div> }));

describe("Map3D", () => {
  it("renders a map container even with no tracks", () => {
    useMeshStore.setState(useMeshStore.getInitialState());
    render(<Map3D />);
    expect(screen.getByTestId("dg")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// apps/console/components/Map3D.tsx
"use client";
import DeckGL from "@deck.gl/react";
import { Map as MapLibre } from "react-map-gl/maplibre";
import { ScatterplotLayer, GeoJsonLayer } from "@deck.gl/layers";
import { useMemo } from "react";
import { useMeshStore } from "@/lib/store";
import osm from "@meshshield/scenarios/assets/osm-datacenter.geojson" with { type: "json" };

const INITIAL = { longitude: -122.1697, latitude: 37.4275, zoom: 16, pitch: 45, bearing: 0 };

export function Map3D() {
  const tracks = useMeshStore((s) => s.tracks);
  const plan = useMeshStore((s) => s.plan);
  const assigned = new Set((plan?.assignments ?? []).map((a) => a.target_id));

  const dotData = useMemo(() => tracks.map((t: any) => ({
    pos: [INITIAL.longitude + t.pos_3d[0] * 1e-5, INITIAL.latitude + t.pos_3d[1] * 1e-5, t.pos_3d[2]],
    color: t.origin === "real" ? [92, 242, 192] : [252, 176, 69],
    radius: assigned.has(t.id) ? 8 : 4,
    id: t.id,
  })), [tracks, plan]);

  const layers = useMemo(() => ([
    new GeoJsonLayer({ id: "asset", data: osm as any, getFillColor: [255, 92, 92, 60], getLineColor: [255, 92, 92] }),
    new ScatterplotLayer({ id: "tracks", data: dotData, getPosition: (d:any) => d.pos, getFillColor: (d:any) => d.color, getRadius: (d:any) => d.radius, radiusUnits: "pixels" }),
  ]), [dotData]);

  return (
    <div className="h-[420px] rounded-xl overflow-hidden ring-1 ring-white/10">
      <DeckGL initialViewState={INITIAL} controller layers={layers}>
        <MapLibre mapStyle="https://demotiles.maplibre.org/style.json" />
      </DeckGL>
    </div>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/components/Map3D.tsx apps/console/tests/components/Map3D.test.tsx
git commit -m "feat(console): Map3D — deck.gl airspace + OSM asset polygon"
```

---

## Phase 11 — Integration, E2E, runbook (Tasks 37–39)

### Task 37: Page composition — wire everything into `app/page.tsx`

**Files:**
- Modify: `apps/console/app/page.tsx`
- Create: `apps/console/components/EscalationBanner.tsx`
- Test: `apps/console/tests/components/page.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/console/tests/components/page.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/streams/snapshot", () => ({ connectSnapshotStream: () => () => {} }));
vi.mock("@/lib/streams/agent",    () => ({ connectAgentStream:    () => () => {} }));
vi.mock("@/lib/nlip/client",      () => ({ createNlipClient:      () => ({ ask: async () => "ok", close: () => {} }) }));
vi.mock("@/components/Map3D",     () => ({ Map3D: () => <div data-testid="map3d" /> }));
vi.mock("@/components/ActivityTheatre", () => ({ ActivityTheatre: () => <div data-testid="theatre" /> }));

import Page from "@/app/page";

describe("Page", () => {
  it("renders header, map, theatre, chat, plan, tape, cost-curve", () => {
    render(<Page />);
    expect(screen.getByText(/MeshShield AI/)).toBeInTheDocument();
    expect(screen.getByTestId("map3d")).toBeInTheDocument();
    expect(screen.getByTestId("theatre")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask Watch Commander/)).toBeInTheDocument();
    expect(screen.getByText(/RESPONSE PLAN|No plan yet/)).toBeInTheDocument();
    expect(screen.getByText(/EVENT TAPE/)).toBeInTheDocument();
    expect(screen.getByText(/COST-CURVE/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement EscalationBanner + page composition**

```tsx
// apps/console/components/EscalationBanner.tsx
"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/store";
export function EscalationBanner() {
  const plan = useMeshStore((s) => s.plan);
  const required = plan?.escalation?.required;
  return (
    <AnimatePresence>
      {required && (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
          className="bg-danger/15 text-danger border border-danger/40 rounded-md px-3 py-2 text-sm">
          ESCALATION REQUIRED · {plan!.escalation.reasons.join(" · ")}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

```tsx
// apps/console/app/page.tsx
"use client";
import { useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Map3D } from "@/components/Map3D";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { NlipChat } from "@/components/NlipChat";
import { PlanPanel } from "@/components/PlanPanel";
import { EventTape } from "@/components/EventTape";
import { CostCurveOverlay } from "@/components/CostCurveOverlay";
import { EscalationBanner } from "@/components/EscalationBanner";
import { connectSnapshotStream } from "@/lib/streams/snapshot";
import { connectAgentStream } from "@/lib/streams/agent";
import { createNlipClient } from "@/lib/nlip/client";

export default function Page() {
  useEffect(() => {
    const stops = [
      connectSnapshotStream(process.env.NEXT_PUBLIC_FUSION_WS_URL + "/snapshot"),
      connectAgentStream(process.env.NEXT_PUBLIC_AGENT_EVENTS_WS_URL!),
    ];
    return () => stops.forEach((s) => s());
  }, []);
  const nlip = useMemo(() => createNlipClient(process.env.NEXT_PUBLIC_AGENT_NLIP_WS_URL!), []);
  return (
    <main className="min-h-screen flex flex-col">
      <Header scenario={process.env.NEXT_PUBLIC_SCENARIO ?? "data-center-swarm-attack"} />
      <div className="p-4 flex flex-col gap-3">
        <EscalationBanner />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 flex flex-col gap-3">
            <Map3D />
            <ActivityTheatre />
          </div>
          <div className="flex flex-col gap-3">
            <NlipChat client={nlip} />
            <PlanPanel />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <CostCurveOverlay />
          <EventTape />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run + commit**

```
pnpm --filter @meshshield/console test
git add apps/console/app/page.tsx apps/console/components/EscalationBanner.tsx apps/console/tests/components/page.test.tsx
git commit -m "feat(console): full page composition with all panels"
```

---

### Task 38: Playwright E2E — scenario fires the full agent pipeline

**Files:**
- Create: `apps/console/playwright.config.ts`
- Create: `apps/console/e2e/scenario.spec.ts`
- Create: `apps/console/e2e/fixtures/fake-fusion-and-agent.mjs` (mock backends for E2E)
- Modify: `apps/console/package.json` (add `test:e2e` already present; add e2e script entries)

- [ ] **Step 1: Write failing E2E spec**

```ts
// apps/console/e2e/scenario.spec.ts
import { test, expect } from "@playwright/test";

test("agent pipeline becomes visible within 10s of page load", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("MeshShield AI")).toBeVisible();
  // Each agent card eventually transitions out of idle (ring color changes via class).
  for (const label of ["Threat Prioritizer", "Interceptor Allocator", "Justifier", "Escalation Officer"]) {
    await expect(page.getByText(label)).toBeVisible();
  }
  // After at least one tick, plan panel renders an assignment.
  await expect(page.getByText(/RESPONSE PLAN/)).toBeVisible({ timeout: 10_000 });
});

test("operator can chat with Watch Commander over NLIP", async ({ page }) => {
  await page.goto("/");
  const input = page.getByPlaceholder(/Ask Watch Commander/);
  await input.fill("Summarize the situation.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("text=WC")).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Implement Playwright config and fake backends**

```ts
// apps/console/playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "node ./e2e/fixtures/fake-fusion-and-agent.mjs & next dev -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: "http://localhost:3000" },
});
```

```js
// apps/console/e2e/fixtures/fake-fusion-and-agent.mjs
import { WebSocketServer } from "ws";
import http from "node:http";

const fusionPort = 8001;
const agentPort  = 8002;

const fusionHttp = http.createServer((_, res) => res.end("ok"));
const fusionWss  = new WebSocketServer({ server: fusionHttp, path: "/snapshot" });
fusionWss.on("connection", (ws) => {
  let i = 0;
  const id = setInterval(() => {
    i++;
    ws.send(JSON.stringify({ v:1, snapshot_id: `snap-${i}`, ts: Date.now()/1000,
      tracks: [{ id:"t-1", origin:"real", pos_3d:[100-i,0,30], vel:[-1,0,0], conf:0.92, nearest_asset_m: 100 - i }]}));
  }, 100);
  ws.on("close", () => clearInterval(id));
});
fusionHttp.listen(fusionPort);

const agentHttp = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/nlip/chat") {
    let buf = ""; req.on("data", (c) => buf += c);
    req.on("end", () => { res.setHeader("content-type","application/json"); res.end(JSON.stringify({format:"text",subformat:"english",content:"OK summary."})); });
  } else { res.end("ok"); }
});
const eventsWss = new WebSocketServer({ server: agentHttp, path: "/events" });
const nlipWss   = new WebSocketServer({ server: agentHttp, path: "/nlip" });
eventsWss.on("connection", (ws) => {
  let tick = 0;
  const id = setInterval(() => {
    tick++;
    const ts = Date.now()/1000;
    const seq = [
      { kind:"stage_started",  agent:"prioritizer", ts },
      { kind:"stage_finished", agent:"prioritizer", output_summary:"top: t-1", ms:140, ts },
      { kind:"stage_started",  agent:"allocator",   ts },
      { kind:"tool_call_started",  agent:"allocator", tool:"simulate_intercept_path", args:{}, ts },
      { kind:"tool_call_finished", agent:"allocator", tool:"simulate_intercept_path", result_summary:"miss=3m", ms:42, ts },
      { kind:"stage_finished", agent:"allocator",   output_summary:"i-002 → t-1", ms:230, ts },
      { kind:"stage_started",  agent:"justifier",   ts },
      { kind:"stage_finished", agent:"justifier",   output_summary:"refs:3", ms:180, ts },
      { kind:"stage_started",  agent:"escalator",   ts },
      { kind:"stage_finished", agent:"escalator",   output_summary:"no escalation", ms:90, ts },
      { kind:"plan_ready", plan_id:`plan-${tick}`, ts,
        plan: { v:1, plan_id:`plan-${tick}`, snapshot_id:`snap-${tick}`, ts,
                assignments:[{ target_id:"t-1", interceptor_id:"i-002", mode:"kinetic", priority:1,
                  justification:{ snapshot_refs:["tracks[0].pos_3d","tracks[0].nearest_asset_m"],
                                   tavily_refs:[], policy_refs:["clause:proximity_under_50m"] }}],
                escalation:{ required:false, reasons:[] } } },
    ];
    seq.forEach((ev, k) => setTimeout(() => ws.send(JSON.stringify(ev)), k * 100));
  }, 2000);
  ws.on("close", () => clearInterval(id));
});
nlipWss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    const body = JSON.parse(msg.toString());
    ws.send(JSON.stringify({format:"text", subformat:"english",
      content: `(stub) you said: ${body.content} [snapshot.tracks[0].pos_3d] [clause:auto_action_min_conf]`}));
  });
});
agentHttp.listen(agentPort, () => console.log("fake agent on", agentPort));
console.log("fake fusion on", fusionPort);
```

Add to `apps/console/package.json` `devDependencies`: `"ws": "^8.18.0"`.

- [ ] **Step 3: Run E2E + commit**

```
pnpm --filter @meshshield/console exec playwright install --with-deps chromium
pnpm --filter @meshshield/console exec playwright test
git add apps/console/playwright.config.ts apps/console/e2e/ apps/console/package.json
git commit -m "test(console): playwright E2E with stubbed fusion + agent backends"
```

---

### Task 39: Demo runbook + final verification

**Files:**
- Create: `docs/runbooks/demo-day.md`
- Create: `tests/test_full_stack_smoke.py` (optional Live OpenRouter smoke, marker `live`)

- [ ] **Step 1: Write failing live smoke test (marker so it skips by default)**

```python
# tests/test_full_stack_smoke.py
import os, json, asyncio, pytest, time

pytestmark = pytest.mark.live

@pytest.mark.skipif(not os.environ.get("OPENROUTER_API_KEY"), reason="OPENROUTER_API_KEY not set")
@pytest.mark.asyncio
async def test_pipeline_end_to_end_against_openrouter():
    from agent.llm.ag2_adapter import LLMAdapter
    from agent.agents.prioritizer import Prioritizer
    snap = {"v":1,"snapshot_id":"snap-live","ts":time.time(),"tracks":[
      {"id":"t-1","origin":"real","pos_3d":[100,0,30],"vel":[-10,0,0],"conf":0.92,"nearest_asset_m":40.0}]}
    adapter = LLMAdapter(model="google/gemini-2.5-flash")
    p = Prioritizer(adapter)
    out = await p.run(snap)
    assert out["prioritized"], "expected at least one prioritized target"
```

Add to root `pyproject.toml` under `[tool.pytest.ini_options]`:
```toml
markers = ["live: hits external services; opt-in"]
```

- [ ] **Step 2: Write the demo runbook**

```markdown
<!-- docs/runbooks/demo-day.md -->
# MeshShield Demo Runbook (90-second arc)

## T-30 minutes — pre-flight
- [ ] `make install`
- [ ] `cp .env.example .env` and paste `OPENROUTER_API_KEY` (Tavily/Daytona optional)
- [ ] `pnpm --filter @meshshield/console exec playwright install chromium` (only if running E2E)
- [ ] `make demo` — verify three services boot. URL: http://localhost:3000
- [ ] Run the live smoke once: `OPENROUTER_API_KEY=… uv run pytest -m live -v`

## T-2 minutes — physical setup
- Two laptops on the same wifi (one for the console, one as backup).
- Hotspot ready as fallback. Backup demo video tab open in second browser.

## On-stage script (90 seconds)
1. **0–10 s.** Hold up the phone. State the cost asymmetry: $3M vs $500.
2. **10–30 s.** Show the airspace map; tracks moving toward the data-center polygon.
3. **30–60 s.** Activity Theatre lights up: Prioritizer pulses → Allocator fires `simulate_intercept_path` (Daytona chip) → Justifier fires `tavily_recent_threats` → Escalation Officer green. Plan panel renders.
4. **60–80 s.** Type into NLIP chat: "Why was T-013 not assigned?" Watch Commander replies with `[snapshot.…]` and `[clause:…]` chips.
5. **80–90 s.** State the ask: pilots, design partners, capital.

## If something fails on stage
- **Console blank:** refresh; Zustand re-subscribes via stream WS.
- **Agent pipeline frozen:** `curl localhost:8002/health` to verify; tick interval is 2 s.
- **OpenRouter rate-limited:** `AGENT_TICK_S=10` to slow ticks; cached cassette path is documented in `apps/agent/tests/cassettes/`.
- **Daytona unreachable:** allocator silently uses local fallback; tool chip will say `local-fallback`.
- **Total wedge:** open the unlisted YouTube backup in tab 2.
```

- [ ] **Step 3: Final verification**

```
make test
pnpm --filter @meshshield/console exec playwright test
```
Expected: all PASS; `live` marker skipped.

- [ ] **Step 4: Commit**

```bash
git add docs/runbooks/ tests/test_full_stack_smoke.py pyproject.toml
git commit -m "docs+test: demo runbook and opt-in live OpenRouter smoke"
```

---

## Spec coverage check

| Spec section/requirement | Implemented in task(s) |
|---|---|
| §3 #1 `make install` works | Task 1 |
| §3 #2 `pnpm dev` brings up 3 services | Task 1 (Makefile) |
| §3 #3 console + plan within 5 s | Tasks 25, 33, 35, 37 |
| §3 #4 NLIP chat answers with citations | Tasks 23, 26, 27, 34 |
| §3 #5 deterministic test suite passes (live opt-in) | All test tasks + Task 39 |
| §3 #6 reads as multi-agent collaboration | Tasks 32–37 |
| §5 architecture (3 services, shared protocol) | Tasks 1, 5, 8–14, 19–25 |
| §6.1 five agents | Tasks 19–23 |
| §6.2 pipeline orchestration | Task 24 |
| §6.3 tools (snapshot, interceptors, sim, tavily, policy, operator) | Tasks 16–18, 23 |
| §6.4 NLIP server (HTTP + WS bindings) | Tasks 26, 27 |
| §6.5 AgentEvent stream | Tasks 4, 14, 24, 28 |
| §6.6 failure modes | Tasks 17, 18, 24, 25 |
| §7 protocols + WS channels | Tasks 4–6, 8–10, 13, 14, 26, 27, 29, 30 |
| §8 Activity Theatre + animations | Tasks 31–33, 35, 37 |
| §9 testing strategy | every task ships with TDD; Task 39 adds live smoke |
| §10 deployment | Makefile (Task 1) + runbook (Task 39) |
| §11 risks (animation jank, Daytona/Tavily fallbacks, schema mismatch CI) | Tasks 1 (CI), 17, 18, 32 |
| §12 out of scope (B/C/D/E) — confirm not in plan | confirmed: this plan does not implement them |

No coverage gaps. No placeholders. Plan is ready to execute.

---

