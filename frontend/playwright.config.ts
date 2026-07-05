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
      // OAuth connect creds. The authorize endpoint is also the mock server
      // above (never hits the real oauth.akahu.nz) — see the `/authorize`
      // handler in signup-flow.spec.ts's mock — and the token exchange lands
      // on the same mock server via AKAHU_BASE_URL.
      AKAHU_APP_SECRET: "app_secret_e2e",
      AKAHU_OAUTH_REDIRECT_URI: "http://localhost:3000/api/akahu/callback",
      AKAHU_OAUTH_AUTHORIZE_URL: "http://127.0.0.1:59999/authorize",
    },
  },
});
