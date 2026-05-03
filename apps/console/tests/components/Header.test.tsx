import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { Header } from "@/components/Header";
import { useMeshStore } from "@/lib/store";

describe("Header", () => {
  beforeEach(() => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
  });

  it("renders AG2 brand chip and scenario name", () => {
    render(<Header scenario="data-center-swarm-attack" />);
    expect(screen.getByText(/MeshShield AI/)).toBeInTheDocument();
    expect(screen.getByText(/Powered by AG2/)).toBeInTheDocument();
    expect(screen.getByText(/data-center-swarm-attack/)).toBeInTheDocument();
  });

  it("shows the subtitle", () => {
    render(<Header scenario="data-center-swarm-attack" />);
    expect(screen.getByText(/Software-defined counter-swarm defense/)).toBeInTheDocument();
  });

  it("shows idle state when no pipeline ticks", () => {
    render(<Header scenario="test-scenario" />);
    expect(screen.getByText(/idle/)).toBeInTheDocument();
  });

  it("shows LIVE state with tick count when plan_ready events exist", () => {
    useMeshStore.setState((s) => ({
      ...s,
      tape: [
        { kind: "plan_ready", plan: {} } as any,
        { kind: "plan_ready", plan: {} } as any,
      ],
    }));
    render(<Header scenario="test-scenario" />);
    expect(screen.getByText(/LIVE — pipeline tick #2/)).toBeInTheDocument();
  });
});
