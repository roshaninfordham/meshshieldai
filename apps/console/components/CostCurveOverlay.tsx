"use client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useMeshStore } from "@/lib/store";
import { useMemo } from "react";

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

export function CostCurveOverlay() {
  const tracks = useMeshStore((s) => s.tracks);
  const hlClass = usePanelHighlight("cost");
  const data = useMemo(() => {
    const swarm = tracks.length;
    return Array.from({ length: 12 }).map((_, i) => ({
      n: i * Math.max(1, Math.ceil(swarm / 12)),
      attacker_usd: i * Math.max(1, Math.ceil(swarm / 12)) * 500,
      defender_usd: 50000 + Math.min(i, 3) * 5000,
    }));
  }, [tracks.length]);
  return (
    <div className={`rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 h-[200px] transition-shadow duration-300 ${hlClass}`}>
      <div className="text-xs text-muted mb-1">COST-CURVE · attacker scales linearly, defender stays flat</div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <XAxis dataKey="n" stroke="#7c869b" fontSize={10} />
          <YAxis stroke="#7c869b" fontSize={10} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="attacker_usd" stroke="#fcb045" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="defender_usd" stroke="#5cf2c0" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
