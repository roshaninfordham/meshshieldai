import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "node ./e2e/fixtures/fake-fusion-and-agent.mjs & next dev -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: { baseURL: "http://localhost:3000" },
});
