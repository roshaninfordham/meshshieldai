"use client";
import { useMemo, useRef, useEffect, useState } from "react";
import { useMeshStore } from "@/lib/store";

// Static scenario data (matches packages/scenarios/data-center-swarm-attack.json)
const INTERCEPTORS = [
  { id: "i-001", kind: "rf_jam",  pos: [-50, -10] },
  { id: "i-002", kind: "kinetic", pos: [50,  -10] },
  { id: "i-003", kind: "spoof",   pos: [-10,  60] },
  { id: "i-004", kind: "rf_jam",  pos: [10,   60] },
] as const;

const ASSET = { name: "Hyperscaler DC East", pos: [0, 0] as [number, number], radius: 60 };

const MODE_COLOR: Record<string, string> = {
  rf_jam:  "#4facfe",
  kinetic: "#ff5c5c",
  spoof:   "#c084fc",
};

const TRAIL_LEN = 10;

type TrailBuffer = Record<string, Array<[number, number]>>;

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

export function AirspaceCanvas() {
  const tracks  = useMeshStore((s) => s.tracks);
  const plan    = useMeshStore((s) => s.plan) as any;
  const tape    = useMeshStore((s) => s.tape);
  const hlClass = usePanelHighlight("map");

  // Trail buffer — maintained across renders
  const trailRef = useRef<TrailBuffer>({});
  useEffect(() => {
    tracks.forEach((t: any) => {
      const buf = trailRef.current[t.id] ?? [];
      const last = buf[buf.length - 1];
      const nx = t.pos_3d[0], ny = t.pos_3d[1];
      if (!last || last[0] !== nx || last[1] !== ny) {
        trailRef.current[t.id] = [...buf, [nx, ny]].slice(-TRAIL_LEN);
      }
    });
  });

  // Live counter values
  const tickCount    = useMemo(() => tape.filter((e: any) => e.kind === "plan_ready").length, [tape]);
  const assignments: any[] = useMemo(() => plan?.assignments ?? [], [plan]);
  const assignedSet  = useMemo(() => new Set(assignments.map((a: any) => a.target_id ?? a.track_id)), [assignments]);

  // --- Coordinate transform ---
  // Gather all points to compute viewbox
  const allX = [...tracks.map((t: any) => t.pos_3d[0]), ...INTERCEPTORS.map(i => i.pos[0]), ASSET.pos[0]];
  const allY = [...tracks.map((t: any) => t.pos_3d[1]), ...INTERCEPTORS.map(i => i.pos[1]), ASSET.pos[1]];
  const PAD = 120;
  const rawMinX = Math.min(...allX, -300) - PAD;
  const rawMaxX = Math.max(...allX,  300) + PAD;
  const rawMinY = Math.min(...allY, -300) - PAD;
  const rawMaxY = Math.max(...allY,  300) + PAD;
  const W = rawMaxX - rawMinX;
  const H = rawMaxY - rawMinY;

  // SVG coords: flip Y axis (SVG Y goes down)
  const toSvg = (x: number, y: number): [number, number] => [
    ((x - rawMinX) / W) * 500,
    ((rawMaxY - y) / H) * 500,
  ];

  // Asset position in SVG
  const [ax, ay] = toSvg(ASSET.pos[0], ASSET.pos[1]);
  const assetRadius = (ASSET.radius / W) * 500;
  const underThreat = tracks.some((t: any) => {
    const dx = t.pos_3d[0] - ASSET.pos[0];
    const dy = t.pos_3d[1] - ASSET.pos[1];
    return Math.sqrt(dx * dx + dy * dy) < ASSET.radius;
  });

  return (
    <div className={`h-[420px] rounded-xl overflow-hidden ring-1 ring-white/10 transition-shadow duration-300 ${hlClass} relative`}
         style={{ background: "#0b0f17" }}>
      {/* Live counter strip */}
      <div className="absolute top-0 left-0 right-0 z-10 flex gap-4 px-4 py-2 text-xs font-mono"
           style={{ background: "rgba(11,15,23,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: "#5cf2c0" }}>📡 {tracks.length} tracks</span>
        <span style={{ color: "#4facfe" }}>🛡 {INTERCEPTORS.length} interceptors</span>
        <span style={{ color: "#fcb045" }}>⚡ {assignments.length} assignments</span>
        <span style={{ color: "#7c869b" }}>pipeline tick #{tickCount}</span>
      </div>

      {/* Legend strip */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex gap-4 px-4 py-1.5 text-[10px] font-mono"
           style={{ background: "rgba(11,15,23,0.85)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span><span style={{ color: "#5cf2c0" }}>● real</span></span>
        <span><span style={{ color: "#fcb045" }}>● simulated</span></span>
        <span><span style={{ color: "#4facfe" }}>▲ rf_jam</span></span>
        <span><span style={{ color: "#ff5c5c" }}>▲ kinetic</span></span>
        <span><span style={{ color: "#c084fc" }}>▲ spoof</span></span>
        <span><span style={{ color: "#ff5c5c" }}>⬡ asset</span></span>
      </div>

      <svg viewBox={`0 0 500 500`} width="100%" height="100%"
           style={{ display: "block", paddingTop: "28px", paddingBottom: "26px" }}>
        {/* Dot grid background */}
        <defs>
          <pattern id="dotgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <style>{`
            @keyframes dash-anim { to { stroke-dashoffset: -24; } }
            @keyframes pulse-ring { 0%,100% { opacity:0.6; r:${assetRadius + 4}; } 50% { opacity:1; r:${assetRadius + 12}; } }
            @keyframes pulse-ring-threat { 0%,100% { opacity:0.9; r:${assetRadius + 4}; } 50% { opacity:1; r:${assetRadius + 20}; } }
            .dash-line { stroke-dasharray: 8 4; animation: dash-anim 0.6s linear infinite; }
            .asset-ring { animation: pulse-ring 2s ease-in-out infinite; }
            .asset-ring-threat { animation: pulse-ring-threat 0.8s ease-in-out infinite; }
          `}</style>
        </defs>
        <rect x="0" y="0" width="500" height="500" fill="url(#dotgrid)" />

        {/* Asset */}
        <circle
          cx={ax} cy={ay}
          r={assetRadius + 4}
          fill="none"
          stroke="#ff5c5c"
          strokeWidth="1.5"
          className={underThreat ? "asset-ring-threat" : "asset-ring"}
          strokeOpacity="0.7"
        />
        <AssetHex cx={ax} cy={ay} size={18} />
        <text x={ax} y={ay - 24} textAnchor="middle" fill="#ff5c5c" fontSize="9" fontFamily="monospace" fontWeight="bold">
          🏢 Hyperscaler DC East · ASSET
        </text>

        {/* Interceptors */}
        {INTERCEPTORS.map(int => {
          const [ix, iy] = toSvg(int.pos[0], int.pos[1]);
          const col = MODE_COLOR[int.kind] ?? "#aaa";
          return (
            <g key={int.id}>
              {/* Triangle */}
              <InterceptorTriangle cx={ix} cy={iy} color={col} />
              <text x={ix} y={iy + 18} textAnchor="middle" fill={col} fontSize="8" fontFamily="monospace">
                🛡 {int.id} · {int.kind}
              </text>
            </g>
          );
        })}

        {/* Assignment lines */}
        {assignments.map((a: any) => {
          const targetId = a.target_id ?? a.track_id;
          const intId    = a.interceptor_id;
          const track    = tracks.find((t: any) => t.id === targetId);
          const int_     = INTERCEPTORS.find(i => i.id === intId);
          if (!track || !int_) return null;
          const [tx, ty] = toSvg(track.pos_3d[0], track.pos_3d[1]);
          const [ix, iy] = toSvg(int_.pos[0], int_.pos[1]);
          const mx = (tx + ix) / 2, my = (ty + iy) / 2;
          const col = MODE_COLOR[a.mode ?? int_.kind] ?? "#fcb045";
          return (
            <g key={`asgn-${a.interceptor_id}-${targetId}`}>
              <line x1={ix} y1={iy} x2={tx} y2={ty}
                    stroke={col} strokeWidth="1.2" strokeOpacity="0.6"
                    className="dash-line" />
              <text x={mx} y={my - 4} textAnchor="middle" fill={col}
                    fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                {a.mode ?? int_.kind}
              </text>
            </g>
          );
        })}

        {/* Tracks */}
        {tracks.map((t: any) => {
          const [tx, ty] = toSvg(t.pos_3d[0], t.pos_3d[1]);
          const isReal   = t.origin === "real";
          const col      = isReal ? "#5cf2c0" : "#fcb045";
          const isAssigned = assignedSet.has(t.id);
          const trail    = trailRef.current[t.id] ?? [];

          // Velocity vector
          const vx = t.vel?.[0] ?? 0, vy = t.vel?.[1] ?? 0;
          const vScale = 2.5;
          const [vtx, vty] = toSvg(t.pos_3d[0] + vx * vScale, t.pos_3d[1] + vy * vScale);

          return (
            <g key={t.id}>
              {/* Trail */}
              {trail.slice(0, -1).map(([px, py]: [number, number], i: number) => {
                const [spx, spy] = toSvg(px, py);
                const alpha = (i + 1) / trail.length * 0.4;
                return <circle key={i} cx={spx} cy={spy} r="2" fill={col} opacity={alpha} />;
              })}

              {/* Velocity vector */}
              {(vx !== 0 || vy !== 0) && (
                <line x1={tx} y1={ty} x2={vtx} y2={vty}
                      stroke={col} strokeWidth="0.8" strokeOpacity="0.5" />
              )}

              {/* Assignment ring */}
              {isAssigned && (
                <circle cx={tx} cy={ty} r="12" fill="none"
                        stroke="#fcb045" strokeWidth="1.5" strokeOpacity="0.8"
                        strokeDasharray="3 2" />
              )}

              {/* Drone icon */}
              <DroneIcon cx={tx} cy={ty} color={col} />

              {/* Label */}
              <text x={tx + 12} y={ty - 6} fill={col} fontSize="8" fontFamily="monospace" fontWeight="bold">
                {t.id.toUpperCase()}
              </text>
              <text x={tx + 12} y={ty + 3} fill={col} fontSize="7.5" fontFamily="monospace" opacity="0.8">
                {Math.round((t.conf ?? t.confidence ?? 0) * 100)}% conf
              </text>
              {(() => {
                const dx = t.pos_3d[0] - ASSET.pos[0];
                const dy = t.pos_3d[1] - ASSET.pos[1];
                const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
                return (
                  <text x={tx + 12} y={ty + 12} fill="#7c869b" fontSize="7" fontFamily="monospace">
                    {dist}m to asset
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Empty state */}
        {tracks.length === 0 && (
          <text x="250" y="270" textAnchor="middle" fill="#7c869b" fontSize="13" fontFamily="monospace">
            Awaiting airspace tracks…
          </text>
        )}
      </svg>
    </div>
  );
}

// --- Sub-shapes ---

function DroneIcon({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const s = 7; // arm half-length
  return (
    <g>
      {/* Diagonal arms */}
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Motor circles */}
      <circle cx={cx - s} cy={cy - s} r="2.5" fill={color} opacity="0.9" />
      <circle cx={cx + s} cy={cy - s} r="2.5" fill={color} opacity="0.9" />
      <circle cx={cx - s} cy={cy + s} r="2.5" fill={color} opacity="0.9" />
      <circle cx={cx + s} cy={cy + s} r="2.5" fill={color} opacity="0.9" />
      {/* Center body */}
      <circle cx={cx} cy={cy} r="3" fill={color} />
    </g>
  );
}

function InterceptorTriangle({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  const s = 9;
  const pts = `${cx},${cy - s} ${cx - s * 0.87},${cy + s * 0.5} ${cx + s * 0.87},${cy + s * 0.5}`;
  return <polygon points={pts} fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" />;
}

function AssetHex({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  // Flat-top hexagon
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
  return (
    <polygon points={pts}
             fill="#ff5c5c" fillOpacity="0.3"
             stroke="#ff5c5c" strokeWidth="2" />
  );
}
