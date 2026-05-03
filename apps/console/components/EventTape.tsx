"use client";
import { useMeshStore } from "@/lib/store";

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

export function EventTape() {
  const tape = useMeshStore((s) => s.tape);
  const hlClass = usePanelHighlight("tape");
  const reversed = [...tape].reverse();
  return (
    <div className={`rounded-xl bg-panelSolid ring-1 ring-white/10 p-3 max-h-[200px] overflow-y-auto transition-shadow duration-300 ${hlClass}`}>
      <div className="text-xs text-muted mb-2">EVENT TAPE</div>
      <div className="space-y-1 text-[12px] font-mono">
        {reversed.map((e: any, i) => (
          <div data-testid="event-row" key={`${e.ts}-${i}`} className="flex gap-2">
            <span className="text-muted w-14 shrink-0">{Number(e.ts).toFixed(2)}</span>
            <span className="text-accent w-16 shrink-0">{e.agent ?? "—"}</span>
            <span className="text-white/80">{e.kind}</span>
            <span className="text-muted truncate">
              {e.tool ? `· ${e.tool}` : ""} {e.output_summary ? `· ${e.output_summary}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
