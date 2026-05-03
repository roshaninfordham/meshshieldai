"use client";
import DeckGL from "@deck.gl/react";
import { Map as MapLibre } from "react-map-gl/maplibre";
import { ScatterplotLayer, GeoJsonLayer } from "@deck.gl/layers";
import { useMemo } from "react";
import { useMeshStore } from "@/lib/store";
import osm from "@meshshield/scenarios/assets/osm-datacenter.geojson";

const INITIAL = { longitude: -122.1697, latitude: 37.4275, zoom: 16, pitch: 45, bearing: 0 };

export function Map3D() {
  const tracks = useMeshStore((s) => s.tracks);
  const plan = useMeshStore((s) => s.plan) as any;
  const assigned = new Set((plan?.assignments ?? []).map((a: any) => a.target_id));

  const dotData = useMemo(() => tracks.map((t: any) => ({
    pos: [INITIAL.longitude + t.pos_3d[0] * 1e-5, INITIAL.latitude + t.pos_3d[1] * 1e-5, t.pos_3d[2]],
    color: t.origin === "real" ? [92, 242, 192] : [252, 176, 69],
    radius: assigned.has(t.id) ? 8 : 4,
    id: t.id,
  })), [tracks, plan]);

  const layers = useMemo(() => ([
    new GeoJsonLayer({ id: "asset", data: osm as any, getFillColor: [255, 92, 92, 60], getLineColor: [255, 92, 92] }),
    new ScatterplotLayer({ id: "tracks", data: dotData, getPosition: (d:any) => d.pos, getFillColor: (d:any) => d.color, getRadius: (d:any) => d.radius, radiusUnits: "pixels" }),
  ]), [dotData]);

  return (
    <div className="h-[420px] rounded-xl overflow-hidden ring-1 ring-white/10">
      <DeckGL initialViewState={INITIAL} controller layers={layers}>
        <MapLibre mapStyle="https://demotiles.maplibre.org/style.json" />
      </DeckGL>
    </div>
  );
}
