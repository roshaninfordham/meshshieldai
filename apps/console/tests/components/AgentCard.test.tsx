import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AgentCard } from "@/components/AgentCard";

describe("AgentCard", () => {
  it("renders the agent name, AG2 chip, and model badge when active", () => {
    render(<AgentCard name="prioritizer" label="Threat Prioritizer" model="gemini-2.5-flash"
                       state="thinking" tools={[]} />);
    expect(screen.getByText("Threat Prioritizer")).toBeInTheDocument();
    expect(screen.getByText(/AG2/)).toBeInTheDocument();
    expect(screen.getByText(/gemini-2.5-flash/)).toBeInTheDocument();
  });

  it("renders tool chips with running and done states", () => {
    render(<AgentCard name="allocator" label="Interceptor Allocator" model="gemini-2.5-flash"
                       state="tool_calling"
                       tools={[
                         { tool:"simulate_intercept_path", state:"running" },
                         { tool:"list_available_interceptors", state:"done", ms: 12 }]} />);
    expect(screen.getByText(/simulate_intercept_path/)).toBeInTheDocument();
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
  });

  it("renders usesLabel chip when provided", () => {
    render(<AgentCard name="justifier" label="Justifier" model="gemini-2.5-flash"
                       state="idle" tools={[]}
                       usesLabel="Tavily news API · policy clauses" />);
    expect(screen.getByText(/Tavily news API · policy clauses/)).toBeInTheDocument();
    expect(screen.getByText(/USES:/)).toBeInTheDocument();
  });

  it("does not render usesLabel chip when not provided", () => {
    render(<AgentCard name="prioritizer" label="Threat Prioritizer" model="gemini-2.5-flash"
                       state="idle" tools={[]} />);
    expect(screen.queryByText(/USES:/)).not.toBeInTheDocument();
  });
});
