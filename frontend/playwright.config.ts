import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Point the app at the mock Akahu server the signup-flow spec starts on
      // :59999. Harmless when the Akahu test is skipped (no server listening).
      AKAHU_APP_TOKEN: "app_token_e2e",
      AKAHU_BASE_URL: "http://127.0.0.1:59999",
    },
  },
});
