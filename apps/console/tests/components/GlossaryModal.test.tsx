import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { GlossaryModal, GLOSSARY_TERMS } from "@/components/GlossaryModal";

describe("GlossaryModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<GlossaryModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all glossary terms when open", () => {
    render(<GlossaryModal open onClose={vi.fn()} />);
    // Title contains "Glossary"
    expect(screen.getAllByText(/Glossary/i).length).toBeGreaterThan(0);
    // Every term should be visible
    for (const { term } of GLOSSARY_TERMS) {
      expect(screen.getByText(term)).toBeInTheDocument();
    }
  });

  it(`has exactly ${GLOSSARY_TERMS.length} terms`, () => {
    render(<GlossaryModal open onClose={vi.fn()} />);
    // Count rows in the table body
    const rows = screen.getAllByRole("row");
    // subtract 1 for the thead row
    expect(rows.length - 1).toBe(GLOSSARY_TERMS.length);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<GlossaryModal open onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/close glossary/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when footer close button is clicked", () => {
    const onClose = vi.fn();
    render(<GlossaryModal open onClose={onClose} />);
    fireEvent.click(screen.getByText(/Close glossary/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("contains plain-English explanation for Track", () => {
    render(<GlossaryModal open onClose={vi.fn()} />);
    expect(screen.getByText(/drone the system has detected/i)).toBeInTheDocument();
  });

  it("contains plain-English explanation for Kinetic", () => {
    render(<GlossaryModal open onClose={vi.fn()} />);
    expect(screen.getByText(/physically intercepting/i)).toBeInTheDocument();
  });
});
