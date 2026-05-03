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
