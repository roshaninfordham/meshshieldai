"use client";
import { motion, AnimatePresence } from "framer-motion";

export const GLOSSARY_TERMS = [
  { term: "Track",          plain: "A drone the system has detected and is actively following" },
  { term: "Interceptor",    plain: "A countermeasure (device or drone) that can engage a detected drone" },
  { term: "Radio jam",      plain: "Disrupting the drone's radio control link — it loses contact with its operator and returns home or descends safely" },
  { term: "Kinetic",        plain: "Physically intercepting a drone — with a projectile, net, or an interceptor drone" },
  { term: "GPS spoof",      plain: "Sending fake GPS coordinates to redirect the drone to a safe landing zone" },
  { term: "Confidence",     plain: "How sure the AI is that a detected object really is a hostile drone (0% = no idea, 100% = certain)" },
  { term: "Escalation",     plain: "A request for a human operator to review and confirm before the system takes action" },
  { term: "Pipeline cycle", plain: "One full loop of the 4 AI agents analysing the situation and producing a plan together" },
  { term: "Response Plan",  plain: "The set of decisions the agents output each cycle — which interceptor should engage which drone, and how" },
  { term: "AG2",            plain: "The open-source multi-agent framework that runs and coordinates the 4 specialist AI agents" },
  { term: "NLIP",           plain: "Ecma-430 — a standardised protocol for human-to-AI chat over WebSocket. Powers the Watch Commander chat." },
  { term: "Tavily",         plain: "A real-time web search API the AI uses to ground its decisions in current news headlines" },
  { term: "Daytona",        plain: "A cloud sandbox the AI uses to safely run intercept trajectory simulations without affecting the main system" },
  { term: "Watch Commander", plain: "The friendly AI you can chat with — ask it anything about the current threat picture and it will explain its reasoning" },
  { term: "DEFCON",         plain: "Readiness level: DEFCON 5 = normal, DEFCON 2 = critical. Shown in the header as a coloured badge." },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlossaryModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.93, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.93, y: 20 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "#0d1320",
              border: "1px solid rgba(92,242,192,0.2)",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4"
                 style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0f1420" }}>
              <div>
                <div className="font-bold text-base" style={{ color: "#5cf2c0" }}>📖 Glossary</div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: "#7c869b" }}>
                  Every term explained in plain English — no jargon required
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm transition-colors"
                style={{ background: "rgba(255,255,255,0.07)", color: "#7c869b",
                         border: "1px solid rgba(255,255,255,0.1)" }}
                aria-label="Close glossary"
              >
                ✕
              </button>
            </div>

            {/* Terms table */}
            <div className="overflow-y-auto flex-1 px-6 py-4"
                 style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(92,242,192,0.2) transparent" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <th className="text-left pb-2 font-mono text-xs" style={{ color: "#5cf2c0", width: "28%" }}>Term</th>
                    <th className="text-left pb-2 font-mono text-xs" style={{ color: "#5cf2c0" }}>Plain English</th>
                  </tr>
                </thead>
                <tbody>
                  {GLOSSARY_TERMS.map(({ term, plain }) => (
                    <tr key={term} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="py-2 pr-4 font-mono font-bold align-top text-xs" style={{ color: "#4facfe" }}>
                        {term}
                      </td>
                      <td className="py-2 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                        {plain}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* How to read the airspace */}
              <div className="mt-6 rounded-xl p-4"
                   style={{ background: "rgba(92,242,192,0.04)", border: "1px solid rgba(92,242,192,0.12)" }}>
                <div className="font-bold text-xs mb-3" style={{ color: "#5cf2c0" }}>
                  🗺 How to read the airspace view
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
                  <div><span style={{ color: "#5cf2c0" }}>● Coloured drone icons</span> — each labelled "Drone #N". Green = real sensor detection. Yellow = simulated drill data.</div>
                  <div><span style={{ color: "#4facfe" }}>▲ Triangles at the edges</span> — interceptors stationed around the asset. Hover to see type and range.</div>
                  <div><span style={{ color: "#ff5c5c" }}>⬢ Red hexagon in the centre</span> — the protected asset (data center). Range rings show 50m / 100m / 200m perimeters.</div>
                  <div><span style={{ color: "#fcb045" }}>- - - Dashed coloured lines</span> — active engagements. Each line pairs one interceptor with one drone.</div>
                  <div><span style={{ color: "#fcb045" }}>◯ Yellow ring on a drone</span> — this drone is actively being engaged by its assigned interceptor.</div>
                  <div><span style={{ color: "#7c869b" }}>Drag / scroll / +− keys</span> — pan and zoom the view. Click ❓ for a quick visual guide.</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg font-bold text-sm transition-colors"
                style={{ background: "rgba(92,242,192,0.12)", color: "#5cf2c0",
                         border: "1px solid rgba(92,242,192,0.3)" }}
              >
                Close glossary ✓
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
