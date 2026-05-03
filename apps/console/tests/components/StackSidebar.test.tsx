import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { StackSidebar } from "@/components/StackSidebar";
import { useMeshStore } from "@/lib/store";

describe("StackSidebar", () => {
  beforeEach(() => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
  });

  it("renders all four framework rows", () => {
    render(<StackSidebar />);
    expect(screen.getByText("AG2")).toBeInTheDocument();
    expect(screen.getByText("NLIP")).toBeInTheDocument();
    expect(screen.getByText("Tavily")).toBeInTheDocument();
    expect(screen.getByText("Daytona")).toBeInTheDocument();
  });

  it("shows idle counters when store is empty", () => {
    render(<StackSidebar />);
    const idleEls = screen.getAllByText("idle");
    expect(idleEls.length).toBeGreaterThanOrEqual(4);
  });

  it("shows AG2 tick count when plan_ready events arrive", () => {
    useMeshStore.setState((s) => ({
      ...s,
      tape: [
        { kind: "plan_ready", plan: {}, ts: new Date().toISOString() } as any,
        { kind: "plan_ready", plan: {}, ts: new Date().toISOString() } as any,
      ],
    }));
    render(<StackSidebar />);
    expect(screen.getByText(/tick #2/)).toBeInTheDocument();
  });

  it("shows Tavily count when tavily tool events arrive", () => {
    useMeshStore.setState((s) => ({
      ...s,
      tape: [
        { kind: "tool_call_finished", tool: "tavily_recent_threats", ms: 300 } as any,
        { kind: "tool_call_finished", tool: "tavily_recent_threats", ms: 400 } as any,
      ],
    }));
    render(<StackSidebar />);
    expect(screen.getByText(/headlines fetched: 2/)).toBeInTheDocument();
  });

  it("shows Daytona sim count when simulate_intercept_path events arrive", () => {
    useMeshStore.setState((s) => ({
      ...s,
      tape: [
        { kind: "tool_call_finished", tool: "simulate_intercept_path", ms: 150, result_summary: "ballistic ok" } as any,
      ],
    }));
    render(<StackSidebar />);
    expect(screen.getByText(/sims run: 1/)).toBeInTheDocument();
  });

  it("shows NLIP response count from wc messages", () => {
    useMeshStore.setState((s) => ({
      ...s,
      nlipMsgs: [
        { role: "you", text: "hello?" },
        { role: "wc",  text: "All clear." },
        { role: "wc",  text: "Escalation not required." },
      ],
    }));
    render(<StackSidebar />);
    expect(screen.getByText(/responses: 2/)).toBeInTheDocument();
  });

  it("renders ? help buttons for each row", () => {
    render(<StackSidebar />);
    const helpBtns = screen.getAllByRole("button", { name: /About/ });
    expect(helpBtns.length).toBe(4);
  });
});
