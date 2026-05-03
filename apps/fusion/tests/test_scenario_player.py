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
