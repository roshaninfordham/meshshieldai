import { describe, it, expect, beforeEach } from "vitest";
import { useMeshStore, applyAgentEvent, applySnapshot, resetForDemo, pushNlipMsg } from "@/lib/store";

describe("MeshStore", () => {
  beforeEach(() => useMeshStore.setState((useMeshStore as any).getInitialState()));

  it("starts with idle agent states and no plan", () => {
    const s = useMeshStore.getState();
    expect(s.agents.prioritizer.state).toBe("idle");
    expect(s.plan).toBeNull();
  });

  it("transitions agent state on stage_started/finished", () => {
    applyAgentEvent({ kind: "stage_started", agent: "prioritizer", ts: 1 });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("thinking");
    applyAgentEvent({ kind: "stage_finished", agent: "prioritizer", output_summary: "x", ms: 1, ts: 2 });
    expect(useMeshStore.getState().agents.prioritizer.state).toBe("done");
  });

  it("captures tool calls under the correct agent", () => {
    applyAgentEvent({ kind: "tool_call_started", agent: "allocator", tool: "simulate_intercept_path", args: {}, ts: 1 });
    expect(useMeshStore.getState().agents.allocator.tools[0].tool).toBe("simulate_intercept_path");
    expect(useMeshStore.getState().agents.allocator.tools[0].state).toBe("running");
  });

  it("stores latest snapshot tracks", () => {
    applySnapshot({ v:1, snapshot_id:"s-1", ts:1, tracks:[{id:"t-1",origin:"real",pos_3d:[0,0,0],vel:[0,0,0],conf:0.9}] } as any);
    expect(useMeshStore.getState().tracks.length).toBe(1);
  });

  it("appends to the event tape", () => {
    applyAgentEvent({ kind: "plan_ready", plan_id: "p-1", ts: 1 });
    expect(useMeshStore.getState().tape.length).toBe(1);
    expect(useMeshStore.getState().tape[0].kind).toBe("plan_ready");
  });

  it("resetForDemo clears tracks, plan, tape, nlipMsgs and sets demo.active=true", () => {
    applySnapshot({ v:1, snapshot_id:"s-1", ts:1, tracks:[{id:"t-1",origin:"real",pos_3d:[0,0,0],vel:[0,0,0],conf:0.9}] } as any);
    applyAgentEvent({ kind: "plan_ready", plan_id: "p-1", ts: 1 });
    pushNlipMsg({ role: "you", text: "hello" });
    resetForDemo();
    const s = useMeshStore.getState();
    expect(s.tracks).toHaveLength(0);
    expect(s.plan).toBeNull();
    expect(s.tape).toHaveLength(0);
    expect(s.nlipMsgs).toHaveLength(0);
    expect(s.demo.active).toBe(true);
    expect(s.agents.prioritizer.state).toBe("idle");
  });

  it("pushNlipMsg appends messages to nlipMsgs", () => {
    pushNlipMsg({ role: "you", text: "question" });
    pushNlipMsg({ role: "wc",  text: "answer" });
    const msgs = useMeshStore.getState().nlipMsgs;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("you");
    expect(msgs[1].role).toBe("wc");
  });
});
