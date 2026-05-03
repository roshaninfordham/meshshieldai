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
    seen: list[tuple[str, str]] = []
    a = LLMAdapter(model="cassette", llm=cas, on_lifecycle=lambda kind, agent: seen.append((kind, agent)))
    out = await a.ask("x", "y")
    assert out == "ok"
    assert seen == [("started", "x"), ("finished", "x")]
