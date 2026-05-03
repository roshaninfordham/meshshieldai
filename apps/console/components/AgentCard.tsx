"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ToolChip } from "./ToolChip";
import type { AgentState, ToolCallView } from "@/lib/store";

const ringForState: Record<AgentState, string> = {
  idle:         "ring-white/10",
  thinking:     "ring-accent animate-pulse",
  tool_calling: "ring-emerald-400",
  done:         "ring-emerald-500/60",
  error:        "ring-danger",
};

export function AgentCard({ name, label, model, state, tools, lastMessage }:
  { name: string; label: string; model: string; state: AgentState; tools: ToolCallView[]; lastMessage?: string }) {
  return (
    <motion.div layout
      animate={state === "error" ? { x: [0,-3,3,-2,2,0] } : { x: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl ring-1 ${ringForState[state]} bg-panelSolid p-3 min-w-[230px] shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">{name}</div>
        <div className="flex items-center gap-1 text-[10px]">
          <span className="bg-accent/15 text-accent rounded px-1.5 py-[1px] font-mono">▸ AG2</span>
          <span className="bg-white/5 text-muted rounded px-1.5 py-[1px] font-mono">{model}</span>
        </div>
      </div>
      <div className="mt-1 font-semibold">{label}</div>
      {lastMessage && <div className="mt-2 text-xs text-white/70 line-clamp-2">{lastMessage}</div>}
      <AnimatePresence>
        {tools.length > 0 && (
          <motion.div layout className="mt-2 flex flex-wrap gap-1">
            {tools.map((t, i) => <ToolChip key={i} tool={t.tool} state={t.state} ms={t.ms} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
