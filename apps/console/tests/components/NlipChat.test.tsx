import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMeshStore } from "@/lib/store";
import { NlipChat } from "@/components/NlipChat";

describe("NlipChat", () => {
  beforeEach(() => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
  });

  it("sends a question and renders the answer with citations as chips", async () => {
    const ask = vi.fn().mockResolvedValue("T-13 conf=0.43 [snapshot.tracks[0].conf] [clause:auto_action_min_conf]");
    render(<NlipChat client={{ ask, close: () => {} }} />);
    fireEvent.change(screen.getByPlaceholderText(/Ask Watch Commander/), { target: { value: "Why ignore T-13?" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText(/T-13 conf=0.43/)).toBeInTheDocument());
    expect(screen.getByText("[snapshot.tracks[0].conf]")).toBeInTheDocument();
    expect(screen.getByText("[clause:auto_action_min_conf]")).toBeInTheDocument();
  });

  it("shows messages pushed from the store (e.g. by demo controller)", () => {
    useMeshStore.setState((s) => ({
      ...s,
      nlipMsgs: [
        { role: "you", text: "Why was T-001 assigned?" },
        { role: "wc",  text: "T-001 was assigned [plan-abc] because high conf." },
      ],
    }));
    render(<NlipChat client={{ ask: vi.fn(), close: () => {} }} />);
    expect(screen.getByText(/Why was T-001 assigned/)).toBeInTheDocument();
    expect(screen.getByText(/T-001 was assigned/)).toBeInTheDocument();
  });
});
