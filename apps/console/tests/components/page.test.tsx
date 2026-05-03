import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/streams/snapshot", () => ({ connectSnapshotStream: () => () => {} }));
vi.mock("@/lib/streams/agent",    () => ({ connectAgentStream:    () => () => {} }));
vi.mock("@/lib/nlip/client",      () => ({ createNlipClient:      () => ({ ask: async () => "ok", close: () => {} }) }));
vi.mock("@/components/AirspaceCanvas", () => ({ AirspaceCanvas: () => <div data-testid="airspace-canvas" /> }));
vi.mock("@/components/StackSidebar",   () => ({ StackSidebar:   () => <div data-testid="stack-sidebar" /> }));
vi.mock("@/components/ActivityTheatre", () => ({ ActivityTheatre: () => <div data-testid="theatre" /> }));
vi.mock("@/components/CostCurveOverlay", () => ({ CostCurveOverlay: () => <div>COST-CURVE</div> }));
vi.mock("@/components/EventTape",        () => ({ EventTape:        () => <div>EVENT TAPE</div> }));
vi.mock("@/lib/demo/controller", () => ({
  startDemo: vi.fn(),
  stopDemo: vi.fn(),
  isDemoRunning: () => false,
  registerNlipAsk: vi.fn(),
}));

import Page from "@/app/page";

describe("Page", () => {
  it("renders header, airspace canvas, theatre, stack sidebar, chat, plan, tape, cost-curve, and demo button", () => {
    render(<Page />);
    expect(screen.getByText(/MeshShield AI/)).toBeInTheDocument();
    expect(screen.getByTestId("airspace-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("theatre")).toBeInTheDocument();
    expect(screen.getByTestId("stack-sidebar")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask Watch Commander/)).toBeInTheDocument();
    expect(screen.getByText(/RESPONSE PLAN|No plan yet/)).toBeInTheDocument();
    expect(screen.getByText(/EVENT TAPE/)).toBeInTheDocument();
    expect(screen.getByText(/COST-CURVE/)).toBeInTheDocument();
    expect(screen.getByText(/START DEMO/)).toBeInTheDocument();
  });
});
