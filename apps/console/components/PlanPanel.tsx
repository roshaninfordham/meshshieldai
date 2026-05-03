"use client";
import { useState } from "react";
import { useMeshStore } from "@/lib/store";

function usePanelHighlight(target: string): string {
  const highlight = useMeshStore((s) => s.demo.highlight);
  return highlight === target
    ? "ring-2 ring-accent shadow-[0_0_24px_rgba(92,242,192,0.45)] demo-highlight-pulse"
    : "";
}

const arr = (x: unknown): string[] => Array.isArray(x) ? x.map(String) : [];

// Plain-English mode labels and their explanations
const MODE_PLAIN: Record<string, { label: string; explanation: string }> = {
  rf_jam:  { label: "Radio jam",        explanation: "Disrupts the drone's radio control link — it loses contact with its operator and returns home or descends safely." },
  spoof:   { label: "GPS spoof",        explanation: "Sends false GPS signals to redirect the drone away from the asset to a safe landing zone." },
  kinetic: { label: "Kinetic intercept", explanation: "Physically intercepts the drone — net launcher, projectile, or interceptor drone." },
  monitor: { label: "Track only",       explanation: "Continue tracking this drone. No action yet — gathering more data before committing to a countermeasure." },
};

/** Translate a raw mode string to a plain-English label. Falls back to the raw string. */
function modeLabel(raw: string): string {
  return MODE_PLAIN[raw]?.label ?? raw;
}

/** Translate a raw mode string to its explanation tooltip text. */
function modeExplanation(raw: string): string {
  return MODE_PLAIN[raw]?.explanation ?? raw;
}

/** Translate a raw drone/track ID to a human-readable name. */
function droneLabel(id: string): { name: string; raw: string } {
  const m = id?.match(/\d+/);
  const num = m ? parseInt(m[0], 10) : null;
  return { name: num !== null ? `Drone #${num}` : id, raw: id?.toUpperCase?.() ?? id };
}

/** Translate a raw interceptor ID to a human-readable name. */
function interceptorLabel(id: string): string {
  const m = id?.match(/\d+/);
  const num = m ? parseInt(m[0], 10) : null;
  return num !== null ? `Interceptor #${num}` : id;
}

/** Translate raw justification refs into plain-English grouped sentences. */
function translateJustification(
  snapshotRefs: string[],
  tavilyRefs: string[],
  policyRefs: string[],
): Array<{ icon: string; label: string; items: string[] }> {
  const groups: Array<{ icon: string; label: string; items: string[] }> = [];

  if (snapshotRefs.length > 0) {
    const items = snapshotRefs.map(ref => {
      // tracks[0].conf → "Drone confidence is ..."
      const confMatch = ref.match(/tracks\[(\d+)\]\.conf(?:idence)?/i);
      if (confMatch) return `Drone #${parseInt(confMatch[1], 10) + 1} confidence score`;
      const posMatch = ref.match(/tracks\[(\d+)\]\.pos/i);
      if (posMatch) return `Drone #${parseInt(posMatch[1], 10) + 1} position data`;
      const velMatch = ref.match(/tracks\[(\d+)\]\.vel/i);
      if (velMatch) return `Drone #${parseInt(velMatch[1], 10) + 1} velocity vector`;
      const headlineMatch = ref.match(/headline:(.*)/i);
      if (headlineMatch) return `Headline: "${headlineMatch[1].trim()}"`;
      return ref;
    });
    groups.push({ icon: "📡", label: "Sensor data", items });
  }

  if (tavilyRefs.length > 0) {
    const items = tavilyRefs.map(ref => {
      const headlineMatch = ref.match(/headline:(.*)/i);
      if (headlineMatch) return `"${headlineMatch[1].trim()}"`;
      return ref;
    });
    groups.push({ icon: "📰", label: "News", items });
  }

  if (policyRefs.length > 0) {
    const items = policyRefs.map(ref => {
      const clauseMatch = ref.match(/clause:(.*)/i);
      if (clauseMatch) {
        const clause = clauseMatch[1].replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        return `Policy clause: "${clause}"`;
      }
      return ref;
    });
    groups.push({ icon: "⚖", label: "Policy", items });
  }

  return groups;
}

