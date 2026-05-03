import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Map3D } from "@/components/Map3D";
import { useMeshStore } from "@/lib/store";

vi.mock("@deck.gl/react", () => ({ default: ({ children }: any) => <div data-testid="dg">{children}</div> }));
vi.mock("react-map-gl/maplibre", () => ({ Map: ({ children }: any) => <div data-testid="map">{children}</div> }));

describe("Map3D", () => {
  it("renders a map container even with no tracks", () => {
    useMeshStore.setState((useMeshStore as any).getInitialState());
    render(<Map3D />);
    expect(screen.getByTestId("dg")).toBeInTheDocument();
  });
});
