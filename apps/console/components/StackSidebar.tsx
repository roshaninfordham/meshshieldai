"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMeshStore } from "@/lib/store";

type BadgeState = "green" | "amber" | "grey";

interface StackRow {
  id: string;
  icon: string;
  name: string;
  subtitle: string;
  description: string;
  homepage: string;
  badge: BadgeState;
  counter: string;
  pulsing: boolean;
}

function usePulse(value: number): boolean {
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 1000);
      return () => clearTimeout(t);
    }
  }, [value]);
  return pulsing;
}

const EXPLANATIONS: Record<string, { body: string; href: string }> = {
  ag2: {
    body: "AG2 (AutoGen v0.4+) is a multi-agent orchestration framework from Microsoft. It lets you compose LLM-powered agents that call tools, pass messages, and collaborate — here it runs the entire counter-swarm pipeline (Prioritizer → Allocator → Justifier → Escalator).",
    href: "https://github.com/ag2ai/ag2",
  },
  nlip: {
    body: "NLIP (Ecma-430 draft) is a standardised natural-language interaction protocol. It specifies how clients exchange JSON/CBOR messages with AI services over WebSocket. The Watch Commander agent exposes an NLIP endpoint so the operator can chat in plain English.",
    href: "https://ecma-international.org/",
  },
  tavily: {
    body: "Tavily is a real-time web search API built for AI agents. The Justifier agent calls Tavily to ground every intercept assignment with the latest counter-drone news headlines, turning the plan into an evidence-backed audit trail.",
    href: "https://tavily.com",
  },
  daytona: {
    body: "Daytona is a secure, reproducible sandbox runner for agentic code execution. The Allocator agent runs ballistic trajectory simulations inside a Daytona sandbox — isolating untrusted compute from the main process (falls back to an in-process simulator when the Daytona service is unavailable).",
    href: "https://daytona.io",
  },
};

