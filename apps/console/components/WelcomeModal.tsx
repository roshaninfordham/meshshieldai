"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "meshshield-welcomed";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  // Only show if the user hasn't dismissed it before
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setOpen(true);
      }
    } catch {
      // localStorage unavailable (SSR / private mode) — skip
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.9, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 24 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="rounded-2xl font-mono text-sm leading-relaxed"
            style={{
              background: "#0d1320",
              border: "1px solid rgba(92,242,192,0.3)",
              padding: "32px 36px",
              maxWidth: "540px",
              width: "92%",
              color: "#c0cad9",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7), 0 0 48px rgba(92,242,192,0.06)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Title */}
            <div className="text-xl font-bold mb-1" style={{ color: "#5cf2c0" }}>
              🛡 Welcome to MeshShield AI
            </div>
            <div className="text-xs mb-5" style={{ color: "#7c869b" }}>
              Software-defined counter-drone defense
            </div>

            {/* Hook */}
            <div className="mb-4 p-3 rounded-lg text-[13px]"
                 style={{ background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.2)", color: "#ffb3b3" }}>
              The cost asymmetry: a <strong>$3M Patriot missile</strong> vs a{" "}
              <strong>$500 attack drone</strong>.<br />
              Defense loses every time — unless software flips the curve.
            </div>

            {/* What the demo shows */}
            <div className="text-[12px] mb-4" style={{ color: "#c0cad9" }}>
              This demo shows MeshShield protecting a data center from a drone swarm:
            </div>
            <ul className="flex flex-col gap-2 text-[12px] mb-6">
              {[
                ["📡", "Sensors detect drones", "yellow X-icons appear on the airspace map"],
                ["🤖", "Four AI agents think through the response", "powered by AG2 + Gemini 2.5, running live"],
                ["📋", "Every decision is visible", "tool calls, citations, and reasoning — in real time"],
                ["🎛", "You stay in control", "Mission Control lets you pause, override, or escalate at any moment"],
              ].map(([icon, title, desc]) => (
                <li key={title as string} className="flex gap-2">
                  <span className="text-base flex-shrink-0">{icon}</span>
                  <span>
                    <span style={{ color: "#e0eaf8" }}>{title}</span>
                    {" — "}
                    <span style={{ color: "#7c869b" }}>{desc}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="text-[11px] mb-5" style={{ color: "#7c869b" }}>
              Click <strong style={{ color: "#5cf2c0" }}>▶ START DEMO</strong> (top-right) to begin.
              Click <strong style={{ color: "#fcb045" }}>❓</strong> on the airspace anytime for the visual legend.
            </div>

            <button
              onClick={dismiss}
              className="w-full py-3 rounded-xl font-bold text-base transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: "linear-gradient(90deg, #5cf2c0, #4facfe)",
                color: "#0b0f17",
                border: "none",
                boxShadow: "0 0 24px rgba(92,242,192,0.3)",
              }}
            >
              Got it — start exploring ▶
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
