import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Header } from "@/components/Header";

describe("Header", () => {
  it("renders AG2 brand chip and scenario name", () => {
    render(<Header scenario="data-center-swarm-attack" />);
    expect(screen.getByText(/MeshShield AI/)).toBeInTheDocument();
    expect(screen.getByText(/Powered by AG2/)).toBeInTheDocument();
    expect(screen.getByText(/data-center-swarm-attack/)).toBeInTheDocument();
  });
});
