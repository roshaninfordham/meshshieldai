"use client";
import { useState, useCallback } from "react";

const AGENT_BASE = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? "http://localhost:8002";
const FUSION_BASE = process.env.NEXT_PUBLIC_FUSION_BASE_URL ?? "http://localhost:8001";

function post(url: string, body?: object) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block ml-1 cursor-help">
      <span className="text-[10px] rounded-full px-1 font-mono"
            style={{ background: "rgba(124,134,155,0.2)", color: "#7c869b" }}>?</span>
      <span className="absolute left-4 top-0 z-50 hidden group-hover:flex w-56 p-2 rounded text-[11px] font-mono leading-tight"
            style={{ background: "#1a2035", border: "1px solid rgba(92,242,192,0.2)", color: "#c0cad9" }}>
        {text}
      </span>
    </span>
  );
}

function StatusPill({ ok }: { ok: boolean | null }) {
  if (ok === null) return null;
  return (
    <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${ok ? "text-accent" : "text-danger"}`}
          style={{ background: ok ? "rgba(92,242,192,0.12)" : "rgba(255,92,92,0.12)" }}>
      {ok ? "✓ OK" : "✗ ERR"}
    </span>
  );
}

/** A labeled slider with prominent value display. */
function SliderRow({
  icon,
  label,
  subtitle,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  accentClass = "accent-accent",
}: {
  icon: string;
  label: string;
  subtitle: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  accentClass?: string;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-baseline gap-1 mb-0.5">
        <span className="text-[10px] font-bold font-mono" style={{ color: "#c0cad9" }}>
          {icon} {label}
        </span>
        <span className="text-[9px] font-mono ml-1" style={{ color: "#7c869b" }}>{subtitle}</span>
        <span className="ml-auto text-[15px] font-bold font-mono tabular-nums" style={{ color: "#5cf2c0", minWidth: "40px", textAlign: "right" }}>
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className={`w-full h-1.5 rounded ${accentClass}`}
        style={{ cursor: "pointer" }}
      />
    </div>
  );
}

export function MissionControl() {
  const [tickS, setTickS]     = useState(2.0);
  const [minConf, setMinConf] = useState(0.70);
  const [maxTrack, setMaxTrack] = useState(10);
  const [paused, setPaused]   = useState(false);
  const [status, setStatus]   = useState<Record<string, boolean | null>>({});
  const [busy, setBusy]       = useState<Record<string, boolean>>({});

  const act = useCallback(async (key: string, url: string, body?: object) => {
    setBusy(b => ({ ...b, [key]: true }));
    try {
      const r = await post(url, body);
      setStatus(s => ({ ...s, [key]: r.ok }));
    } catch {
      setStatus(s => ({ ...s, [key]: false }));
    } finally {
      setBusy(b => ({ ...b, [key]: false }));
    }
  }, []);

  const handlePause = () => {
    setPaused(true);
    act("pause", `${AGENT_BASE}/pipeline/pause`);
  };
  const handleResume = () => {
    setPaused(false);
    act("resume", `${AGENT_BASE}/pipeline/resume`);
  };
  const handleTick = () => act("tick", `${AGENT_BASE}/pipeline/tick`);
  const handleInterval = (v: number) => {
    setTickS(v);
    act("interval", `${AGENT_BASE}/pipeline/interval`, { seconds: v });
  };
  const handlePolicy = (conf: number, tracks: number) => {
    act("policy", `${AGENT_BASE}/policy`, { auto_action_min_conf: conf, escalate_if_tracks_per_asset_gt: tracks });
  };
  const handleReset = async () => {
    await post(`${FUSION_BASE}/scenario/reset`);
    await post(`${AGENT_BASE}/demo/reset`);
    setStatus(s => ({ ...s, reset: true }));
  };
  const handleSpawnWave = () => act("wave", `${FUSION_BASE}/scenario/inject`, { count: 4, ring_radius_m: 280 });
  const handleKillSwitch = () => act("kill", `${AGENT_BASE}/plan/clear`);

  const Btn = ({
    id, label, onClick, danger = false, disabled = false
  }: { id: string; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled || busy[id]}
      className="rounded px-3 py-1.5 text-xs font-mono font-bold transition-all disabled:opacity-50"
      style={{
        background: danger
          ? "rgba(255,92,92,0.15)"
          : "rgba(92,242,192,0.12)",
        color: danger ? "#ff5c5c" : "#5cf2c0",
        border: `1px solid ${danger ? "rgba(255,92,92,0.4)" : "rgba(92,242,192,0.3)"}`,
      }}
    >
      {busy[id] ? "…" : label}
      <StatusPill ok={status[id] ?? null} />
    </button>
  );

  const SectionDivider = ({ icon, label }: { icon: string; label: string }) => (
    <div className="text-[10px] mb-2 font-bold tracking-widest flex items-center gap-1" style={{ color: "#7c869b" }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="rounded-xl ring-1 ring-white/10 px-4 py-3"
         style={{ background: "#0d1320", borderBottom: "1px solid rgba(92,242,192,0.12)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold font-mono" style={{ color: "#5cf2c0" }}>🎛 MISSION CONTROL</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{ background: "rgba(92,242,192,0.08)", color: "#7c869b" }}>
          OPERATOR: Demo · ROLE: Commander
        </span>
      </div>

      <div className="grid grid-cols-12 gap-x-6 gap-y-3 text-xs font-mono">

        {/* PIPELINE CONTROL */}
        <div className="col-span-12 md:col-span-3">
          <SectionDivider icon="⚡" label="PIPELINE" />
          <div className="flex flex-wrap gap-2 items-center">
            <Btn id="resume" label={paused ? "▶ AUTO" : "▶ RUNNING"} onClick={handleResume} disabled={!paused} />
            <Btn id="pause"  label="⏸ PAUSE" onClick={handlePause} disabled={paused} />
            <Btn id="tick"   label="⏭ MANUAL TICK" onClick={handleTick} />
          </div>
          <SliderRow
            icon="⏱"
            label="PIPELINE CADENCE"
            subtitle="how often the agents re-evaluate"
            value={tickS}
            displayValue={`${tickS.toFixed(1)}s`}
            min={0.5}
            max={10}
            step={0.5}
            onChange={handleInterval}
            accentClass="accent-accent"
          />
        </div>

        {/* POLICY GATES */}
        <div className="col-span-12 md:col-span-3">
          <SectionDivider icon="⚖️" label="POLICY GATES" />
          <SliderRow
            icon="🎯"
            label="AUTO-FIRE CONFIDENCE FLOOR"
            subtitle="below this, escalate to a human"
            value={minConf}
            displayValue={`${Math.round(minConf * 100)}%`}
            min={0.5}
            max={0.95}
            step={0.05}
            onChange={v => {
              setMinConf(v);
              handlePolicy(v, maxTrack);
            }}
            accentClass="accent-warn"
          />
          <SliderRow
            icon="🚨"
            label="ESCALATION TRIGGER · TRACKS NEAR ASSET"
            subtitle="if more than this many converge, escalate"
            value={maxTrack}
            displayValue={`${maxTrack}`}
            min={5}
            max={25}
            step={1}
            onChange={v => {
              setMaxTrack(v);
              handlePolicy(minConf, v);
            }}
            accentClass="accent-warn"
          />
          <StatusPill ok={status["policy"] ?? null} />
        </div>

        {/* SCENARIO */}
        <div className="col-span-12 md:col-span-3">
          <SectionDivider icon="🗺" label="SCENARIO" />
          <div className="flex flex-wrap gap-2">
            <Btn id="reset" label="↻ RESET" onClick={handleReset} />
            <Btn id="wave"  label="⚡ SPAWN ATTACK WAVE" onClick={handleSpawnWave} danger />
          </div>
          <div className="mt-2 text-[9px]" style={{ color: "#7c869b" }}>
            RESET wipes all tracks &amp; replays from time 0
          </div>
        </div>

        {/* KILL SWITCH */}
        <div className="col-span-12 md:col-span-3">
          <SectionDivider icon="🛑" label="OPERATOR OVERRIDE" />
          <Btn id="kill" label="🛑 KILL SWITCH" onClick={handleKillSwitch} danger />
          <div className="mt-1.5 text-[9px]" style={{ color: "#7c869b" }}>
            Clears all auto-actions instantly
            <Tooltip text="KILL SWITCH immediately clears all automated assignments and sets a no-op plan. Use in emergencies to halt automated actions." />
          </div>
        </div>
      </div>
    </div>
  );
}