function Popover({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const info = EXPLANATIONS[id];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);
  if (!info) return null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="tooltip"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 z-50 w-72 rounded-xl p-4 shadow-2xl text-xs text-white/80 leading-relaxed"
          style={{
            background: "#1a2133",
            border: "1px solid rgba(255,255,255,0.12)",
            top: "calc(100% + 6px)",
          }}
        >
          <p>{info.body}</p>
          <a href={info.href} target="_blank" rel="noopener noreferrer"
             className="mt-2 block text-accent underline underline-offset-2">
            {info.href} ↗
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BadgeDot({ state, pulsing }: { state: BadgeState; pulsing: boolean }) {
  const colors: Record<BadgeState, string> = {
    green: "#5cf2c0",
    amber: "#fcb045",
    grey:  "#7c869b",
  };
  return (
    <motion.span
      animate={pulsing ? { scale: [1, 1.6, 1], opacity: [1, 0.6, 1] } : { scale: 1, opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: colors[state],
        flexShrink: 0,
      }}
    />
  );
}

export function StackSidebar() {
  const tape      = useMeshStore((s) => s.tape);
  const nlipMsgs  = useMeshStore((s) => s.nlipMsgs);

  const ag2Count = useMemo(() => tape.filter((e: any) => e.kind === "plan_ready").length, [tape]);
  const tavilyCount = useMemo(() =>
    tape.filter((e: any) => e.kind === "tool_call_finished" && e.tool === "tavily_recent_threats").length, [tape]);
  const daytonaCount = useMemo(() =>
    tape.filter((e: any) => e.kind === "tool_call_finished" && e.tool === "simulate_intercept_path").length, [tape]);
  const daytonaFallback = useMemo(() => {
    const last = [...tape].reverse().find((e: any) =>
      e.kind === "tool_call_finished" && e.tool === "simulate_intercept_path");
    return (last as any)?.result_summary?.toLowerCase?.().includes("fallback") ?? false;
  }, [tape]);
  const nlipCount = useMemo(() => nlipMsgs.filter(m => m.role === "wc").length, [nlipMsgs]);
  const lastAg2 = useMemo(() => {
    const last = [...tape].reverse().find((e: any) => e.kind === "plan_ready");
    return last ? (last as any).ts ?? null : null;
  }, [tape]);
  const ag2LastAgo = useMemo(() => {
    if (!lastAg2) return null;
    const secs = Math.round((Date.now() - new Date(lastAg2).getTime()) / 1000);
    return `last ${secs}s ago`;
  }, [lastAg2, tape]);

  const ag2Pulse     = usePulse(ag2Count);
  const tavilyPulse  = usePulse(tavilyCount);
  const daytonaPulse = usePulse(daytonaCount);
  const nlipPulse    = usePulse(nlipCount);

  const [openPopover, setOpenPopover] = useState<string | null>(null);

  const rows: StackRow[] = [
    {
      id: "ag2",
      icon: "⚡",
      name: "AG2",
      subtitle: "autogen.beta · OpenRouter · Gemini 2.5",
      description: "Multi-agent pipeline orchestrator",
      homepage: "github.com/ag2ai/ag2",
      badge: ag2Count > 0 ? "green" : "grey",
      counter: ag2Count > 0 ? `tick #${ag2Count}${ag2LastAgo ? ` · ${ag2LastAgo}` : ""}` : "idle",
      pulsing: ag2Pulse,
    },
    {
      id: "nlip",
      icon: "💬",
      name: "NLIP",
      subtitle: "Ecma-430 draft · WS+CBOR",
      description: "Operator ↔ Watch Commander chat",
      homepage: "ecma-international.org",
      badge: nlipCount > 0 ? "green" : "grey",
      counter: nlipCount > 0 ? `responses: ${nlipCount}` : "idle",
      pulsing: nlipPulse,
    },
    {
      id: "tavily",
      icon: "🔍",
      name: "Tavily",
      subtitle: "Live grounding · news API",
      description: "Real-time web search for Justifier",
      homepage: "tavily.com",
      badge: tavilyCount > 0 ? "green" : "grey",
      counter: tavilyCount > 0 ? `headlines fetched: ${tavilyCount}` : "idle",
      pulsing: tavilyPulse,
    },
    {
      id: "daytona",
      icon: "🛠",
      name: "Daytona",
      subtitle: "Sandbox · ballistic sim",
      description: "Secure runner for trajectory compute",
      homepage: "daytona.io",
      badge: daytonaCount > 0 ? (daytonaFallback ? "amber" : "green") : "grey",
      counter: daytonaCount > 0
        ? `sims run: ${daytonaCount}${daytonaFallback ? " · local-fallback" : ""}`
        : "idle",
      pulsing: daytonaPulse,
    },
  ];

  return (
    <div className="rounded-xl ring-1 ring-white/10 overflow-hidden"
         style={{ background: "#0f1420" }}>
      {/* Header */}
      <div className="px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase"
           style={{ color: "#5cf2c0", borderBottom: "1px solid rgba(255,255,255,0.07)", letterSpacing: "0.12em" }}>
        ⚡ Powered By
      </div>

      {rows.map((row) => (
        <div key={row.id}
             className="px-4 py-3 relative"
             style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Top row: icon + name + badge + "?" */}
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{row.icon}</span>
            <BadgeDot state={row.badge} pulsing={row.pulsing} />
            <span className="font-bold text-white text-sm">{row.name}</span>
            <span className="ml-auto relative">
              <button
                aria-label={`About ${row.name}`}
                onClick={() => setOpenPopover(openPopover === row.id ? null : row.id)}
                className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  color: "#7c869b",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                ?
              </button>
              <Popover id={row.id} open={openPopover === row.id}
                       onClose={() => setOpenPopover(null)} />
            </span>
          </div>

          {/* Subtitle */}
          <div className="mt-1 text-[10px] font-mono" style={{ color: "#7c869b" }}>
            {row.subtitle}
          </div>

          {/* Description */}
          <div className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            {row.description}
          </div>

          {/* Counter */}
          <div className="mt-1.5 text-[10px] font-mono px-2 py-0.5 rounded inline-block"
               style={{
                 background: row.badge === "grey"
                   ? "rgba(124,134,155,0.1)"
                   : row.badge === "amber"
                   ? "rgba(252,176,69,0.12)"
                   : "rgba(92,242,192,0.1)",
                 color: row.badge === "grey"
                   ? "#7c869b"
                   : row.badge === "amber"
                   ? "#fcb045"
                   : "#5cf2c0",
               }}>
            {row.counter}
          </div>
        </div>
      ))}
    </div>
  );
}
