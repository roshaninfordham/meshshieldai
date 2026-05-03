"use client";
import { useMemo } from "react";
import { useMeshStore } from "@/lib/store";

export function Header({ scenario }: { scenario: string }) {
  const tape = useMeshStore((s) => s.tape);
  const tickCount = useMemo(() => tape.filter((e: any) => e.kind === "plan_ready").length, [tape]);
  const demoActive = useMeshStore((s) => s.demo.active);

  return (
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
        <div className="text-[10px] font-mono" style={{ color: "#5cf2c0", opacity: 0.7 }}>
          Software-defined counter-swarm defense
        </div>
      </div>

      {/* Center: Live state pill */}
      <div className="flex items-center gap-2">
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
      </div>

      {/* Right: Framework chips */}
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-md px-2 py-1 font-mono font-bold"
              style={{ background: "rgba(92,242,192,0.12)", color: "#5cf2c0" }}>
          ⚡ Powered by AG2
        </span>
        <span className="rounded-md px-2 py-1 font-mono"
              style={{ background: "rgba(255,255,255,0.05)", color: "#7c869b" }}>
          via OpenRouter · Gemini 2.5
        </span>
      </div>
    </header>
  );
}
