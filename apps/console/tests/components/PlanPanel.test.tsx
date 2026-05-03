import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlanPanel } from "@/components/PlanPanel";
import { useMeshStore } from "@/lib/store";

describe("PlanPanel", () => {
  it("renders empty state when no plan", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<PlanPanel />);
    expect(screen.getByText(/no plan yet/i)).toBeInTheDocument();
  });
  it("renders assignments when a plan is set", () => {
    useMeshStore.setState({ ...(useMeshStore as any).getInitialState(),
      plan: { v:1, plan_id:"plan-1", snapshot_id:"snap-1", ts: 1,
              assignments: [{ target_id:"t-1", interceptor_id:"i-002", mode:"kinetic", priority:1,
                              justification:{ snapshot_refs:["tracks[0].pos_3d"], tavily_refs:[], policy_refs:["clause:proximity_under_50m"] }}],
              escalation: { required:false, reasons: [] }} as any });
    render(<PlanPanel />);
    expect(screen.getByText(/t-1/)).toBeInTheDocument();
    expect(screen.getByText(/i-002/)).toBeInTheDocument();
  });
});
