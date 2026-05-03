# MeshShield — Sub-project A+F: Skeleton + AG2 Multi-Agent Command System

| | |
|---|---|
| **Author** | RS |
| **Date** | 2026-05-03 |
| **Status** | Draft — pending user review |
| **Parent PRD** | `MeshShield_PRD_and_36hr_Build_Plan.docx` (v1.0) |

---

## 1. Background

MeshShield is a software-defined counter-swarm defense platform (see parent PRD §1–6). The full system spans seven subsystems; this spec covers two of them, bundled as the first deliverable:

- **Sub-project A — Skeleton + sensor protocol.** The monorepo, shared message schemas, and the minimum services needed to run anything end-to-end.
- **Sub-project F — AG2 multi-agent command system + NLIP boundary.** The reasoning layer that ingests fused airspace state, produces structured response plans, and exposes a natural-language operator interface via the Ecma-430 NLIP standard.

The deliverable from this spec is a working demo-scale slice of MeshShield. "Demo-scale" here means: no real sensor hardware (sensors are sub-projects B/C), no real fusion (sub-project D), no live-spawn 1000-track UI (sub-project E). The fusion server replays a pre-baked scenario JSON; everything downstream of that is the real production-shape pipeline. Specifically:

1. A Next.js operator console connects to a fusion server and an agent service.
2. The fusion server publishes synthetic airspace snapshots (real sensors are out of scope here — they are sub-projects B and C).
3. A four-agent AG2 pipeline (Threat Prioritizer → Interceptor Allocator → Justifier → Escalation Officer) produces a structured response plan every 2 seconds.
4. A fifth conversational agent (Watch Commander) exposes natural-language Q&A over NLIP/WS+CBOR.
5. Every agent action — message, tool call, handoff — is visibly animated in the console.

The goal is to maximize *demonstrable multi-agent capability* on stage with the AG2 framework as the visible centerpiece.

## 2. Goals and non-goals

### Goals

- Working end-to-end pipeline from synthetic snapshot → AG2 four-agent reasoning → response plan rendered in the console, in under 3 seconds per tick.
- Operator can chat with the Watch Commander over NLIP and receive answers that cite specific snapshot fields and plan IDs.
- The console makes every agent's role, current state, and tool invocations visible through animated cards, a DAG with animated handoff arrows, and an event tape.
- AG2 framework is visibly branded on every active agent card.
- Daytona sandbox is the runtime for at least one agent tool (`simulate_intercept_path`).
- Tavily provides live grounding for the Justifier.
- Designed-in interfaces for sensor input, persistent state, and federation — implemented as no-ops or in-memory shims for v1, ready for swap-in.

### Non-goals (this spec)

- Real edge sensor nodes (laptop webcam, phone camera) — sub-projects B and C.
- Kalman-filter-based fusion of *real* detections — sub-project D. Fusion server here only replays scenario JSON and broadcasts synthetic snapshots.
- 1000-track simulation engine — sub-project E. The demo scenario file may include hundreds of synthetic tracks but no live spawning UI yet.
- Postgres / pgvector / Redis persistence — interfaces defined, in-memory implementation only.
- Federation between MeshShield instances over NLIP — design hooks present, behavior not built.
- Production hardening (TLS, auth, rate limiting beyond Tavily cache).

## 3. Success criteria

The deliverable is accepted when, on a clean checkout:

1. `pnpm install && pnpm protocol:gen && uv sync` produces a working dev environment.
2. `pnpm dev` brings up `apps/fusion`, `apps/agent`, and `apps/console` with no manual fixup.
3. Loading the console at `http://localhost:3000` and clicking **Play scenario** triggers, within 5 seconds:
   - The map showing the protected data-center polygon and replayed tracks.
   - The Activity Theatre cards animating in pipeline order, each with at least one tool call visible.
   - A `ResponsePlan` rendered in the bottom panel with non-empty `assignments` and `justification.snapshot_refs`.
4. Sending the NLIP chat prompt "Why was track T-013 not assigned?" returns a Watch Commander reply within 5 seconds that cites at least one snapshot field path or plan ID.
5. The deterministic test suite (`pytest`, `vitest`, `playwright`) passes in CI without network access for any test other than the optional smoke against OpenRouter.
6. Manual demo run: the 30-second window from "Play scenario" to "ResponsePlan ready" reads to a non-technical observer as four distinct AI agents collaborating, with the AG2 framework visibly named.

