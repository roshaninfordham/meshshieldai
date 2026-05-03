import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@meshshield/protocol": path.resolve(__dirname, "../../packages/protocol/ts/src/index.ts"),
    },
  },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"] },
});
