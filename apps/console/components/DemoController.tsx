"use client";
import { useState, useEffect } from "react";
import { useMeshStore } from "@/lib/store";
import { startDemo, stopDemo, registerNlipAsk } from "@/lib/demo/controller";

type NlipClient = { ask: (s: string) => Promise<string>; close: () => void };

export function DemoController({ client }: { client: NlipClient }) {
  const demoActive = useMeshStore((s) => s.demo.active);
  const [loading, setLoading] = useState(false);

  // Register the NLIP ask function so the demo controller can fire scripted questions
  useEffect(() => {
    registerNlipAsk(client.ask.bind(client));
  }, [client]);

  // Sync loading state with demo active flag
  useEffect(() => {
    if (!demoActive) setLoading(false);
  }, [demoActive]);

  const handleClick = async () => {
    if (loading || demoActive) return;
    setLoading(true);
    await startDemo();
    // loading clears when demoActive flips false via the effect above
  };

  const running = loading || demoActive;

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
              ? "opacity-70 cursor-not-allowed"
              : "hover:scale-105 hover:shadow-emerald-400/40 hover:shadow-2xl active:scale-95",
          ].join(" ")}
        >
          {running ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-900/50 animate-pulse" />
              DEMO RUNNING…
            </span>
          ) : (
            "▶ START DEMO"
          )}
        </button>
      </div>
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
