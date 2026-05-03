import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AirspaceCanvas } from "@/components/AirspaceCanvas";
import { useMeshStore } from "@/lib/store";

describe("AirspaceCanvas (replaces Map3D)", () => {
  it("renders the SVG canvas even with no tracks", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<AirspaceCanvas />);
    // The empty-state message should appear
    expect(screen.getByText(/Awaiting airspace tracks/)).toBeInTheDocument();
  });

  it("renders live counters strip", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<AirspaceCanvas />);
    expect(screen.getByText(/0 tracks/)).toBeInTheDocument();
    expect(screen.getByText(/4 interceptors/)).toBeInTheDocument();
  });

  it("renders drone icons for each track in the store", () => {
    useMeshStore.setState((s) => ({
      ...(useMeshStore as any).getInitialState(),
      tracks: [
        { id: "t-001", origin: "real",      pos_3d: [100, 80, 50],  vel: [-5, -3, 0], conf: 0.92 },
        { id: "t-002", origin: "simulated", pos_3d: [-80, 100, 60], vel: [4, -4, 0],  conf: 0.75 },
      ],
    }));
    render(<AirspaceCanvas />);
    expect(screen.getByText(/2 tracks/)).toBeInTheDocument();
    // Track labels
    expect(screen.getByText("T-001")).toBeInTheDocument();
    expect(screen.getByText("T-002")).toBeInTheDocument();
    // Confidence labels
    expect(screen.getByText("92% conf")).toBeInTheDocument();
    expect(screen.getByText("75% conf")).toBeInTheDocument();
  });

  it("renders assignment lines when a plan is loaded", () => {
    useMeshStore.setState((s) => ({
      ...(useMeshStore as any).getInitialState(),
      tracks: [
        { id: "t-001", origin: "real", pos_3d: [100, 80, 50], vel: [-5, -3, 0], conf: 0.92 },
      ],
      plan: {
        plan_id: "p-1",
        assignments: [
          { target_id: "t-001", interceptor_id: "i-001", mode: "rf_jam" },
        ],
      },
    }));
    render(<AirspaceCanvas />);
    expect(screen.getByText(/1 assignments/)).toBeInTheDocument();
  });
});