## 4. Scope decomposition — where this spec sits

The full PRD decomposes into:

| ID | Sub-project | Status |
|---|---|---|
| **A** | Skeleton, monorepo, shared protocol, fusion server shell, console shell | **This spec** |
| **F** | AG2 multi-agent command system + NLIP boundary | **This spec** |
| B | Edge sensor — laptop webcam + YOLOv8 | Future spec |
| C | Edge sensor — phone (browser ONNX) | Future spec |
| D | Real fusion engine (Mahalanobis + Kalman) | Future spec |
| E | Simulation layer with 1000-track spawning | Future spec |
| G | Console polish (final visual treatment) | Folded into this spec at minimum-viable level |

Each future sub-project gets its own spec → plan → implementation cycle.

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          OPERATOR CONSOLE (Next.js)                      │
│   3D airspace map  │  Agent Activity Theatre  │  NLIP chat (Watch Cmdr)  │
└──────────────┬───────────────┬─────────────────────────┬─────────────────┘
               │ WS snapshots   │ WS agent events         │ NLIP/WS+CBOR
               │                │                         │
       ┌───────▼────────────────▼────┐           ┌────────▼────────────────┐
       │   FUSION SERVER (FastAPI)   │           │  AGENT SERVICE          │
       │  • /sensor (in)  WS         │ Snapshot  │  (FastAPI + AG2 + NLIP) │
       │  • /snapshot (out) WS 10Hz  ├──────────►│  /events (out) WS       │
       │  • scenario player          │           │  /nlip (in/out) WS+CBOR │
       │  • in-memory track store    │           │  AG2 pipeline tick: 2s  │
       └─────────────────────────────┘           └─────────────────────────┘
```

### 5.1 Three runnable services for v1

| Service | Path | Stack | Responsibilities |
|---|---|---|---|
| Fusion | `apps/fusion` | Python 3.12, FastAPI, uvicorn | Owns airspace state. Plays scenario JSON. Accepts (but ignores in v1) sensor WS input. Broadcasts `Snapshot` at 10 Hz. |
| Agent | `apps/agent` | Python 3.12, FastAPI, AG2 (`autogen.beta`), `nlip_server` | Subscribes to fusion snapshots. Runs four-agent AG2 pipeline every 2 s. Broadcasts `AgentEvent` stream. Hosts Watch Commander via NLIP. |
| Console | `apps/console` | Next.js 15 App Router, TypeScript, Tailwind, Framer Motion, react-flow, deck.gl, recharts, Zustand | Renders 3D map, Activity Theatre, NLIP chat, event tape, cost-curve overlay. |

### 5.2 Shared packages

- `packages/protocol` — JSON Schema source of truth for `SensorMessage`, `Snapshot`, `ResponsePlan`, `AgentEvent`. Code-gen targets: Pydantic (Python) and TypeScript types.
- `packages/scenarios` — JSON scenario files. v1 ships `data-center-swarm-attack.json` and `assets/osm-datacenter.geojson`.

### 5.3 Persistence

In-memory only for v1. The fusion server's track store is a single `dict[str, Track]`; the agent service caches the latest `Snapshot`, the latest `ResponsePlan`, and a ring buffer of 200 `AgentEvent`s. Persistence interfaces (`TrackStore`, `EventStore`) are defined as Python `Protocol`s so a Postgres/Redis implementation can be swapped in for v2 without touching the agent code.

## 6. AG2 multi-agent system + NLIP

### 6.1 Agents

| # | Agent | Model | Tools | Output schema |
|---|---|---|---|---|
| 1 | Threat Prioritizer | `google/gemini-2.5-flash` | `get_snapshot()` | `PrioritizedTracks` |
| 2 | Interceptor Allocator | `google/gemini-2.5-flash` | `simulate_intercept_path()` (Daytona), `list_available_interceptors()` | `Allocations` |
| 3 | Justifier | `google/gemini-2.5-flash` | `tavily_recent_threats(region, hours)` | `JustifiedAllocations` |
| 4 | Escalation Officer | `google/gemini-2.5-flash` | `get_policy_thresholds()` | `ResponsePlan` |
| 5 | Watch Commander | `google/gemini-2.5-pro` | `read_latest_plan()`, `read_recent_agent_events()`, `get_snapshot()` | NLIP messages |

Models are selected via the AG2 `OpenAIConfig` from the user's snippet, calling OpenRouter at `https://openrouter.ai/api/v1`. The OpenRouter API key is read from `OPENROUTER_API_KEY` env var; never hardcoded.

