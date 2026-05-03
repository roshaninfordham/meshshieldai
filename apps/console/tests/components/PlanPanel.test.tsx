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
    // Raw IDs are rendered as muted subscripts — check with case-insensitive regex
    expect(screen.getByText(/T-1/i)).toBeInTheDocument();
    expect(screen.getByText(/I-002/i)).toBeInTheDocument();
    // Plain-English labels should also be present
    expect(screen.getAllByText(/Drone #/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Interceptor #/i).length).toBeGreaterThan(0);
    // Mode should be translated
    expect(screen.getByText(/Kinetic intercept/i)).toBeInTheDocument();
    // Justification should be translated
    expect(screen.getAllByText(/Sensor data/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Policy/i).length).toBeGreaterThan(0);
  });

  it("shows plan id in header", () => {
    useMeshStore.setState({ ...(useMeshStore as any).getInitialState(),
      plan: { v:1, plan_id:"plan-42", snapshot_id:"snap-1", ts: 1,
              assignments: [],
              escalation: { required:false, reasons: [] }} as any });
    render(<PlanPanel />);
    expect(screen.getByText(/plan-42/i)).toBeInTheDocument();
  });

  it("shows human-approval warning when escalation required", () => {
    useMeshStore.setState({ ...(useMeshStore as any).getInitialState(),
      plan: { v:1, plan_id:"plan-1", snapshot_id:"snap-1", ts: 1,
              assignments: [],
              escalation: { required:true, reasons: ["High risk"] }} as any });
    render(<PlanPanel />);
    expect(screen.getByText(/human approval needed/i)).toBeInTheDocument();
  });
});
