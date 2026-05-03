import { render, screen, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useMeshStore } from "@/lib/store";
import type { DemoStep } from "@/lib/demo/script";
import { DemoNarration } from "@/components/DemoNarration";

const MOCK_STEP: DemoStep = {
  at_ms: 0,
  duration_ms: 4000,
  title: "📡 SENSORS LIVE",
  body: "Synthetic airspace tracks streaming at 10 Hz.",
  poweredBy: "📡 Open scenario data — replays a 30s drone-attack JSON file",
  highlight: "map",
};

describe("DemoNarration", () => {
  beforeEach(() => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
  });

  it("renders nothing when no step is active", () => {
    const { container } = render(<DemoNarration />);
    expect(container.textContent).toBe("");
  });

  it("renders current step title and body when store has an active step", () => {
    useMeshStore.setState((s) => ({
      ...s,
      demo: { active: true, currentStep: MOCK_STEP, highlight: "map" },
    }));
    render(<DemoNarration />);
    expect(screen.getByText(MOCK_STEP.title)).toBeInTheDocument();
    expect(screen.getByText(MOCK_STEP.body)).toBeInTheDocument();
  });

  it("renders poweredBy footer when step has poweredBy", () => {
    useMeshStore.setState((s) => ({
      ...s,
      demo: { active: true, currentStep: MOCK_STEP, highlight: "map" },
    }));
    render(<DemoNarration />);
    expect(screen.getByText(/POWERED BY:/)).toBeInTheDocument();
    expect(screen.getByText(/Open scenario data/)).toBeInTheDocument();
  });

  it("hides the card when the step is cleared", async () => {
    useMeshStore.setState((s) => ({
      ...s,
      demo: { active: true, currentStep: MOCK_STEP, highlight: "map" },
    }));
    const { rerender } = render(<DemoNarration />);
    expect(screen.getByText(MOCK_STEP.title)).toBeInTheDocument();

    await act(async () => {
      useMeshStore.setState((s) => ({
        ...s,
        demo: { active: false, currentStep: null, highlight: "none" },
      }));
      rerender(<DemoNarration />);
    });
    // Framer Motion AnimatePresence runs exit animations — the element may linger briefly.
    // The key assertion is that the store cleared the step (tested via store.test.ts).
    // Here we verify the component re-renders without the step data visible
    // after Zustand state clears it.
    await waitFor(() => {
      expect(screen.queryByText(MOCK_STEP.title)).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