### 6.2 Pipeline orchestration

Approach #2 from brainstorming — a hand-orchestrated Python sequence over four `autogen.beta.Agent` instances:

```python
# apps/agent/pipeline.py — interface sketch
async def run_tick(snapshot: Snapshot) -> ResponsePlan:
    emit(StageStarted(agent="prioritizer"))
    prioritized = await prioritizer.ask(snapshot.json())
    emit(StageFinished(agent="prioritizer", payload=prioritized))

    emit(StageStarted(agent="allocator"))
    allocated = await allocator.ask(prioritized)
    emit(StageFinished(agent="allocator", payload=allocated))

    emit(StageStarted(agent="justifier"))
    justified = await justifier.ask(allocated)
    emit(StageFinished(agent="justifier", payload=justified))

    emit(StageStarted(agent="escalator"))
    final = await escalator.ask(justified)
    emit(PlanReady(plan_id=final.plan_id))
    return final
```

Tick cadence: every 2 s. Snapshot stream is 10 Hz; the agent service caches the freshest snapshot between ticks. Skipped snapshots are not retried — only the latest matters for tactical decisions.

### 6.3 Tools

All tools are AG2 `@tool`-decorated Python functions in `apps/agent/tools/`.

- `get_snapshot()` — returns the agent service's cached latest snapshot.
- `list_available_interceptors()` — returns a static list from `packages/scenarios/data-center-swarm-attack.json`.
- `simulate_intercept_path(track_state, interceptor_state)` — POSTs to a Daytona-hosted FastAPI shim. The shim runs numpy ballistic projection and returns `{intercept_ts, miss_distance_m, energy_j}`. Falls back to local numpy if Daytona unreachable, with the result tagged `source: "local-fallback"` so the UI can badge it.
- `tavily_recent_threats(region, hours=72)` — calls Tavily API. Cached per `(region, hour_bucket)` for 1 hour to stay under free-tier quota.
- `get_policy_thresholds()` — returns a static dict from `packages/scenarios/policy.json`. Initial policy: `auto_action_min_conf=0.7`; `escalate_if_tracks_per_asset_gt=10`.
- `read_latest_plan()` / `read_recent_agent_events()` — Watch Commander tools that read from the in-memory event store.

### 6.4 NLIP integration

- **Server:** `nlip_server` (FastAPI), mounted at `/nlip` of `apps/agent`.
- **Binding:** ECMA-432, WebSocket + CBOR, JSON-text fallback.
- **Capabilities advertised:** `query_current_threats`, `explain_decision`, `summarize_situation`.
- **Backend:** the Watch Commander AG2 agent. Its tools read from the same in-memory store the pipeline writes to, so its answers can cite specific `plan_id`s and `snapshot_id`s.
- **Federation hook (designed, not built):** Watch Commander has a stub tool `connect_to_peer(url)` that, in a future iteration, will use the NLIP coordinator-agent pattern to discover a peer MeshShield's capabilities. v1 returns `not_implemented`.

### 6.5 Observability — `AgentEvent` stream

Every meaningful agent action emits an event over the agent service's `/events` WebSocket. Console drives all animations from this stream.

```typescript
type AgentEvent =
  | { kind: "stage_started";     agent: AgentName; ts: number }
  | { kind: "tool_call_started"; agent: AgentName; tool: string; args: object; ts: number }
  | { kind: "tool_call_finished";agent: AgentName; tool: string; result_summary: string; ms: number }
  | { kind: "agent_message";     agent: AgentName; preview: string; full_id: string; tokens: number }
  | { kind: "stage_finished";    agent: AgentName; output_summary: string; ms: number }
  | { kind: "plan_ready";        plan_id: string }
  | { kind: "escalation_raised"; reason: string }
  | { kind: "stage_failed";      agent: AgentName; error: string }
```

### 6.6 Failure modes

