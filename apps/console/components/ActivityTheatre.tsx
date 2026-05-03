"use client";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { useMemo } from "react";
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

const EDGE_STYLE = {
  stroke: "#5cf2c0",
  strokeWidth: 3,
};

const ANIMATED_EDGE_STYLE = {
  stroke: "#5cf2c0",
  strokeWidth: 4,
  strokeDasharray: "8 4",
  filter: "drop-shadow(0 0 4px rgba(92,242,192,0.7))",
};

export function ActivityTheatre() {
  const agents = useMeshStore((s) => s.agents);
  const currentHighlight = useMeshStore((s) => s.demo.highlight);

  const nodes = useMemo(() =>
    PIPELINE.map((a, i) => ({
      id: a.name as string,
      position: { x: i * 300, y: 0 },
      data: {
        label: a.label,
        cardProps: {
          ...a,
          state: agents[a.name].state,
          tools: agents[a.name].tools,
          lastMessage: agents[a.name].lastMessage,
          highlighted: currentHighlight === a.highlightTarget,
          usesLabel: a.usesLabel,
        },
      },
      type: "agent",
    })), [agents, currentHighlight]);

  const edges = useMemo(() =>
    PIPELINE.slice(0, -1).map((a, i) => {
      const isAnimated = agents[a.name].state === "done" &&
                         agents[PIPELINE[i+1].name].state !== "idle";
      return {
        id: `${a.name}->${PIPELINE[i+1].name}`,
        source: a.name as string,
        target: PIPELINE[i+1].name as string,
        animated: isAnimated,
        style: isAnimated ? ANIMATED_EDGE_STYLE : EDGE_STYLE,
        markerEnd: "url(#arrowhead)",
      };
    }), [agents]);

  const nodeTypes = useMemo(() => ({
    agent: ({ data }: any) => <AgentCard {...data.cardProps} label={data.label} />,
  }), []);

  return (
    <div className="h-[380px] rounded-xl ring-1 ring-white/10 relative"
         style={{ background: "#0b0f17" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-2 text-xs font-mono"
           style={{ background: "rgba(11,15,23,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="font-bold" style={{ color: "#5cf2c0" }}>⚡ MULTI-AGENT PIPELINE</span>
        <span style={{ color: "#7c869b" }}>4 agents · sequential handoff</span>
        <span className="ml-auto text-[10px]" style={{ color: "#7c869b" }}>
          PRIORITIZER → ALLOCATOR → JUSTIFIER → ESCALATOR
        </span>
      </div>
      <div style={{ width: "100%", height: "100%", paddingTop: "32px" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#5cf2c0" />
            </marker>
          </defs>
          <Background gap={20} color="rgba(255,255,255,0.04)" />
          <Controls position="top-right" />
        </ReactFlow>
      </div>
    </div>
  );
}
