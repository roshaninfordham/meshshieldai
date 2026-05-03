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
