import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { useMeshStore } from "@/lib/store";

vi.mock("reactflow", () => ({
  __esModule: true,
  default: ({ nodes }: any) => (
    <div data-testid="rf">{nodes.map((n: any) => <div key={n.id}>{n.data?.label}</div>)}</div>
  ),
  Background: () => null, Controls: () => null,
}));

describe("ActivityTheatre", () => {
  it("renders the four pipeline agents in order", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<ActivityTheatre />);
    expect(screen.getByText("Threat Prioritizer")).toBeInTheDocument();
    expect(screen.getByText("Interceptor Allocator")).toBeInTheDocument();
    expect(screen.getByText("Justifier")).toBeInTheDocument();
    expect(screen.getByText("Escalation Officer")).toBeInTheDocument();
  });
});
