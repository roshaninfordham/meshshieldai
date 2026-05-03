"use client";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/store";

// Static scenario data (matches packages/scenarios/data-center-swarm-attack.json)
// Interceptors are rendered at fixed clock positions (12, 3, 6, 9 o'clock) around the asset
// for visual clarity — actual scenario coords don't matter for the demo display.
const INTERCEPTOR_ANGLES = [0, 90, 180, 270]; // degrees from top (12, 3, 6, 9 o'clock)
const INTERCEPTOR_RADIUS = 120; // metres from asset — pushed out so labels never overlap asset

const INTERCEPTORS = [
  { id: "i-001", kind: "rf_jam",  range: 250, angleIdx: 0 },
  { id: "i-002", kind: "kinetic", range: 300, angleIdx: 1 },
  { id: "i-003", kind: "spoof",   range: 180, angleIdx: 2 },
  { id: "i-004", kind: "rf_jam",  range: 250, angleIdx: 3 },
] as const;

const ASSET = { name: "Hyperscaler DC East", pos: [0, 0] as [number, number], radius: 60 };
const RANGE_RINGS = [50, 100, 200]; // metres

const MODE_COLOR: Record<string, string> = {
  rf_jam:  "#4facfe",
  kinetic: "#ff5c5c",
  spoof:   "#c084fc",
};

