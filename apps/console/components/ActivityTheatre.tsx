"use client";
import ReactFlow, { Background, Controls } from "reactflow";
import "reactflow/dist/style.css";
import { useMemo } from "react";
import { AgentCard } from "./AgentCard";
import { useMeshStore, type AgentName } from "@/lib/store";
import type { HighlightTarget } from "@/lib/demo/script";

const PIPELINE: Array<{ name: AgentName; label: string; model: string; highlightTarget: HighlightTarget }> = [
  { name: "prioritizer", label: "Threat Prioritizer",    model: "gemini-2.5-flash", highlightTarget: "theatre-prioritizer" },
  { name: "allocator",   label: "Interceptor Allocator", model: "gemini-2.5-flash", highlightTarget: "theatre-allocator" },
  { name: "justifier",   label: "Justifier",             model: "gemini-2.5-flash", highlightTarget: "theatre-justifier" },
  { name: "escalator",   label: "Escalation Officer",    model: "gemini-2.5-flash", highlightTarget: "theatre-escalator" },
];

export function ActivityTheatre() {
  const agents = useMeshStore((s) => s.agents);
  const currentHighlight = useMeshStore((s) => s.demo.highlight);

  const nodes = useMemo(() =>
    PIPELINE.map((a, i) => ({
      id: a.name as string,
      position: { x: i * 280, y: 0 },
      data: {
        label: a.label,
        cardProps: {
          ...a,
          state: agents[a.name].state,
          tools: agents[a.name].tools,
          lastMessage: agents[a.name].lastMessage,
          highlighted: currentHighlight === a.highlightTarget,
        },
      },
      type: "agent",
    })), [agents, currentHighlight]);

  const edges = useMemo(() =>
    PIPELINE.slice(0, -1).map((a, i) => ({
      id: `${a.name}->${PIPELINE[i+1].name}`,
      source: a.name as string, target: PIPELINE[i+1].name as string,
      animated: agents[a.name].state === "done" && agents[PIPELINE[i+1].name].state !== "idle",
    })), [agents]);

  const nodeTypes = useMemo(() => ({
    agent: ({ data }: any) => <AgentCard {...data.cardProps} label={data.label} />,
  }), []);

  return (
    <div className="h-[420px] rounded-xl bg-panel/40 ring-1 ring-white/10">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background gap={16} color="#1f2937" />
        <Controls position="top-right" />
      </ReactFlow>
    </div>
  );
}
