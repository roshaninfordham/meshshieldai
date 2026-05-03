"use client";
import { useState, useEffect } from "react";
import { useMeshStore } from "@/lib/store";
import { startDemo, stopDemo, registerNlipAsk } from "@/lib/demo/controller";
import { DEMO_SCRIPT } from "@/lib/demo/script";
import { motion, AnimatePresence } from "framer-motion";

type NlipClient = { ask: (s: string) => Promise<string>; close: () => void };

const TOTAL_STEPS = DEMO_SCRIPT.length;
const TOTAL_MS = DEMO_SCRIPT[DEMO_SCRIPT.length - 1].at_ms + DEMO_SCRIPT[DEMO_SCRIPT.length - 1].duration_ms;

export function DemoController({ client }: { client: NlipClient }) {
  const demoActive = useMeshStore((s) => s.demo.active);
  const currentStep = useMeshStore((s) => s.demo.currentStep);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Register the NLIP ask function so the demo controller can fire scripted questions
  useEffect(() => {
    registerNlipAsk(client.ask.bind(client));
  }, [client]);

  // Sync loading state with demo active flag
  useEffect(() => {
    if (!demoActive) {
      setLoading(false);
      setStartTime(null);
      setElapsed(0);
    }
  }, [demoActive]);

  // Track elapsed time for progress bar
  useEffect(() => {
    if (!demoActive || !startTime) return;
    const id = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 250);
    return () => clearInterval(id);
  }, [demoActive, startTime]);

  const handleClick = async () => {
    if (loading || demoActive) return;
    setLoading(true);
    setStartTime(Date.now());
    setElapsed(0);
    await startDemo();
  };

  const running = loading || demoActive;

  // Current step index (0-based)
  const stepIndex = currentStep
    ? DEMO_SCRIPT.findIndex(s => s.title === currentStep.title)
    : -1;
  const stepNum = stepIndex + 1;

  // Progress 0–1
  const progress = Math.min(1, elapsed / TOTAL_MS);

  // ETA in seconds
  const etaSec = progress > 0 && progress < 1
    ? Math.ceil((TOTAL_MS - elapsed) / 1000)
    : null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
      <div className="relative">
        {/* Pulse ring when idle */}
        {!running && (
          <>
            <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" style={{ borderRadius: "12px" }} />
            <span className="absolute inset-0 rounded-xl bg-emerald-400/10 animate-pulse" />
          </>
        )}
        <button
          onClick={handleClick}
          disabled={running}
          className={[
            "relative px-8 py-4 rounded-xl font-bold text-base shadow-2xl transition-all duration-200",
            "bg-gradient-to-r from-emerald-400 to-cyan-500 text-gray-900",
            running
              ? "opacity-90 cursor-not-allowed"
              : "hover:scale-105 hover:shadow-emerald-400/40 hover:shadow-2xl active:scale-95",
          ].join(" ")}
          style={{ minWidth: "190px" }}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-900/60 animate-pulse" />
              <span className="font-bold text-base">DEMO RUNNING</span>
            </span>
          ) : (
            <span className="text-base font-bold">▶ START DEMO</span>
          )}
        </button>
      </div>

      {/* Progress bar + step label */}
      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-lg overflow-hidden font-mono"
            style={{
              background: "rgba(13,19,32,0.95)",
              border: "1px solid rgba(92,242,192,0.2)",
              width: "190px",
              padding: "8px 10px",
            }}
          >
            {/* Step label */}
            <div className="text-[10px] mb-1.5 truncate" style={{ color: "#7c869b" }}>
              {stepNum > 0
                ? `Step ${stepNum} of ${TOTAL_STEPS}: ${currentStep?.title ?? "…"}`
                : "Initialising…"}
            </div>
            {/* Progress track */}
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #5cf2c0, #4facfe)" }}
                animate={{ width: `${Math.round(progress * 100)}%` }}
                transition={{ duration: 0.3, ease: "linear" }}
              />
            </div>
            {/* ETA */}
            {etaSec !== null && (
              <div className="text-[9px] mt-1 text-right" style={{ color: "#7c869b" }}>
                ~{etaSec}s remaining
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {running && (
        <button
          onClick={stopDemo}
          className="text-[10px] text-muted hover:text-white transition-colors px-2 py-1 rounded bg-white/5"
        >
          stop
        </button>
      )}
    </div>
  );
}