| Failure | Behavior |
|---|---|
| OpenRouter / Gemini timeout (>10 s) | Emit `stage_failed`; pipeline holds last-good plan; UI shows agent card in error state with retry option. |
| Daytona unreachable | Allocator's `simulate_intercept_path` falls back to local numpy; result tagged; UI badges "local-fallback". |
| Tavily quota exhausted | Justifier proceeds without external grounding; justification omits `tavily_refs`. |
| NLIP client disconnects | Server logs and continues. Pipeline unaffected. |
| Pipeline tick exceeds 5 s | Logged as warning; next tick uses freshest snapshot, intermediate snapshots dropped. |

## 7. Protocols, schemas, data flow

### 7.1 WebSocket channels

| URL | Direction | Schema | Rate |
|---|---|---|---|
| `ws://fusion/sensor`   | sensor → fusion         | `SensorMessage`         | per-frame (~30 Hz, v1: unused) |
| `ws://fusion/snapshot` | fusion → agent, console | `Snapshot`              | 10 Hz |
| `ws://agent/events`    | agent → console         | `AgentEvent`            | event-driven |
| `ws://agent/nlip`      | console ↔ agent         | NLIP frames (CBOR/JSON) | user-driven |

### 7.2 Schema source of truth

`packages/protocol/schemas/*.json` are JSON Schemas. Build step `pnpm protocol:gen` generates:

- `packages/protocol/python/` — Pydantic models via `datamodel-code-generator`.
- `packages/protocol/ts/` — TypeScript types via `json-schema-to-typescript`.

All schemas carry a `v` field for schema versioning per PRD §6.3.

```jsonc
// SensorMessage  (matches PRD §17.1)
{ "v": 1, "node_id": "laptop-01", "ts": 1714680000.123,
  "detections": [{ "class": "drone", "conf": 0.91,
                   "bearing_deg": 142.5, "elev_deg": 8.3,
                   "px_box": [320,180,80,60] }] }

// Snapshot
{ "v": 1, "snapshot_id": "snap-00042", "ts": 1714680000.250,
  "tracks": [{ "id": "t-001", "origin": "real",
               "pos_3d": [120.4, 88.1, 35.0], "vel": [12.0, -3.2, 0.5],
               "conf": 0.88, "nearest_asset_m": 47.2 }] }

// ResponsePlan
{ "v": 1, "plan_id": "plan-0007", "snapshot_id": "snap-00042", "ts": 1714680002.512,
  "assignments": [{
      "target_id": "t-001", "interceptor_id": "i-002",
      "mode": "rf_jam", "priority": 1,
      "justification": {
        "snapshot_refs": ["tracks[0].pos_3d", "tracks[0].nearest_asset_m"],
        "tavily_refs":   ["headline:Q1-2026-data-center-incident"],
        "policy_refs":   ["clause:proximity_under_50m"]
      }
  }],
  "escalation": { "required": false, "reasons": [] }
}
```

### 7.3 End-to-end tick

