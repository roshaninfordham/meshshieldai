import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CostCurveOverlay } from "@/components/CostCurveOverlay";
import { useMeshStore } from "@/lib/store";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="chart">{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null, Tooltip: () => null, Legend: () => null,
}));

describe("CostCurveOverlay", () => {
  it("renders the chart container regardless of state", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<CostCurveOverlay />);
    expect(screen.getByTestId("chart")).toBeInTheDocument();
  });
});
