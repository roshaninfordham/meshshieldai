"use client";
import { motion } from "framer-motion";

const colorFor: Record<string, string> = {
  simulate_intercept_path: "bg-emerald-500/15 text-emerald-300",
  tavily_recent_threats:   "bg-sky-500/15 text-sky-300",
};

export function ToolChip({ tool, state, ms }: { tool: string; state: "running" | "done" | "error"; ms?: number }) {
  const color = colorFor[tool] ?? "bg-white/10 text-white/80";
  return (
    <motion.span layout
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-mono ${color}`}>
      <span>🛠 {tool}</span>
      {state === "running"
        ? <span className="animate-pulse">…</span>
        : state === "done"
          ? <span className="opacity-70">{ms}ms</span>
          : <span className="text-danger">err</span>}
    </motion.span>
  );
}
