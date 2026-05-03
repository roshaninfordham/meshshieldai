# Learnings

Build retrospective for MeshShield, developed for the AG2 Hackathon on the `feat/skeleton-and-agent` branch. These are concrete, actionable learnings from the implementation — not aspirations.

---

## 1. AG2 `autogen.beta` Lazy-Import Pattern Keeps Tests Offline

**What we did:**

```python
class _AG2LLM:
    def _ensure_loaded(self) -> None:
        if self._cfg is not None or self._stubbed:
            return
        key = self._api_key or os.environ.get("OPENROUTER_API_KEY")
        if not key:
            self._stubbed = True
            return
        from autogen.beta import Agent         # ← lazy import
        from autogen.beta.config import OpenAIConfig
        self._Agent = Agent
        self._cfg = OpenAIConfig(...)
```

**The payoff:** The entire agent test suite — 35 tests — runs without `OPENROUTER_API_KEY` in the environment. The import of `autogen.beta` never executes during tests because tests inject `CassetteLLM` directly, bypassing `_AG2LLM` entirely. This means CI is fast and free.

**The alternative would have been painful:** Mocking the import machinery (`sys.modules`, `unittest.mock.patch`) is fragile and couples tests to internal implementation details. The lazy-import pattern avoids this entirely.

**Lesson:** For any framework with heavyweight initialization (network clients, model loading), put the import inside a `_ensure_loaded()` guard rather than at module level. Tests can then inject alternatives without touching the import.

---

## 2. Cassette Pattern for Deterministic LLM Tests

**What we built:**

```python
class CassetteLLM:
    def __init__(self, mapping: dict[str, str]) -> None:
        self._m = mapping

    async def ask(self, name: str, prompt: str) -> str:
        key = f"{name}:{prompt}"
        if key not in self._m:
            raise KeyError(f"cassette miss: {key!r}")
        return self._m[key]
```

Tests use `LLMAdapter(model="test", llm=CassetteLLM({key: response}))`. The key is `f"{agent_name}:{built_prompt}"`.

**The payoff:** Tests are exact and reproducible. A cassette miss raises `KeyError` immediately — no silent fallthrough. When the prompt contract changes (system prompt edited), the KeyError tells you which test needs updating.

**The tradeoff:** Cassettes are brittle by design. Change the system prompt → all cassettes using that agent break. This is a feature: it prevents silent prompt regressions. The fix is to re-record the cassette with the new prompt, which forces you to verify the expected output still makes sense.

**Lesson:** LLM tests need to be either hermetic (cassette) or explicitly live (marked `@pytest.mark.live`). Mixing them leads to flaky CI. Use `CassetteLLM` for unit tests, add a separate `tests/live/` directory guarded by `OPENROUTER_API_KEY` for live smoke tests.

---

## 3. JSON Schema → Pydantic + TypeScript Round-Trip Catches Schema Drift Early

**What we did:**

`packages/protocol/schemas/*.schema.json` → `make protocol-gen` → Pydantic models + TypeScript interfaces.

The round-trip tests in `packages/protocol/tests/test_roundtrip.py` serialize a fixture through Pydantic and assert the output matches the input. The TypeScript test asserts `fixture as Snapshot` compiles.

**The payoff:**

In one instance during development, we added `nearest_asset_m` to the `Track` schema. Forgetting to run `make protocol-gen` meant the TypeScript interface didn't have the field — the TypeScript test caught this as a compile error within seconds.

Without the round-trip tests, the field would have silently worked in Python but been missing from the TypeScript type — the kind of bug that surfaces only when the UI tries to read the field.

**Lesson:** In a polyglot monorepo, schema drift between runtimes is the most common source of hard-to-debug bugs. JSON Schema + codegen + round-trip tests is the cheapest prevention.

---

## 4. Event-Sourcing the UI Made Scenario Replay and Playwright E2E Trivially Derivable

**What we built:**

```typescript
export function applyAgentEvent(ev: AgentEvent): void {
  useMeshStore.setState((s) => {
    // pure function: (state, event) → new state
    ...
  });
}
```

**The payoff:**

The Playwright E2E fixture (`e2e/fixtures/fake-fusion-and-agent.mjs`) just emits a pre-recorded event sequence over WebSocket. It contains zero agent logic — just a list of JSON objects piped through WebSocket. The console reconstructs exactly the same visual state as a live run.

This meant E2E tests were written in ~2 hours, not days. No live OpenRouter calls in CI.

