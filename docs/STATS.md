# Stats and Metrics

Measured values from the `feat/skeleton-and-agent` branch as of 2026-05-03. Values marked **target** are design targets from the spec, not measured in CI.

---

## Test Counts

| Suite | Runner | Count | Command |
|---|---|---|---|
| Backend Python | pytest | **52 collected** | `uv run pytest --co -q` |
| Console TypeScript | vitest | **20 passing** | `pnpm --filter @meshshield/console exec vitest run` |
| E2E | Playwright | **2 spec files** | `pnpm --filter @meshshield/console exec playwright test` |
| **Total** | | **74+** | |

### Python Test Breakdown by Module

| Module | Tests |
|---|---|
| `apps/agent/tests/` | ~35 |
| `apps/fusion/tests/` | ~10 |
| `packages/protocol/tests/` | ~7 |
| `tests/` (root integration) | 3 |

### Console Test Breakdown

| File | Tests |
|---|---|
| `tests/components/ActivityTheatre.test.tsx` | DAG node count |
| `tests/components/AgentCard.test.tsx` | State ring classes |
| `tests/components/CostCurveOverlay.test.tsx` | Chart render |
| `tests/components/EventTape.test.tsx` | Event list |
| `tests/components/Header.test.tsx` | Brand chip |
| `tests/components/Map3D.test.tsx` | Mock deck.gl mount |
| `tests/components/NlipChat.test.tsx` | Input + citation chips |
| `tests/components/PlanPanel.test.tsx` | Assignment list |
| `tests/components/page.test.tsx` | Page smoke |
| `tests/store.test.ts` | All `applyAgentEvent` kinds |
| `tests/streams.test.ts` | WS reconnect |
| `tests/nlip.test.ts` | CBOR/JSON frames |
| `tests/smoke.test.ts` | Import smoke |

---

## Lines of Code

Measured with `find apps packages -name "*.py" -o -name "*.ts" -o -name "*.tsx" | grep -v node_modules | grep -v __pycache__ | grep -v .next | xargs wc -l`.

| Service / Package | Language | LOC |
|---|---|---|
| `apps/agent/` | Python | ~630 |
| `apps/fusion/` | Python | ~250 |
| `packages/protocol/python/` | Python (generated) | ~180 |
| `packages/protocol/tests/` | Python | ~100 |
| `tests/` (root) | Python | ~80 |
| **Python subtotal** | | **~1,240** |
| `apps/console/components/` | TypeScript/TSX | ~430 |
| `apps/console/lib/` | TypeScript | ~120 |
| `apps/console/tests/` | TypeScript | ~220 |
| `apps/console/e2e/` | TypeScript | ~80 |
| `packages/protocol/ts/` | TypeScript (generated) | ~120 |
| **TypeScript subtotal** | | **~970** |
| **Grand total (source)** | | **~2,210** |
| **Grand total (including generated)** | | **~2,799** |

The generated files (`packages/protocol/python/` and `packages/protocol/ts/src/`) account for ~590 lines.

---

## Latency Targets

| Metric | Target | Notes |
|---|---|---|
| Pipeline P50 latency | < 3 s per tick | Time from snapshot delivery to `plan_ready` event |
| Pipeline hard cap | 5 s | Logged as `WARNING`; next tick uses fresh snapshot |
| Snapshot publish rate | 10 Hz (100 ms) | Fusion service loop period |
| Agent tick cadence | 2 s | `AGENT_TICK_S` env var |
| Daytona tool timeout | 1.5 s | Falls back to local sim if exceeded |
| Tavily tool timeout | 5 s | Cache miss penalty; 1-hour cache TTL |
| EventBus replay window | 50 events | Late-join subscribers receive last 50 |
| AgentStore ring buffer | 200 events | Watch Commander context window |
| Console event tape | 500 events | Last 500 kept in Zustand store |

All latency targets are **design targets** from the spec. Actual P50 depends on OpenRouter / Gemini 2.5 Flash inference time, which varies with load. In typical hackathon testing, the pipeline runs in 1.5–2.5 s.

---

## Functional Requirement Coverage

From the spec (`docs/superpowers/specs/2026-05-03-meshshield-skeleton-and-agent-design.md`):

| FR | Requirement | Status |
|---|---|---|
| FR-1 | Fusion publishes Snapshot at 10 Hz | Implemented |
| FR-2 | Agent subscribes to Fusion WS | Implemented |
| FR-3 | Pipeline runs 4 AG2 agents per tick | Implemented |
| FR-4 | Prioritizer produces risk-sorted tracks | Implemented |
| FR-5 | Allocator uses Daytona sim with local fallback | Implemented |
| FR-6 | Justifier grounds with Tavily | Implemented |
| FR-7 | Escalator produces ResponsePlan | Implemented |
| FR-8 | EventBus fans out to N console subscribers | Implemented |
| FR-9 | Watch Commander over NLIP WS (ECMA-432) | Implemented |
| FR-10 | Console renders Activity Theatre DAG | Implemented |
| FR-11 | Console renders 3D airspace map | Implemented |
| FR-12 | Console renders NLIP chat with citation chips | Implemented |
| FR-13 | Console renders Plan panel | Implemented |
| FR-14 | Console renders Cost-curve overlay | Implemented |
| FR-15 | JSON Schema → Pydantic + TS codegen | Implemented |
| FR-16 | 50+ Python tests, no live network required | Implemented (52) |
| FR-17 | 20+ TS tests | Implemented (20) |
| FR-18 | Playwright E2E with fake backend | Implemented |
| FR-19 | Real sensor node (YOLOv8) | Deferred (sub-project B) |
| FR-20 | Real Kalman fusion | Deferred (sub-project D) |

**Coverage: 18/20 FRs implemented (90%)**. The two deferred FRs are explicitly out-of-scope for the hackathon demo.

---

## Git Metrics

| Metric | Value |
|---|---|
| Total commits on branch | 43 |
| Branch name | `feat/skeleton-and-agent` |
| Python version | 3.12 |
| Node version (pnpm) | 20+ |
