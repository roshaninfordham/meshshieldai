"use client";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useMeshStore } from "@/lib/store";

// Static scenario data (matches packages/scenarios/data-center-swarm-attack.json)
const INTERCEPTORS = [
  { id: "i-001", kind: "rf_jam",  pos: [-50, -10], range: 250 },
  { id: "i-002", kind: "kinetic", pos: [50,  -10], range: 300 },
  { id: "i-003", kind: "spoof",   pos: [-10,  60], range: 180 },
  { id: "i-004", kind: "rf_jam",  pos: [10,   60], range: 250 },
] as const;

const ASSET = { name: "Hyperscaler DC East", pos: [0, 0] as [number, number], radius: 60 };
const RANGE_RINGS = [50, 100, 200]; // metres

const MODE_COLOR: Record<string, string> = {
  rf_jam:  "#4facfe",
  kinetic: "#ff5c5c",
  spoof:   "#c084fc",
};

const TRAIL_LEN = 10;
const SVG_SIZE = 600;

type TrailBuffer = Record<string, Array<[number, number]>>;
type PanZoom = { scale: number; tx: number; ty: number };

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

function formatUtcTime(d: Date): string {
  return d.toUTCString().replace(/.*(\d\d:\d\d:\d\d) GMT/, "$1");
}

