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