const MODE_LABEL: Record<string, string> = {
  rf_jam:  "RF Jammer",
  kinetic: "Kinetic",
  spoof:   "Spoofer",
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

/** Compute interceptor SVG position from angle + radius */
function interceptorPos(angleIdx: number, assetX: number, assetY: number, radius: number): [number, number] {
  const angleDeg = INTERCEPTOR_ANGLES[angleIdx];
  const rad = (angleDeg - 90) * Math.PI / 180; // -90 so 0° = top
  return [
    assetX + Math.cos(rad) * radius,
    assetY + Math.sin(rad) * radius,
  ];
}

/** Label offset for interceptor based on angle: outside the asset */
function interceptorLabelAnchor(angleIdx: number): { anchor: "start" | "middle" | "end"; dx: number; dy: number } {
  const angle = INTERCEPTOR_ANGLES[angleIdx];
  if (angle === 0)   return { anchor: "middle", dx:  0, dy: -22 }; // top → label above
  if (angle === 90)  return { anchor: "start",  dx: 18, dy:   4 }; // right → label right
  if (angle === 180) return { anchor: "middle", dx:  0, dy:  30 }; // bottom → label below
  return               { anchor: "end",    dx: -18, dy:   4 }; // left → label left
}

// Welcome / help modal state lives outside component to avoid re-render loops
let _helpModalOpen = false;

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

  // Help modal
  const [helpOpen, setHelpOpen] = useState(false);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

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
  // Interceptor SVG radius (in SVG units)
  const intSvgRadius = (INTERCEPTOR_RADIUS / W) * SVG_SIZE;

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

  // Show tooltip on SVG element hover
  const showTooltip = useCallback((e: React.MouseEvent, text: string) => {
    setTooltip({ x: e.clientX, y: e.clientY, text });
  }, []);
  const moveTooltip = useCallback((e: React.MouseEvent) => {
    setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

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

      {/* ❓ Help button — top right (above zoom controls) */}
      <button
        onClick={() => setHelpOpen(true)}
        className="absolute top-12 right-14 z-20 w-8 h-8 rounded font-mono text-sm font-bold flex items-center justify-center"
        style={{ background: "rgba(252,176,69,0.15)", color: "#fcb045",
                 border: "1px solid rgba(252,176,69,0.4)" }}
        title="What am I looking at?"
      >
        ❓
      </button>

      {/* Threat badge */}
      {underThreat && (
        <div className="absolute top-12 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm animate-pulse"
             style={{ background: "rgba(255,92,92,0.2)", border: "1px solid rgba(255,92,92,0.6)", color: "#ff5c5c" }}>
          ⚠ THREAT IMMINENT · {threatCount} TRACK{threatCount > 1 ? "S" : ""} IN PERIMETER
        </div>
      )}

      {/* Always-visible legend panel — top left */}
      <div className="absolute z-20 text-[10px] font-mono leading-relaxed"
           style={{
             top: "44px", left: "8px",
             background: "rgba(11,15,23,0.88)",
             border: "1px solid rgba(255,255,255,0.1)",
             borderRadius: "8px",
             padding: "8px 10px",
             color: "#c0cad9",
             minWidth: "190px",
             pointerEvents: "none",
           }}>
        <div className="font-bold mb-1" style={{ color: "#5cf2c0" }}>🛡 LEGEND</div>
        <div><span style={{ color: "#5cf2c0" }}>●</span> Real drone (sensor detection)</div>
        <div><span style={{ color: "#fcb045" }}>●</span> Simulated drone (drill data)</div>
        <div><span style={{ color: "#4facfe" }}>▲</span> RF jammer interceptor</div>
        <div><span style={{ color: "#ff5c5c" }}>▲</span> Kinetic interceptor</div>
        <div><span style={{ color: "#c084fc" }}>▲</span> Spoof interceptor</div>
        <div><span style={{ color: "#ff5c5c" }}>⬢</span> Protected asset (data center)</div>
        <div><span style={{ color: "#fcb045" }}>- -</span> Active assignment</div>
        <div><span style={{ color: "#fcb045" }}>◯</span> Drone being engaged</div>
      </div>

      {/* Help footer (bottom-RIGHT, away from legend) */}
      <div className="absolute bottom-0 right-0 z-20 px-4 py-1.5 text-[9px] font-mono"
           style={{ background: "rgba(11,15,23,0.85)", borderTop: "1px solid rgba(255,255,255,0.05)",
                    borderLeft: "1px solid rgba(255,255,255,0.05)", borderTopLeftRadius: "6px",
                    color: "#7c869b" }}>
        DRAG TO PAN · SCROLL TO ZOOM · +/− KEYS
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
              .svg-label { text-shadow: 0 1px 3px #000, 0 0 6px #000; }
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
            <line x1={-20} y1={0} x2={20} y2={0} stroke="rgba(92,242,192,0.2)" strokeWidth="0.8"/>
            <line x1={0} y1={-20} x2={0} y2={20} stroke="rgba(92,242,192,0.2)" strokeWidth="0.8"/>
          </g>

          {/* Asset — big red hexagon */}
          <g
            style={{ cursor: "pointer" }}
            onMouseEnter={e => showTooltip(e, "🔴 Protected Asset: Hyperscaler DC East\nThis data center is the mission objective — keep all drones out of the perimeter.")}
            onMouseMove={moveTooltip}
            onMouseLeave={hideTooltip}
          >
            <title>Protected Asset: Hyperscaler DC East — data center perimeter</title>
            <AssetHex cx={ax} cy={ay} size={40} />
          </g>
          {/* Pulsing perimeter ring */}
          <circle cx={ax} cy={ay} r={assetRadius + 5} fill="none"
                  stroke="#ff5c5c" strokeWidth="2"
                  className={underThreat ? "asset-ring-threat" : "asset-ring-ok"}
                  strokeOpacity="0.7" />
          <text x={ax} y={ay - 48} textAnchor="middle" fill="#ff5c5c" fontSize="11"
                fontFamily="monospace" fontWeight="bold"
                className="svg-label"
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}>
            🏢 HYPERSCALER DC EAST · PROTECTED ASSET
          </text>

          {/* Interceptors — distributed at clock positions around asset */}
          {INTERCEPTORS.map(int => {
            const [ix, iy] = interceptorPos(int.angleIdx, ax, ay, intSvgRadius);
            const col = MODE_COLOR[int.kind] ?? "#aaa";
            const lbl = interceptorLabelAnchor(int.angleIdx);
            const tooltipText = `🛡 Interceptor ${int.id} — ${MODE_LABEL[int.kind] ?? int.kind}\nRange: ${int.range}m · Stationed at ${["12 o'clock","3 o'clock","6 o'clock","9 o'clock"][int.angleIdx]} position`;

            return (
              <g key={int.id}
                 style={{ cursor: "pointer" }}
                 onMouseEnter={e => showTooltip(e, tooltipText)}
                 onMouseMove={moveTooltip}
                 onMouseLeave={hideTooltip}>
                <title>{tooltipText}</title>
                {/* Subtle line from interceptor to asset center */}
                <line x1={ix} y1={iy} x2={ax} y2={ay}
                      stroke={col} strokeWidth="0.8" strokeOpacity="0.15" strokeDasharray="4 6" />
                <InterceptorTriangle cx={ix} cy={iy} color={col} size={14} />
                {/* Label outside asset — angle-positioned so no overlap */}
                <rect x={ix + lbl.dx - (lbl.anchor === "middle" ? 56 : lbl.anchor === "start" ? 2 : 112)} y={iy + lbl.dy - 14} width={110} height={26} rx="3"
                      fill="rgba(11,15,23,0.82)" stroke={col} strokeWidth="0.6" strokeOpacity="0.5"/>
                <text x={ix + lbl.dx} y={iy + lbl.dy} textAnchor={lbl.anchor} fill={col}
                      fontSize="9" fontFamily="monospace" fontWeight="bold"
                      className="svg-label">
                  🛡 {int.id}
                </text>
                <text x={ix + lbl.dx} y={iy + lbl.dy + 11} textAnchor={lbl.anchor} fill={col}
                      fontSize="8" fontFamily="monospace" opacity="0.8"
                      className="svg-label">
                  {MODE_LABEL[int.kind]} · {int.range}m
                </text>
              </g>
            );
          })}

          {/* Assignment lines — thicker animated dashed */}
          {assignments.map((a: any) => {
            const targetId = a.target_id ?? a.track_id;
            const intId    = a.interceptor_id;
            const track    = tracks.find((t: any) => t.id === targetId);
            const int_     = INTERCEPTORS.find(i => i.id === intId);
            if (!track || !int_) return null;
            const [tx2, ty2] = toSvg(track.pos_3d[0], track.pos_3d[1]);
            const [ix2, iy2] = interceptorPos(int_.angleIdx, ax, ay, intSvgRadius);
            const mx = (tx2 + ix2) / 2, my = (ty2 + iy2) / 2;
            const col = MODE_COLOR[a.mode ?? int_.kind] ?? "#fcb045";
            return (
              <g key={`asgn-${a.interceptor_id}-${targetId}`}>
                <line x1={ix2} y1={iy2} x2={tx2} y2={ty2}
                      stroke={col} strokeWidth="2.5" strokeOpacity="0.75"
                      className="dash-line2" />
                <rect x={mx - 28} y={my - 10} width={56} height={14} rx="2"
                      fill="rgba(11,15,23,0.85)" />
                <text x={mx} y={my} textAnchor="middle" fill={col}
                      fontSize="8.5" fontFamily="monospace" fontWeight="bold"
                      className="svg-label">
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
            const speed = t.vel ? Math.round(Math.sqrt(t.vel[0]**2 + t.vel[1]**2) * 10) / 10 : 0;

            // Velocity vector
            const vx = t.vel?.[0] ?? 0, vy = t.vel?.[1] ?? 0;
            const vScale = 3;
            const [vtx, vty] = toSvg(t.pos_3d[0] + vx * vScale, t.pos_3d[1] + vy * vScale);

            // Label placement: close to asset → label above with stem; far → label to right
            const closeToAsset = dist < 80;
            const labelX = closeToAsset ? tx2 : tx2 + 16;
            const labelY = closeToAsset ? ty2 - 30 : ty2 - 5;
            const labelAnchor = closeToAsset ? "middle" : "start";

            const tooltipText = `${isReal ? "🟢 Real drone" : "🟡 Simulated drone"}: Track ${t.id.toUpperCase()}\n${conf}% confidence · ${dist}m from asset · ${speed > 0 ? `closing at ${speed} m/s` : "stationary"}${isAssigned ? "\n⚡ Actively engaged by interceptor" : ""}`;

            return (
              <g key={t.id}
                 style={{ cursor: "pointer" }}
                 onMouseEnter={e => showTooltip(e, tooltipText)}
                 onMouseMove={moveTooltip}
                 onMouseLeave={hideTooltip}>
                <title>{tooltipText}</title>

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

                {/* Assignment engagement ring */}
                {isAssigned && (
                  <circle cx={tx2} cy={ty2} r={16} fill="none"
                          stroke="#fcb045" strokeWidth="2" strokeOpacity="0.85"
                          strokeDasharray="4 3" />
                )}

                {/* Drone icon */}
                <DroneIcon cx={tx2} cy={ty2} color={col} size={11} />

                {/* Stem line when label is above (close to asset) */}
                {closeToAsset && (
                  <line x1={tx2} y1={ty2 - 14} x2={tx2} y2={ty2 - 24}
                        stroke={col} strokeWidth="1" strokeOpacity="0.5" />
                )}

                {/* Label box */}
                <rect x={closeToAsset ? tx2 - 40 : tx2 + 14} y={labelY - 12} width={78} height={28} rx="3"
                      fill="rgba(11,15,23,0.82)" />
                <text x={labelX} y={labelY} textAnchor={labelAnchor} fill={col}
                      fontSize="9.5" fontFamily="monospace" fontWeight="bold"
                      className="svg-label">
                  {t.id.toUpperCase()} {conf}%
                </text>
                <text x={labelX} y={labelY + 12} textAnchor={labelAnchor} fill="#7c869b"
                      fontSize="8.5" fontFamily="monospace"
                      className="svg-label">
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

      {/* Floating cursor tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed z-[999] pointer-events-none text-[11px] font-mono leading-snug whitespace-pre-line"
            style={{
              left: tooltip.x + 14,
              top: tooltip.y - 8,
              background: "rgba(13,19,32,0.96)",
              border: "1px solid rgba(92,242,192,0.3)",
              borderRadius: "6px",
              padding: "6px 10px",
              color: "#c0cad9",
              maxWidth: "260px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          >
            {tooltip.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help modal */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            onClick={() => setHelpOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="rounded-xl text-sm font-mono leading-relaxed"
              style={{
                background: "#0d1320",
                border: "1px solid rgba(92,242,192,0.25)",
                padding: "24px 28px",
                maxWidth: "480px",
                width: "90%",
                color: "#c0cad9",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-base font-bold mb-4" style={{ color: "#5cf2c0" }}>❓ What am I looking at?</div>
              <div className="flex flex-col gap-2 text-[12px]">
                <div><span style={{ color: "#5cf2c0" }}>● Green X-icon</span> — Real drone detected by a live sensor. The confidence % shows how sure the system is.</div>
                <div><span style={{ color: "#fcb045" }}>● Yellow X-icon</span> — Simulated/drill drone from scenario data (not a real threat in this demo).</div>
                <div><span style={{ color: "#4facfe" }}>▲ Blue triangle</span> — RF Jammer interceptor. Disrupts drone communications &amp; navigation.</div>
                <div><span style={{ color: "#ff5c5c" }}>▲ Red triangle</span> — Kinetic interceptor. Physical intercept (net, projectile).</div>
                <div><span style={{ color: "#c084fc" }}>▲ Purple triangle</span> — GPS Spoofer interceptor. Sends false GPS signals to mislead the drone.</div>
                <div><span style={{ color: "#ff5c5c" }}>⬢ Red hexagon</span> — The protected asset (data center). If drones enter this perimeter, threat is imminent.</div>
                <div><span style={{ color: "#fcb045" }}>- - - dashed line</span> — Active assignment: this interceptor is engaging this drone right now.</div>
                <div><span style={{ color: "#fcb045" }}>◯ Yellow ring</span> — The drone inside this ring is currently being engaged.</div>
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", color: "#7c869b" }}>
                  Range rings (50m, 100m, 200m) show the asset&apos;s defensive perimeters. The compass shows orientation.
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="mt-5 w-full py-2 rounded font-bold text-sm"
                style={{ background: "rgba(92,242,192,0.12)", color: "#5cf2c0",
                         border: "1px solid rgba(92,242,192,0.3)" }}
              >
                Got it ✓
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
