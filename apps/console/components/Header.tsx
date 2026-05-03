"use client";
import { useMemo } from "react";
import { useMeshStore } from "@/lib/store";

function getDefconLevel(tape: any[]): { level: number; color: string; label: string } {
  const now = Date.now() / 1000;
  const recent = tape.slice(-60);
  const hasActiveEscalation = recent.some((e: any) => e.kind === "escalation_raised");
  const recentEscalation = tape.some((e: any) => e.kind === "escalation_raised" && (now - (e.ts ?? 0)) < 30);

  if (hasActiveEscalation) {
    return { level: 2, color: "#ff5c5c", label: "DEFCON 2 · CRITICAL" };
  }
  if (recentEscalation) {
    return { level: 3, color: "#fcb045", label: "DEFCON 3 · ELEVATED" };
  }
  return { level: 5, color: "#5cf2c0", label: "DEFCON 5 · NORMAL" };
}

export function Header({ scenario }: { scenario: string }) {
  const tape = useMeshStore((s) => s.tape);
  const tickCount = useMemo(() => tape.filter((e: any) => e.kind === "plan_ready").length, [tape]);
  const demoActive = useMeshStore((s) => s.demo.active);
  const defcon = useMemo(() => getDefconLevel(tape), [tape]);

  return (
    <div>
      {/* Classification banner */}
      <div className="text-center py-1 text-[11px] font-mono font-bold tracking-widest"
           style={{ background: "rgba(252,176,69,0.08)", color: "#fcb045",
                    borderBottom: "1px solid rgba(252,176,69,0.2)" }}>
        CLASSIFICATION: UNCLASSIFIED // FOR DEMO ONLY // NOT FOR OPERATIONAL USE
      </div>

      <header className="flex items-center justify-between px-6 py-3 relative"
              style={{
                background: "#0f1420",
                borderBottom: "1px solid transparent",
                backgroundClip: "padding-box",
              }}>
        {/* Gradient bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
             style={{ background: "linear-gradient(90deg, transparent, #5cf2c080, #4facfe80, transparent)" }} />

        {/* Left: Brand */}
        <div className="flex flex-col gap-0">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-white">🛡 MeshShield AI</span>
            <span className="text-xs font-mono" style={{ color: "#7c869b" }}>
              ▸ {scenario}
            </span>
          </div>
          <div className="text-[11px] font-mono" style={{ color: "#5cf2c0", opacity: 0.8 }}>
            Software-defined counter-swarm defense
          </div>
        </div>

        {/* Center: Live pill + DEFCON */}
        <div className="flex items-center gap-3">
          {demoActive || tickCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold"
                 style={{
                   background: "rgba(92,242,192,0.12)",
                   border: "1px solid rgba(92,242,192,0.35)",
                   color: "#5cf2c0",
                 }}>
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              LIVE — pipeline tick #{tickCount}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono"
                 style={{
                   background: "rgba(124,134,155,0.1)",
                   border: "1px solid rgba(124,134,155,0.2)",
                   color: "#7c869b",
                 }}>
              ⏸ idle
            </div>
          )}

          {/* DEFCON pill */}
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold"
               style={{
                 background: `${defcon.color}18`,
                 border: `1px solid ${defcon.color}55`,
                 color: defcon.color,
               }}>
            🚨 {defcon.label}
          </div>
        </div>

        {/* Right: Chips + operator badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md px-2 py-1 font-mono font-bold"
                style={{ background: "rgba(92,242,192,0.12)", color: "#5cf2c0" }}>
            ⚡ Powered by AG2
          </span>
          <span className="rounded-md px-2 py-1 font-mono"
                style={{ background: "rgba(255,255,255,0.05)", color: "#7c869b" }}>
            via OpenRouter · Gemini 2.5
          </span>
          <span className="rounded-md px-2 py-1 font-mono font-bold"
                style={{ background: "rgba(79,172,254,0.12)", color: "#4facfe",
                         border: "1px solid rgba(79,172,254,0.25)" }}>
            📡 OPERATOR: Demo · ROLE: Commander
          </span>
        </div>
      </header>
    </div>
  );
}
