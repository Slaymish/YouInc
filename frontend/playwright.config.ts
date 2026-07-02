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
    env: { YOUINC_LEADS_DB_PATH: "./.e2e-leads.sqlite3" },
  },
});
