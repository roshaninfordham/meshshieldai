import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NlipChat } from "@/components/NlipChat";

describe("NlipChat", () => {
  it("sends a question and renders the answer with citations as chips", async () => {
    const ask = vi.fn().mockResolvedValue("T-13 conf=0.43 [snapshot.tracks[0].conf] [clause:auto_action_min_conf]");
    render(<NlipChat client={{ ask, close: () => {} }} />);
    fireEvent.change(screen.getByPlaceholderText(/Ask Watch Commander/), { target: { value: "Why ignore T-13?" } });
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText(/T-13 conf=0.43/)).toBeInTheDocument());
    expect(screen.getByText("[snapshot.tracks[0].conf]")).toBeInTheDocument();
    expect(screen.getByText("[clause:auto_action_min_conf]")).toBeInTheDocument();
  });
});
