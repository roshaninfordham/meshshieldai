import json, sys, urllib.request
from pathlib import Path

QUERY = """
[out:json][timeout:25];
(
  way[building=data_center](around:2000,37.4275,-122.1697);
  relation[building=data_center](around:2000,37.4275,-122.1697);
);
out geom;
""".strip()

def main(outpath: str) -> None:
    req = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=("data=" + QUERY).encode(),
        headers={"User-Agent": "MeshShield/0.1 (demo)"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    features = []
    for el in data.get("elements", []):
        coords = [[g["lon"], g["lat"]] for g in el.get("geometry", [])]
        if len(coords) < 4:
            continue
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        features.append({"type":"Feature",
                         "geometry":{"type":"Polygon","coordinates":[coords]},
                         "properties":{"osm_id": el.get("id"),"name": el.get("tags",{}).get("name","")}})
    fc = {"type":"FeatureCollection","features":features}
    Path(outpath).parent.mkdir(parents=True, exist_ok=True)
    Path(outpath).write_text(json.dumps(fc, indent=2))

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "packages/scenarios/assets/osm-datacenter.json")
