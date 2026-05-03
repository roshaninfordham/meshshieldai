from fusion.store import TrackStore
from meshshield_protocol import Snapshot

def test_track_store_apply_and_snapshot():
    store = TrackStore()
    store.upsert({"id":"t-1","origin":"real","pos_3d":[1,2,3],"vel":[0,0,0],"conf":0.9,"nearest_asset_m":50.0})
    snap = store.snapshot(snapshot_id="snap-1", ts=1.0)
    assert isinstance(snap, Snapshot)
    assert len(snap.tracks) == 1 and snap.tracks[0].id == "t-1"

def test_track_store_remove():
    store = TrackStore()
    store.upsert({"id":"t-1","origin":"real","pos_3d":[0,0,0],"vel":[0,0,0],"conf":0.9})
    store.remove("t-1")
    snap = store.snapshot(snapshot_id="snap-2", ts=2.0)
    assert snap.tracks == []