1. Fusion emits `Snapshot` at T=0 to all subscribers.
2. Agent service caches it; pipeline tick fires at T=2 s with the freshest cached snapshot.
3. Pipeline emits `stage_started{prioritizer}` → console animates Prioritizer card to thinking state.
4. AG2 calls Gemini-2.5-flash via OpenRouter. Reply parsed → `agent_message{prioritizer}` event.
5. `stage_finished{prioritizer}` → arrow animates Prioritizer → Allocator on the DAG.
6. Allocator calls `simulate_intercept_path` (Daytona) → `tool_call_started{daytona}` → spinner chip → `tool_call_finished` with `ms` timing.
7. Repeat for Justifier (Tavily) and Escalator.
8. `plan_ready` → console renders plan in the bottom panel; map highlights the assigned tracks.
9. If escalation, `escalation_raised` → red flash + modal.
10. Operator types in NLIP chat → Watch Commander processes (AG2 agent #5) → response streams back over NLIP.

### 7.4 Open data fetch in v1

- **OSM data center polygons** — fetched once at fusion startup via Overpass API for the demo coordinates; cached to `packages/scenarios/assets/osm-datacenter.geojson`. Console renders as red polygons.
- **AirSim / Anti-UAV samples** — pre-baked into `packages/scenarios/data-center-swarm-attack.json`. No runtime fetch.

Sentinel-2, full Anti-UAV, Drone-vs-Bird, MAV-VID, DroneRF: deferred to phases B/D/E with documented fetch plans.

## 8. Frontend — Agent Activity Theatre

### 8.1 Layout — three zones

```
┌────────────────────────────────────────┬─────────────────────────────────┐
│                                        │  AGENT ACTIVITY THEATRE         │
│         3D AIRSPACE MAP                │  (4 cards in DAG layout,        │
│         (Deck.gl / Mapbox)             │   animated handoff arrows,      │
│         • red polygons = assets        │   tool chips per agent,         │
│         • blue dots = real tracks      │   AG2 + model badge per card)   │
│         • orange dots = simulated      ├─────────────────────────────────┤
│         • track trails (animated)      │  WATCH COMMANDER (NLIP chat)    │
│         • highlight ring on assigned   │  • role bubbles, streaming      │
│                                        │  • citation chips inline        │
│                                        │  • suggested-prompts row        │
├────────────────────────────────────────┴─────────────────────────────────┤
│ COST-CURVE OVERLAY  •  EVENT TAPE (collapsible, click to highlight)      │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Agent card states

Driven entirely by the `AgentEvent` stream:

| State | Visual | Trigger |
|---|---|---|
| `idle` | dim card, gray ring | initial / between ticks |
| `thinking` | pulsing border (1 Hz), spinner, model badge | `stage_started` |
| `tool_calling` | tool chip slides in below card with spinner; chip color by tool family (Daytona green, Tavily blue, internal gray) | `tool_call_started` |
| `tool_done` | chip flips to result summary + ms; brief green flash | `tool_call_finished` |
| `done` | card glows green for 500 ms, output preview text fades in | `stage_finished` |
| `error` | red border, shake animation, error toast | `stage_failed` or any tool failure |
| `handoff` | animated arrow from this card to the next, drawn over ~400 ms | sequential `stage_finished` → `stage_started` |

A persistent **AG2 chip** sits on every active card (`▸ AG2 · gemini-2.5-flash`) so the framework is visibly named on every step.

### 8.3 Animation stack

- `framer-motion` — card pulses, transitions, arrow draws, modal entries.
- `react-flow` — agent DAG layout (Prioritizer → Allocator → Justifier → Escalator); free pan/zoom and clean arrow animations.
- `deck.gl` + `react-map-gl` — 3D airspace; track positions tween between snapshots so motion is smooth at the visual layer even though snapshots arrive at 10 Hz.
- `recharts` — cost-curve overlay (defender flat, attacker climbing as swarm grows).

Animations are driven by Framer Motion variants tied to the event store, so they re-play deterministically during scenario replay. No CSS-only animations for anything event-driven.

### 8.4 Event tape

Collapsed by default. Shows every `AgentEvent` chronologically with timestamp, agent, kind, expandable JSON detail. Click an event → highlights the corresponding card / arrow / track. Lets a judge ask "what did agent 3 actually say at second 47?" and the operator clicks and shows them.

### 8.5 NLIP chat panel

- Standard chat UI (role bubbles, streaming tokens).
- Backed by an NLIP-over-WS client speaking ECMA-432.
- Each Watch Commander reply renders citation chips inline: `[snapshot.tracks[3].pos_3d]`, `[plan-0007.assignments[1]]`. Clicking a chip scrolls the relevant panel into view and highlights.
- Suggested-prompts row below input: "Why ignore T-013?" / "Summarize current threats" / "What if confidence dropped 20%?".

### 8.6 Frontend ↔ backend wiring

```
console (Next.js, Vercel)
  ├─ /lib/streams/snapshot.ts   ← WS sub to fusion (10 Hz tracks)
  ├─ /lib/streams/agent.ts      ← WS sub to agent (event tape)
  ├─ /lib/nlip/client.ts        ← NLIP-over-WS client (chat)
  └─ Zustand store              ← single source of truth, drives all animations
```

State is reducer-based and event-sourced — replaying the event tape from t=0 reproduces the entire visual state, which powers scenario replay (PRD FR-10) and the backup demo video.

## 9. Testing strategy

| Layer | Test type | Stack |
|---|---|---|
| Schemas | Validation against fixtures | `pytest` + `jsonschema`; TS via `vitest` + `ajv` |
| Fusion | Unit on snapshot publisher + scenario player; integration on WS | `pytest` + `pytest-asyncio` |
| Agent pipeline | Deterministic snapshot fixtures → assert plan structure (Gemini stubbed via cassette pattern) | `pytest` + custom OpenRouter cassette |
| Tools | Unit on each `@tool` (Daytona shim mocked, Tavily mocked) | `pytest` + `respx` |
| NLIP | Conformance smoke against `nlip_sdk` test client | `pytest` |
| Console | Component tests for the Activity Theatre + event-driven state | `vitest` + Testing Library |
| E2E | Scenario replay → assert specific agent events fire in order, screenshot diff of final UI | `playwright` |
| Live smoke (optional) | One opt-in test that calls Gemini via OpenRouter to verify the AG2 path end-to-end. Skipped by default in CI; runs locally when `OPENROUTER_API_KEY` is set. | `pytest -m live` |

TDD per skill default: write the failing test first, then implement. Agent prompts are tuned with a fixed snapshot fixture in the loop, so prompt changes are testable.

## 10. Deployment

| Service | Where | How |
|---|---|---|
| Console | Vercel | `vercel deploy`; env vars for WS URLs |
| Fusion  | Local laptop or Daytona workspace | `uv run uvicorn`; ngrok-style tunnel for the demo |
| Agent   | Same as fusion                    | `uv run uvicorn` |
| Daytona sim sandbox | Daytona cloud         | Lazy-spawned by Allocator on first tool call |

Local dev: `pnpm dev` orchestrates all three services via `concurrently`. `make demo` brings up the full stack with the demo scenario pre-loaded.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| AG2 `autogen.beta` API surface changes mid-build (it is beta) | Pin exact version in `pyproject.toml`. Wrap AG2 calls in a thin adapter (`apps/agent/llm/ag2_adapter.py`) so a swap to alternative orchestration is bounded. |
| OpenRouter rate-limits during demo | Cache the agent decision for the rehearsed scenario; if quota hits, replay from cache and surface a `cached` badge. |
| Daytona spin-up latency on first tool call | Pre-warm the workspace at `apps/agent` startup; if cold-start exceeds 3 s, use local fallback for the first tick only. |
| Tavily key expires / region blocked | Justifier's tool returns empty result; pipeline still produces a plan, just without `tavily_refs`. |
| NLIP server doesn't accept CBOR cleanly from the browser | Fall back to JSON-text frames (the standard permits this); document. |
| Animation jank on stage laptop | All animations capped at 60 fps; map renders with `useMemo`-bounded layers; final pre-flight test on the actual demo machine. |
| Schema mismatch between Pydantic and TS code-gen | CI step diffs round-trip: a fixture JSON → Pydantic → JSON must equal the same fixture loaded by the TS validator. |

## 12. Out of scope (deferred)

- Real laptop / phone sensor nodes (sub-projects B, C).
- Real Mahalanobis + Kalman fusion (sub-project D).
- 1000-track live-spawn UI (sub-project E).
- Postgres / pgvector / Redis persistence (interfaces only in v1).
- NLIP federation between MeshShield instances (designed in, not built).
- Authentication on any service (demo runs in trusted local network).
- Dataset-trained drone classifier (uses the placeholder simulated tracks for v1).

## 13. Open questions

None at this time. All major decisions resolved during brainstorming.

## 14. Glossary

- **AG2** — multi-agent framework (formerly AutoGen). Used here via the `autogen.beta` API surface for `Agent`, `OpenAIConfig`, and `@tool`.
- **NLIP** — Natural Language Interaction Protocol, Ecma-430 (Dec 2025). Application-level protocol between AI agents or between a human and an AI agent.
- **ECMA-432** — NLIP binding over WebSocket using CBOR, with JSON-text fallback. Used for the operator chat channel.
- **OpenRouter** — LLM router used by AG2 in this project to access Gemini models without a GCP account.
- **Daytona** — cloud sandbox runtime for agent tool calls; provides isolation per PRD §6.3.
- **Tavily** — web-search API used by the Justifier for live grounding.
- **Snapshot** — the unified airspace state at one instant; the canonical input to the agent pipeline.
- **ResponsePlan** — the canonical output of one pipeline tick, consumed by the operator console.
- **Activity Theatre** — the console panel that visualizes agent state and tool calls.
