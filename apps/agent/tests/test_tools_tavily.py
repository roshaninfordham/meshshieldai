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
