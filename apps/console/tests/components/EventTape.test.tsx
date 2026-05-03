import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EventTape } from "@/components/EventTape";
import { useMeshStore, applyAgentEvent } from "@/lib/store";

describe("EventTape", () => {
  it("renders most recent events newest-first", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    applyAgentEvent({ kind: "stage_started", agent: "prioritizer", ts: 1 } as any);
    applyAgentEvent({ kind: "plan_ready", plan_id: "p-1", ts: 2 } as any);
    render(<EventTape />);
    const items = screen.getAllByTestId("event-row");
    expect(items[0]).toHaveTextContent("plan_ready");
    expect(items[1]).toHaveTextContent("stage_started");
  });
});