/** Inline tooltip-capable mode badge */
function ModeBadge({ mode }: { mode: string }) {
  const [open, setOpen] = useState(false);
  const label = modeLabel(mode);
  const explanation = modeExplanation(mode);

  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono" style={{ color: "#5cf2c0" }}>{label}</span>
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full text-[9px] font-bold w-4 h-4 flex-shrink-0 relative"
        style={{
          background: "rgba(92,242,192,0.12)",
          color: "#7c869b",
          border: "1px solid rgba(255,255,255,0.12)",
          cursor: "help",
          verticalAlign: "middle",
        }}
        aria-label={`Explain mode: ${label}`}
      >
        ?
        {open && (
          <span
            className="absolute z-50 left-5 top-0 text-left rounded-lg text-[10px] font-mono leading-snug"
            style={{
              background: "rgba(13,19,32,0.98)",
              border: "1px solid rgba(92,242,192,0.25)",
              padding: "6px 10px",
              width: "220px",
              color: "#c0cad9",
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              pointerEvents: "none",
            }}
          >
            <strong style={{ color: "#5cf2c0" }}>{label}</strong>
            <br />
            {explanation}
          </span>
        )}
      </button>
    </span>
  );
}

export function PlanPanel() {
  const plan = useMeshStore((s) => s.plan) as any;
  const hlClass = usePanelHighlight("plan");
  if (!plan) return (
    <div className={`rounded-xl bg-panelSolid ring-1 ring-white/10 p-4 text-muted text-sm transition-shadow duration-300 ${hlClass}`}>
      No plan yet — waiting for first agent cycle…
    </div>
  );
  const assignments = Array.isArray(plan.assignments) ? plan.assignments : [];
  return (
    <div className={`rounded-xl bg-panelSolid ring-1 ring-white/10 p-4 transition-shadow duration-300 ${hlClass}`}>
      {/* Header */}
      <div className="flex justify-between items-baseline mb-1">
        <div>
          <div className="text-xs font-bold" style={{ color: "#5cf2c0" }}>Response Plan</div>
          <div className="text-[10px] font-mono mt-0.5" style={{ color: "#7c869b" }}>
            Auto-generated · what each interceptor will do · {plan.plan_id}
          </div>
        </div>
        {plan.escalation?.required && (
          <div className="text-danger text-xs font-bold">⚠ HUMAN APPROVAL NEEDED</div>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-muted text-xs italic mt-2">No assignments in this plan.</div>
      ) : (
        <table className="w-full text-sm mt-2">
          <thead className="text-muted text-xs">
            <tr>
              <th className="text-left pb-1">Target drone</th>
              <th className="text-left pb-1">Interceptor</th>
              <th className="text-left pb-1">Action</th>
              <th className="pb-1">Pri</th>
              <th className="text-left pb-1">Why</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a: any, i: number) => {
              const j = a?.justification ?? {};
              const snapshotRefs = arr(j.snapshot_refs);
              const tavilyRefs   = arr(j.tavily_refs);
              const policyRefs   = arr(j.policy_refs);
              const groups = translateJustification(snapshotRefs, tavilyRefs, policyRefs);
              const { name: droneName, raw: droneRaw } = droneLabel(a?.target_id ?? "—");
              const intName = interceptorLabel(a?.interceptor_id ?? "—");

              return (
                <tr key={i} className="border-t border-white/5 align-top">
                  {/* Target */}
                  <td className="py-1.5 pr-1">
                    <span className="font-mono font-bold text-white text-xs">{droneName}</span>
                    <br />
                    <span className="font-mono text-[9px]" style={{ color: "#7c869b" }}>{droneRaw}</span>
                  </td>
                  {/* Interceptor */}
                  <td className="pr-1">
                    <span className="font-mono text-xs text-white">{intName}</span>
                    <br />
                    <span className="font-mono text-[9px]" style={{ color: "#7c869b" }}>{(a?.interceptor_id ?? "").toUpperCase()}</span>
                  </td>
                  {/* Mode */}
                  <td className="pr-1 text-xs">
                    <ModeBadge mode={a?.mode ?? "monitor"} />
                  </td>
                  {/* Priority */}
                  <td className="text-center text-xs" style={{ color: "#fcb045" }}>{a?.priority ?? "—"}</td>
                  {/* Justification */}
                  <td className="text-[10px] leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>
                    {groups.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {groups.map((g, gi) => (
                          <div key={gi}>
                            <span style={{ color: "#7c869b" }}>{g.icon} {g.label}: </span>
                            {g.items.join(" · ")}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="italic" style={{ color: "#7c869b" }}>
                        Awaiting AI justification…
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
