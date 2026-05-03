from __future__ import annotations
from typing import Any
from meshshield_protocol import Snapshot

class TrackStore:
    def __init__(self) -> None:
        self._tracks: dict[str, dict[str, Any]] = {}

    def upsert(self, track: dict[str, Any]) -> None:
        self._tracks[track["id"]] = {
            "id": track["id"],
            "origin": track["origin"],
            "pos_3d": list(track["pos_3d"]),
            "vel":    list(track["vel"]),
            "conf":   float(track["conf"]),
            "nearest_asset_m": float(track.get("nearest_asset_m", 0.0)),
        }

    def remove(self, track_id: str) -> None:
        self._tracks.pop(track_id, None)

    def snapshot(self, snapshot_id: str, ts: float) -> Snapshot:
        return Snapshot.model_validate({
            "v": 1, "snapshot_id": snapshot_id, "ts": ts,
            "tracks": list(self._tracks.values()),
        })