export function AirspaceCanvas() {
  const tracks    = useMeshStore((s) => s.tracks);
  const plan      = useMeshStore((s) => s.plan) as any;
  const tape      = useMeshStore((s) => s.tape);
  const hlClass   = usePanelHighlight("map");

  // Pan/zoom state
  const [pz, setPz] = useState<PanZoom>({ scale: 1, tx: 0, ty: 0 });
  const [locked, setLocked] = useState(false);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const svgRef  = useRef<SVGSVGElement>(null);

  // Clock
  const [clock, setClock] = useState(() => formatUtcTime(new Date()));
  useEffect(() => {
    const id = setInterval(() => setClock(formatUtcTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // Trail buffer
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

  const tickCount   = useMemo(() => tape.filter((e: any) => e.kind === "plan_ready").length, [tape]);
  const assignments: any[] = useMemo(() => plan?.assignments ?? [], [plan]);
  const assignedSet = useMemo(() => new Set(assignments.map((a: any) => a.target_id ?? a.track_id)), [assignments]);

  // Coordinate transform (fixed window 600×600 world units)
  const PAD = 120;
  const rawMinX = -300 - PAD, rawMaxX = 300 + PAD;
  const rawMinY = -300 - PAD, rawMaxY = 300 + PAD;
  const W = rawMaxX - rawMinX;
  const H = rawMaxY - rawMinY;

  const toSvg = useCallback((x: number, y: number): [number, number] => [
    ((x - rawMinX) / W) * SVG_SIZE,
    ((rawMaxY - y) / H) * SVG_SIZE,
  ], [rawMinX, rawMaxY, W, H]);

  const [ax, ay] = toSvg(ASSET.pos[0], ASSET.pos[1]);
  const assetRadius = (ASSET.radius / W) * SVG_SIZE;
  const underThreat = tracks.some((t: any) => {
    const dx = t.pos_3d[0] - ASSET.pos[0];
    const dy = t.pos_3d[1] - ASSET.pos[1];
    return Math.sqrt(dx * dx + dy * dy) < ASSET.radius;
  });
  const threatCount = tracks.filter((t: any) => {
    const dx = t.pos_3d[0] - ASSET.pos[0];
    const dy = t.pos_3d[1] - ASSET.pos[1];
    return Math.sqrt(dx * dx + dy * dy) < ASSET.radius;
  }).length;

  // Zoom / pan handlers
  const zoom = useCallback((delta: number) => {
    setPz(p => ({ ...p, scale: Math.max(0.4, Math.min(4, p.scale + delta)) }));
  }, []);

  const fitToView = useCallback(() => setPz({ scale: 1, tx: 0, ty: 0 }), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (locked) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 0.15 : -0.15);
  }, [locked, zoom]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx: pz.tx, ty: pz.ty };
  }, [locked, pz.tx, pz.ty]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPz(p => ({ ...p, tx: dragRef.current!.tx + dx, ty: dragRef.current!.ty + dy }));
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  // Keyboard pan/zoom
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") zoom(0.2);
      if (e.key === "-") zoom(-0.2);
      if (e.key === "ArrowLeft")  setPz(p => ({ ...p, tx: p.tx + 20 }));
      if (e.key === "ArrowRight") setPz(p => ({ ...p, tx: p.tx - 20 }));
      if (e.key === "ArrowUp")    setPz(p => ({ ...p, ty: p.ty + 20 }));
      if (e.key === "ArrowDown")  setPz(p => ({ ...p, ty: p.ty - 20 }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoom]);

  const transform = `translate(${pz.tx}px, ${pz.ty}px) scale(${pz.scale})`;

  return (
    <div
      className={`h-[560px] rounded-xl overflow-hidden ring-1 ring-white/10 transition-shadow duration-300 ${hlClass} relative select-none`}
      style={{ background: "#0b0f17", cursor: locked ? "default" : "grab" }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Top status strip */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-4 px-4 py-2 text-xs font-mono"
           style={{ background: "rgba(11,15,23,0.92)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ color: "#5cf2c0" }}>📡 {tracks.length} tracks</span>
        <span style={{ color: "#4facfe" }}>🛡 {INTERCEPTORS.length} interceptors</span>
        <span style={{ color: "#fcb045" }}>⚡ {assignments.length} assignments</span>
        <span style={{ color: "#7c869b" }}>TICK #{tickCount}</span>
        <span className="ml-auto font-bold" style={{ color: "#5cf2c0" }}>
          {clock} UTC · LIVE
        </span>
      </div>

      {/* Zoom/pan controls */}
      <div className="absolute top-12 right-3 z-20 flex flex-col gap-1">
        {[
          { label: "+", title: "Zoom in",     act: () => zoom(0.2) },
          { label: "−", title: "Zoom out",    act: () => zoom(-0.2) },
          { label: "⛶", title: "Fit to view", act: fitToView },
          { label: locked ? "🔒" : "🔓", title: locked ? "Unlock pan" : "Lock pan",
            act: () => setLocked(l => !l) },
        ].map(btn => (
          <button key={btn.label} title={btn.title} onClick={btn.act}
            className="w-8 h-8 rounded font-mono text-sm font-bold flex items-center justify-center"
            style={{ background: "rgba(92,242,192,0.12)", color: "#5cf2c0",
                     border: "1px solid rgba(92,242,192,0.3)" }}>
            {btn.label}
          </button>
        ))}
        <div className="text-[9px] text-center font-mono mt-1" style={{ color: "#7c869b" }}>
          ZOOM<br />{pz.scale.toFixed(1)}×
        </div>
      </div>

      {/* Threat badge */}
      {underThreat && (
        <div className="absolute top-12 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm animate-pulse"
             style={{ background: "rgba(255,92,92,0.2)", border: "1px solid rgba(255,92,92,0.6)", color: "#ff5c5c" }}>
          ⚠ THREAT IMMINENT · {threatCount} TRACK{threatCount > 1 ? "S" : ""} IN PERIMETER
        </div>
      )}

      {/* Legend strip */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex gap-4 px-4 py-1.5 text-[10px] font-mono"
           style={{ background: "rgba(11,15,23,0.92)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ color: "#5cf2c0" }}>● real</span>
        <span style={{ color: "#fcb045" }}>● simulated</span>
        <span style={{ color: "#4facfe" }}>▲ rf_jam</span>
        <span style={{ color: "#ff5c5c" }}>▲ kinetic</span>
        <span style={{ color: "#c084fc" }}>▲ spoof</span>
        <span style={{ color: "#ff5c5c" }}>⬡ protected asset</span>
        <span className="ml-auto" style={{ color: "#7c869b" }}>DRAG TO PAN · SCROLL TO ZOOM · +/− KEYS</span>
      </div>

      {/* SVG canvas with transform wrapper */}
      <div style={{ width: "100%", height: "100%", paddingTop: "36px", paddingBottom: "28px",
                    transform, transformOrigin: "center center", willChange: "transform" }}>
        <svg ref={svgRef} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`} width="100%" height="100%"
             style={{ display: "block" }}>
          <defs>
            <pattern id="dotgrid2" x="0" y="0" width="25" height="25" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.9" fill="rgba(255,255,255,0.05)" />
            </pattern>
            <style>{`
              @keyframes dash-anim2 { to { stroke-dashoffset: -24; } }
              @keyframes pulse-ring2 { 0%,100%{opacity:0.5;} 50%{opacity:1;} }
              @keyframes pulse-threat { 0%,100%{opacity:0.9;stroke-width:2;} 50%{opacity:1;stroke-width:3.5;} }
              .dash-line2 { stroke-dasharray:10 5; animation:dash-anim2 0.5s linear infinite; }
              .asset-ring-ok { animation:pulse-ring2 2.5s ease-in-out infinite; }
              .asset-ring-threat { animation:pulse-threat 0.7s ease-in-out infinite; }
            `}</style>
            {/* Compass tick marks */}
            <g id="compass-rose">
              {["N","E","S","W"].map((d,i) => {
                const a = i * 90 * Math.PI / 180;
                const r1 = 24, r2 = 16;
                return (
                  <g key={d}>
                    <line x1={Math.sin(a)*r1} y1={-Math.cos(a)*r1}
                          x2={Math.sin(a)*r2} y2={-Math.cos(a)*r2}
                          stroke="rgba(92,242,192,0.4)" strokeWidth="1.5"/>
                    <text x={Math.sin(a)*28} y={-Math.cos(a)*28+3.5}
                          textAnchor="middle" fill="rgba(92,242,192,0.55)"
                          fontSize="7" fontFamily="monospace" fontWeight="bold">{d}</text>
                  </g>
                );
              })}
              <circle r="3" fill="none" stroke="rgba(92,242,192,0.3)" strokeWidth="1"/>
              <circle r="10" fill="none" stroke="rgba(92,242,192,0.15)" strokeWidth="1" strokeDasharray="2 3"/>
            </g>
          </defs>

          {/* Dot grid */}
          <rect x="0" y="0" width={SVG_SIZE} height={SVG_SIZE} fill="url(#dotgrid2)" />

          {/* Grid lines */}
          {[100,200,300,400,500].map(v => (
            <g key={v}>
              <line x1={v} y1={0} x2={v} y2={SVG_SIZE} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
              <line x1={0} y1={v} x2={SVG_SIZE} y2={v} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </g>
          ))}

          {/* Range rings around asset */}
          {RANGE_RINGS.map(r => {
            const svgR = (r / W) * SVG_SIZE;
            return (
              <g key={r}>
                <circle cx={ax} cy={ay} r={svgR}
                        fill="none" stroke="rgba(252,176,69,0.12)" strokeWidth="1"
                        strokeDasharray="4 6"/>
                <text x={ax + svgR + 3} y={ay - 3} fill="rgba(252,176,69,0.35)"
                      fontSize="7" fontFamily="monospace">{r}m</text>
              </g>
            );
          })}

          {/* Compass rose (bottom-left corner) */}
          <g transform={`translate(38, ${SVG_SIZE - 38})`}>
            <use href="#compass-rose" />
            {/* Crosshair lines */}
            <line x1={-20} y1={0} x2={20} y2={0} stroke="rgba(92,242,192,0.2)" strokeWidth="0.8"/>
            <line x1={0} y1={-20} x2={0} y2={20} stroke="rgba(92,242,192,0.2)" strokeWidth="0.8"/>
          </g>

          {/* Asset — big red hexagon */}
          <AssetHex cx={ax} cy={ay} size={40} />
          {/* Pulsing perimeter ring */}
          <circle cx={ax} cy={ay} r={assetRadius + 5} fill="none"
                  stroke="#ff5c5c" strokeWidth="2"
                  className={underThreat ? "asset-ring-threat" : "asset-ring-ok"}
                  strokeOpacity="0.7" />
          <text x={ax} y={ay - 48} textAnchor="middle" fill="#ff5c5c" fontSize="11"
                fontFamily="monospace" fontWeight="bold"
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}>
            🏢 HYPERSCALER DC EAST · PROTECTED ASSET
          </text>

          {/* Interceptors — bigger triangles */}
          {INTERCEPTORS.map(int => {
            const [ix, iy] = toSvg(int.pos[0], int.pos[1]);
            const col = MODE_COLOR[int.kind] ?? "#aaa";
            return (
              <g key={int.id}>
                <InterceptorTriangle cx={ix} cy={iy} color={col} size={14} />
                <rect x={ix - 52} y={iy + 18} width={104} height={17} rx="3"
                      fill="rgba(11,15,23,0.75)" stroke={col} strokeWidth="0.6" strokeOpacity="0.5"/>
                <text x={ix} y={iy + 30} textAnchor="middle" fill={col}
                      fontSize="9" fontFamily="monospace" fontWeight="bold">
                  🛡 {int.id} · {int.kind} · {int.range}m range
                </text>
              </g>
            );
          })}

          {/* Assignment lines — thicker animated */}
          {assignments.map((a: any) => {
            const targetId = a.target_id ?? a.track_id;
            const intId    = a.interceptor_id;
            const track    = tracks.find((t: any) => t.id === targetId);
            const int_     = INTERCEPTORS.find(i => i.id === intId);
            if (!track || !int_) return null;
            const [tx2, ty2] = toSvg(track.pos_3d[0], track.pos_3d[1]);
            const [ix2, iy2] = toSvg(int_.pos[0], int_.pos[1]);
            const mx = (tx2 + ix2) / 2, my = (ty2 + iy2) / 2;
            const col = MODE_COLOR[a.mode ?? int_.kind] ?? "#fcb045";
            return (
              <g key={`asgn-${a.interceptor_id}-${targetId}`}>
                <line x1={ix2} y1={iy2} x2={tx2} y2={ty2}
                      stroke={col} strokeWidth="2.5" strokeOpacity="0.75"
                      className="dash-line2" />
                <rect x={mx - 22} y={my - 10} width={44} height={13} rx="2"
                      fill="rgba(11,15,23,0.8)" />
                <text x={mx} y={my} textAnchor="middle" fill={col}
                      fontSize="8.5" fontFamily="monospace" fontWeight="bold">
                  {a.mode ?? int_.kind}
                </text>
              </g>
            );
          })}

          {/* Tracks */}
          {tracks.map((t: any) => {
            const [tx2, ty2] = toSvg(t.pos_3d[0], t.pos_3d[1]);
            const isReal   = t.origin === "real";
            const col      = isReal ? "#5cf2c0" : "#fcb045";
            const isAssigned = assignedSet.has(t.id);
            const trail    = trailRef.current[t.id] ?? [];
            const conf     = Math.round((t.conf ?? t.confidence ?? 0) * 100);
            const dx = t.pos_3d[0] - ASSET.pos[0];
            const dy = t.pos_3d[1] - ASSET.pos[1];
            const dist = Math.round(Math.sqrt(dx * dx + dy * dy));

            // Velocity vector
            const vx = t.vel?.[0] ?? 0, vy = t.vel?.[1] ?? 0;
            const vScale = 3;
            const [vtx, vty] = toSvg(t.pos_3d[0] + vx * vScale, t.pos_3d[1] + vy * vScale);

            return (
              <g key={t.id}>
                {/* Trail */}
                {trail.slice(0, -1).map(([px, py]: [number, number], i: number) => {
                  const [spx, spy] = toSvg(px, py);
                  const alpha = (i + 1) / trail.length * 0.35;
                  return <circle key={i} cx={spx} cy={spy} r="2.5" fill={col} opacity={alpha} />;
                })}

                {/* Velocity vector */}
                {(vx !== 0 || vy !== 0) && (
                  <line x1={tx2} y1={ty2} x2={vtx} y2={vty}
                        stroke={col} strokeWidth="1.2" strokeOpacity="0.5" />
                )}

                {/* Assignment ring */}
                {isAssigned && (
                  <circle cx={tx2} cy={ty2} r={16} fill="none"
                          stroke="#fcb045" strokeWidth="2" strokeOpacity="0.85"
                          strokeDasharray="4 3" />
                )}

                {/* Drone icon — bigger */}
                <DroneIcon cx={tx2} cy={ty2} color={col} size={11} />

                {/* Label box */}
                <rect x={tx2 + 16} y={ty2 - 16} width={72} height={32} rx="3"
                      fill="rgba(11,15,23,0.78)" />
                <text x={tx2 + 20} y={ty2 - 5} fill={col}
                      fontSize="9.5" fontFamily="monospace" fontWeight="bold"
                      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.9))" }}>
                  {t.id.toUpperCase()} {conf}%
                </text>
                <text x={tx2 + 20} y={ty2 + 8} fill="#7c869b"
                      fontSize="8.5" fontFamily="monospace">
                  {dist}m to asset
                </text>
              </g>
            );
          })}

          {/* Empty state */}
          {tracks.length === 0 && (
            <text x={SVG_SIZE / 2} y={SVG_SIZE / 2 + 10} textAnchor="middle"
                  fill="#7c869b" fontSize="14" fontFamily="monospace">
              📡 Awaiting airspace tracks…
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

// --- Sub-shapes ---

function DroneIcon({ cx, cy, color, size = 11 }: { cx: number; cy: number; color: string; size?: number }) {
  const s = size;
  return (
    <g>
      <line x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx - s} cy={cy - s} r="3.5" fill={color} opacity="0.9" />
      <circle cx={cx + s} cy={cy - s} r="3.5" fill={color} opacity="0.9" />
      <circle cx={cx - s} cy={cy + s} r="3.5" fill={color} opacity="0.9" />
      <circle cx={cx + s} cy={cy + s} r="3.5" fill={color} opacity="0.9" />
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </g>
  );
}

function InterceptorTriangle({ cx, cy, color, size = 14 }: { cx: number; cy: number; color: string; size?: number }) {
  const s = size;
  const pts = `${cx},${cy - s} ${cx - s * 0.87},${cy + s * 0.5} ${cx + s * 0.87},${cy + s * 0.5}`;
  return <polygon points={pts} fill={color} fillOpacity="0.3" stroke={color} strokeWidth="2" />;
}

function AssetHex({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`;
  }).join(" ");
  return (
    <polygon points={pts}
             fill="#ff5c5c" fillOpacity="0.25"
             stroke="#ff5c5c" strokeWidth="2.5" />
  );
}
