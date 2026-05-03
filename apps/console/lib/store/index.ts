import { create } from "zustand";
import type { AgentEvent, Snapshot, ResponsePlan } from "@meshshield/protocol";
import type { DemoStep, HighlightTarget } from "@/lib/demo/script";

export type AgentName = "prioritizer" | "allocator" | "justifier" | "escalator" | "watch_commander";
export type AgentState = "idle" | "thinking" | "tool_calling" | "done" | "error";

export type ToolCallView = { tool: string; state: "running" | "done" | "error"; ms?: number; result_summary?: string };
export type AgentView = { state: AgentState; lastMessage?: string; tools: ToolCallView[] };

export type NlipMsg = { role: "you" | "wc"; text: string };

export type DemoSlice = {
  active: boolean;
  currentStep: DemoStep | null;
  highlight: HighlightTarget;
};

type State = {
  agents: Record<AgentName, AgentView>;
  tracks: any[];
  plan: ResponsePlan | null;
  tape: AgentEvent[];
  nlipMsgs: NlipMsg[];
  nlipBusy: boolean;
  demo: DemoSlice;
};

const initial: State = {
  agents: {
    prioritizer:     { state: "idle", tools: [] },
    allocator:       { state: "idle", tools: [] },
    justifier:       { state: "idle", tools: [] },
    escalator:       { state: "idle", tools: [] },
    watch_commander: { state: "idle", tools: [] },
  },
  tracks: [],
  plan: null,
  tape: [],
  nlipMsgs: [],
  nlipBusy: false,
  demo: { active: false, currentStep: null, highlight: "none" },
};

export const useMeshStore = create<State>(() => initial);
(useMeshStore as any).getInitialState = () => initial;

export function applyAgentEvent(ev: AgentEvent): void {
  useMeshStore.setState((s) => {
    const tape = [...s.tape, ev].slice(-500);
    const agents: Record<AgentName, AgentView> = { ...s.agents };
    let plan = s.plan;
    const updateAgent = (name: AgentName, patch: Partial<AgentView>) => {
      agents[name] = { ...agents[name], ...patch, tools: patch.tools ?? agents[name].tools };
    };
    switch ((ev as any).kind) {
      case "stage_started":   if ((ev as any).agent) updateAgent((ev as any).agent as AgentName, { state: "thinking" }); break;
      case "stage_finished":  if ((ev as any).agent) updateAgent((ev as any).agent as AgentName, { state: "done", lastMessage: (ev as any).output_summary }); break;
      case "stage_failed":    if ((ev as any).agent) updateAgent((ev as any).agent as AgentName, { state: "error",  lastMessage: (ev as any).error }); break;
      case "tool_call_started":
        if ((ev as any).agent && (ev as any).tool) {
          const a = agents[(ev as any).agent as AgentName];
          updateAgent((ev as any).agent as AgentName, { state: "tool_calling", tools: [...a.tools, { tool: (ev as any).tool, state: "running" }] });
        }
        break;
      case "tool_call_finished":
        if ((ev as any).agent && (ev as any).tool) {
          const a = agents[(ev as any).agent as AgentName];
          updateAgent((ev as any).agent as AgentName, {
            state: a.state === "tool_calling" ? "thinking" : a.state,
            tools: a.tools.map((t, i, arr) => i === arr.length - 1 && t.state === "running"
              ? { ...t, state: "done", ms: (ev as any).ms, result_summary: (ev as any).result_summary } : t),
          });
        }
        break;
      case "agent_message":
        if ((ev as any).agent) updateAgent((ev as any).agent as AgentName, { lastMessage: (ev as any).preview });
        break;
      case "plan_ready":
        if ((ev as any).plan) plan = (ev as any).plan as ResponsePlan;
        break;
      case "escalation_raised":
        break;
    }
    return { ...s, tape, agents, plan };
  });
}

export function applySnapshot(snap: Snapshot): void {
  useMeshStore.setState((s) => ({ ...s, tracks: (snap as any).tracks ?? [] }));
}

export function applyPlan(plan: ResponsePlan): void {
  useMeshStore.setState((s) => ({ ...s, plan }));
}

export function resetForDemo(): void {
  useMeshStore.setState({
    agents: {
      prioritizer:     { state: "idle", tools: [] },
      allocator:       { state: "idle", tools: [] },
      justifier:       { state: "idle", tools: [] },
      escalator:       { state: "idle", tools: [] },
      watch_commander: { state: "idle", tools: [] },
    },
    tracks: [],
    plan: null,
    tape: [],
    nlipMsgs: [],
    nlipBusy: false,
    demo: { active: true, currentStep: null, highlight: "none" },
  });
}

export function setDemoStep(step: DemoStep | null): void {
  useMeshStore.setState((s) => ({
    demo: {
      active: s.demo.active,
      currentStep: step,
      highlight: step?.highlight ?? "none",
    },
  }));
}

export function endDemo(): void {
  useMeshStore.setState((s) => ({
    demo: { active: false, currentStep: s.demo.currentStep, highlight: "none" },
  }));
}

export function pushNlipMsg(msg: NlipMsg): void {
  useMeshStore.setState((s) => ({ nlipMsgs: [...s.nlipMsgs, msg] }));
}

export function setNlipBusy(busy: boolean): void {
  useMeshStore.setState({ nlipBusy: busy });
}
