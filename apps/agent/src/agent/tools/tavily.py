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
