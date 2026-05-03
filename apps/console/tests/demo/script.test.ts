import { describe, it, expect } from "vitest";
import { DEMO_SCRIPT } from "@/lib/demo/script";

describe("DEMO_SCRIPT", () => {
  it("is non-empty", () => {
    expect(DEMO_SCRIPT.length).toBeGreaterThan(0);
  });

  it("steps are sorted ascending by at_ms", () => {
    for (let i = 1; i < DEMO_SCRIPT.length; i++) {
      expect(DEMO_SCRIPT[i].at_ms).toBeGreaterThanOrEqual(DEMO_SCRIPT[i - 1].at_ms);
    }
  });

  it("every step has positive duration_ms", () => {
    for (const step of DEMO_SCRIPT) {
      expect(step.duration_ms).toBeGreaterThan(0);
    }
  });

  it("step windows do not overlap (each starts after or at the end of the previous)", () => {
    for (let i = 1; i < DEMO_SCRIPT.length; i++) {
      const prev = DEMO_SCRIPT[i - 1];
      const curr = DEMO_SCRIPT[i];
      expect(curr.at_ms).toBeGreaterThanOrEqual(prev.at_ms + prev.duration_ms);
    }
  });

  it("each step has a non-empty title and body", () => {
    for (const step of DEMO_SCRIPT) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it("nlip action step has a non-empty question", () => {
    const nlipSteps = DEMO_SCRIPT.filter((s) => s.action?.kind === "ask_nlip");
    expect(nlipSteps.length).toBeGreaterThanOrEqual(1);
    for (const step of nlipSteps) {
      expect(step.action?.question?.length).toBeGreaterThan(0);
    }
  });
});
