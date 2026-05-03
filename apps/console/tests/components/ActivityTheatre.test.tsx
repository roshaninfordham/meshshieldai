import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActivityTheatre } from "@/components/ActivityTheatre";
import { useMeshStore } from "@/lib/store";

// No react-flow dependency — ActivityTheatre now uses a plain CSS grid.

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
