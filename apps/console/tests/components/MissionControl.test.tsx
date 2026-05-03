import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MissionControl } from "@/components/MissionControl";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MissionControl", () => {
  it("renders the MISSION CONTROL heading", () => {
    render(<MissionControl />);
    expect(screen.getByText(/MISSION CONTROL/)).toBeInTheDocument();
  });

  it("renders all main control sections", () => {
    render(<MissionControl />);
    expect(screen.getByText(/PIPELINE/)).toBeInTheDocument();
    expect(screen.getByText(/POLICY GATES/)).toBeInTheDocument();
    expect(screen.getByText(/SCENARIO/)).toBeInTheDocument();
    expect(screen.getByText(/OPERATOR OVERRIDE/)).toBeInTheDocument();
  });

  function findButton(label: RegExp) {
    return screen.getAllByText(label).find(el => el.tagName === "BUTTON")!;
  }

  it("renders key buttons", () => {
    render(<MissionControl />);
    expect(findButton(/MANUAL TICK/)).toBeTruthy();
    expect(findButton(/RESET/)).toBeTruthy();
    expect(findButton(/KILL SWITCH/)).toBeTruthy();
    expect(findButton(/SPAWN ATTACK WAVE/)).toBeTruthy();
  });

  it("POSTs to /pipeline/tick when MANUAL TICK is clicked", async () => {
    render(<MissionControl />);
    fireEvent.click(findButton(/MANUAL TICK/));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/pipeline/tick"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("POSTs to /pipeline/pause when PAUSE is clicked", async () => {
    render(<MissionControl />);
    fireEvent.click(findButton(/⏸ PAUSE/));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/pipeline/pause"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("POSTs to /plan/clear when KILL SWITCH is clicked", async () => {
    render(<MissionControl />);
    fireEvent.click(findButton(/KILL SWITCH/));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/plan/clear"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("POSTs to /scenario/inject when SPAWN ATTACK WAVE is clicked", async () => {
    render(<MissionControl />);
    const waveButtons = screen.getAllByText(/SPAWN ATTACK WAVE/);
    // click the first button element (not tooltip text)
    const btn = waveButtons.find(el => el.tagName === "BUTTON") ?? waveButtons[0];
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/scenario/inject"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
