import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@meshshield/protocol": path.resolve(__dirname, "../../packages/protocol/ts/src/index.ts"),
      "@deck.gl/react": path.resolve(__dirname, "tests/__mocks__/deck-gl-react.ts"),
      "@deck.gl/layers": path.resolve(__dirname, "tests/__mocks__/deck-gl-layers.ts"),
      "react-map-gl/maplibre": path.resolve(__dirname, "tests/__mocks__/react-map-gl-maplibre.ts"),
      "@meshshield/scenarios/assets/osm-datacenter.geojson": path.resolve(__dirname, "tests/__mocks__/osm-datacenter.ts"),
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] },
});
