"use client";
import { useMemo, useRef, useEffect, useState } from "react";
import { AgentCard } from "./AgentCard";
import { useMeshStore, type AgentName } from "@/lib/store";
import type { HighlightTarget } from "@/lib/demo/script";

const PIPELINE: Array<{
  name: AgentName;
  label: string;
  model: string;
  highlightTarget: HighlightTarget;
  usesLabel: string;
}> = [
  {
    name: "prioritizer",
    label: "Threat Prioritizer",
    model: "gemini-2.5-flash",
    highlightTarget: "theatre-prioritizer",
    usesLabel: "snapshot store",
  },
  {
    name: "allocator",
    label: "Interceptor Allocator",
    model: "gemini-2.5-flash",
    highlightTarget: "theatre-allocator",
    usesLabel: "Daytona sandbox · interceptor catalog",
  },
  {
    name: "justifier",
    label: "Justifier",
    model: "gemini-2.5-flash",
    highlightTarget: "theatre-justifier",
    usesLabel: "Tavily news API · policy clauses",
  },
  {
    name: "escalator",
    label: "Escalation Officer",
    model: "gemini-2.5-flash",
    highlightTarget: "theatre-escalator",
    usesLabel: "policy thresholds (deterministic gate)",
  },
];

/** Arrow between two pipeline stages. Glows when the previous stage just finished. */
function PipelineArrow({ active }: { active: boolean }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: "32px" }}>
      <svg width="32" height="24" viewBox="0 0 32 24" fill="none">
        <defs>
          <filter id="arrow-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <line
          x1="2" y1="12" x2="24" y2="12"
          stroke={active ? "#5cf2c0" : "rgba(92,242,192,0.25)"}
          strokeWidth={active ? "2.5" : "1.5"}
          strokeDasharray={active ? "none" : "4 3"}
          filter={active ? "url(#arrow-glow)" : undefined}
          style={{ transition: "all 0.4s ease" }}
        />
        <polygon
          points="22,7 30,12 22,17"
          fill={active ? "#5cf2c0" : "rgba(92,242,192,0.25)"}
          filter={active ? "url(#arrow-glow)" : undefined}
          style={{ transition: "all 0.4s ease" }}
        />
      </svg>
    </div>
  );
}

export function ActivityTheatre() {
  const agents = useMeshStore((s) => s.agents);
  const currentHighlight = useMeshStore((s) => s.demo.highlight);

  const isArrowActive = (fromIdx: number) => {
    const from = PIPELINE[fromIdx];
    const to   = PIPELINE[fromIdx + 1];
    return (
      agents[from.name].state === "done" &&
      agents[to.name].state !== "idle"
    );
  };

  return (
    <div
      className="rounded-xl ring-1 ring-white/10"
      style={{ background: "#0b0f17" }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="font-bold" style={{ color: "#5cf2c0" }}>⚡ MULTI-AGENT PIPELINE</span>
          <span style={{ color: "#7c869b" }}>4 agents · sequential handoff</span>
          <span className="ml-auto text-[10px]" style={{ color: "#7c869b" }}>
            PRIORITIZER → ALLOCATOR → JUSTIFIER → ESCALATOR
          </span>
        </div>
        <div className="text-[10px] font-mono mt-0.5 italic" style={{ color: "#7c869b" }}>
          Four specialist AI agents thinking step by step — each hands its output to the next
        </div>
      </div>

      {/* Cards row — no fixed height, no react-flow waste */}
      <div className="flex items-stretch gap-0 px-3 py-3">
        {PIPELINE.map((agent, idx) => (
          <div key={agent.name} className="flex items-center flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <AgentCard
                {...agent}
                state={agents[agent.name].state}
                tools={agents[agent.name].tools}
                lastMessage={agents[agent.name].lastMessage}
                highlighted={currentHighlight === agent.highlightTarget}
              />
            </div>
            {idx < PIPELINE.length - 1 && (
              <PipelineArrow active={isArrowActive(idx)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