**The bonus:** The EventTape component in the UI is the actual event stream. Users can audit every decision by clicking through the tape. This "audit trail for free" is a direct consequence of event sourcing — not additional work.

**Lesson:** If your UI state is derived from events, event sourcing costs almost nothing extra and gives you replay, audit, and E2E test fixtures for free. The key is making `applyAgentEvent` a pure function from the start — retrofitting purity is hard.

---

## 5. NLIP is a Wire Protocol, Not an Agent Framework

**What we learned:**

We spent a few hours early on wondering whether NLIP should replace AG2 or sit alongside it. The answer became clear once we read the spec properly: NLIP is Ecma-430, a **wire format** for natural-language messages between systems. AG2 is an orchestration framework for multi-agent reasoning. They solve completely different problems.

The clean separation:
- **AG2 thinks** — conversation state, model routing, structured output contracts
- **NLIP speaks** — standardized wire format at the operator boundary

The NLIP server is 57 lines. It deserializes an NLIP message, calls `WatchCommander.respond(question)`, and serializes the answer. That's it. The Watch Commander doesn't know it's behind NLIP; the NLIP server doesn't know anything about agents.

**Lesson:** NLIP is the HTTP of agent communication — a transport standard that any framework can sit behind. Don't confuse the wire protocol with the application logic.

---

## 6. Local Fallback for Daytona Makes the Demo Resilient

**What we built:**

```python
def simulate_intercept_path(track_state: dict, interceptor_state: dict) -> dict:
    if not daytona_base_url:
        return _local_sim(track_state, interceptor_state)
    try:
        r = httpx.post(f"{daytona_base_url}/sim", ..., timeout=1.5)
        r.raise_for_status()
        data = r.json()
        data["source"] = "daytona"
        return data
    except Exception:
        return _local_sim(track_state, interceptor_state)   # always succeeds
```

**The payoff:**

During the demo, Daytona had a slow startup. The allocator fell back to local numpy without the pipeline ever noticing. The `_sim_sources` badge on the AgentCard showed `local-fallback` instead of `daytona`, making the provenance visible to the judges without breaking the demo.

The local fallback is physically reasonable (closing-speed approximation) — not a fake. Judges could see the difference in the badge and ask about it, which led to a good discussion about the Daytona integration.

**Lesson:** Every external service call in a demo system needs a local fallback. Make the fallback provenance visible (`_sim_sources` badge) — it becomes a talking point, not a weakness.

---

## 7. `_sim_sources` Badge: Provenance as a First-Class UI Concern

**What we added:**

```python
# Allocator adds this after collecting sim results
out["_sim_sources"] = {
    tid: list({r["source"] for r in rows})
    for tid, rows in sim_results.items()
}
```

The console renders this as a colored badge on the Allocator's AgentCard: green for `daytona`, amber for `local-fallback`.

**The insight:** In a defense system, operators need to know the provenance of every number. "This intercept time came from a sandboxed ballistic sim" vs "this is a local approximation" is a material difference. Making this visible by default — not buried in logs — is the right design.

**Lesson:** Build provenance tracking into your data model, not into your logs. If it's in the data, you can surface it in the UI automatically. If it's only in logs, it's invisible to operators.

---

## 8. `pnpm` + `uv` Polyglot Monorepo Works Well

**What we did:**

`pnpm-workspace.yaml` defines the JS packages. `pyproject.toml` at the root uses `uv` with `tool.uv.workspace` to manage the Python packages. `make install` runs both.

**The payoff:** Single command setup. No Dockerfile needed for local dev. TypeScript types and Python models regenerate from the same schema with one command.

**The gotcha:** `find apps packages -name "*.py" | xargs wc -l` gives unexpected results if you forget to exclude `.venv/`. Always use the `| grep -v .venv` filter.

---

## 9. `importlib` Import Mode for pytest Avoids Module Name Collisions

**The problem:** Both `apps/agent/tests/` and `apps/fusion/tests/` had a `test_store.py`. With default pytest import mode, the second one silently shadowed the first.

**The fix:**

```toml
# pyproject.toml
[tool.pytest.ini_options]
addopts = "--import-mode=importlib"
```

`importlib` mode gives each test file its own isolated import namespace, so same-named test modules don't collide.

**Lesson:** Use `--import-mode=importlib` from day one in any project with multiple `src`-layout packages. The default mode is a footgun.
