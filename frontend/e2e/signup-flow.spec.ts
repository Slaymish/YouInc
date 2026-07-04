import { test, expect } from "@playwright/test";
import http from "node:http";
import type { Server } from "node:http";

// End-to-end self-service signup → onboarding → workspace flow. This exercises
// the real Supabase Auth + create_tenant RPC path, so it needs a running local
// Supabase stack (`supabase start`). It is gated on YOUINC_E2E_SUPABASE so the
// default `pnpm test:e2e` (public-page coverage) stays green with no database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e signup-flow
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "self-service signup"
    : "self-service signup (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("signup → onboarding → create workspace → workspace home", async ({
      page,
    }) => {
      const email = `e2e-signup-${Date.now()}@example.com`;
      const password = "supersecret123";

      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Your name (optional)").fill("E2E User");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /create account/i }).click();

      // Onboarding welcome.
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();

      // Name the workspace → create_tenant RPC.
      await page.getByLabel("Workspace name").fill("E2E Holdings");
      await page.getByRole("button", { name: /create workspace/i }).click();

      // Confirmation step, then into the workspace home.
      await expect(
        page.getByRole("heading", { name: /E2E Holdings is ready/i }),
      ).toBeVisible();
      await page.getByRole("button", { name: /go to my workspace/i }).click();

      await expect(page).toHaveURL(/\/workspace$/);
      await expect(
        page.getByRole("heading", { name: "E2E Holdings" }),
      ).toBeVisible();

      // Sign out returns to the landing page, and re-visiting a gated route bounces to sign-in.
      await page.getByRole("button", { name: /sign out/i }).click();
      await expect(page).toHaveURL(/\/$/);
      await page.goto("/workspace");
      await expect(page).toHaveURL(/\/signin$/);
    });

    test("workspace tracks manual balances and computes net worth (tenant-scoped Postgres)", async ({
      page,
    }) => {
      const email = `e2e-ledger-${Date.now()}@example.com`;
      const password = "supersecret123";

      // Sign up and complete onboarding into a fresh workspace.
      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();
      await page.getByLabel("Workspace name").fill("Ledger Holdings");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);

      // Fresh tenant starts empty.
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$0.00",
      );

      // Add an asset and a (negative) liability.
      await page.getByLabel("New account path").fill("Assets:Bank:Everyday");
      await page.getByLabel("New account balance").fill("12500.00");
      await page.getByRole("button", { name: /add account/i }).click();
      await expect(page.getByText("Assets:Bank:Everyday")).toBeVisible();

      await page.getByLabel("New account path").fill("Liabilities:CreditCard");
      await page.getByLabel("New account balance").fill("-2500.00");
      await page.getByRole("button", { name: /add account/i }).click();
      await expect(page.getByText("Liabilities:CreditCard")).toBeVisible();

      // Net worth = 12,500 - 2,500 = 10,000.
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$10,000.00",
      );

      // Persists across reload (data lives in Postgres, not client state).
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$10,000.00",
      );

      // Removing the liability updates the total.
      await page
        .getByRole("row", { name: /Liabilities:CreditCard/ })
        .getByRole("button", { name: "Remove" })
        .click();
      await expect(page.getByText("Liabilities:CreditCard")).toBeHidden();
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$12,500.00",
      );
    });

    test("sample ingestion posts a double-entry ledger to the tenant (idempotent)", async ({
      page,
    }) => {
      const email = `e2e-ingest-${Date.now()}@example.com`;
      const password = "supersecret123";

      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();
      await page.getByLabel("Workspace name").fill("Ingest Co");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);

      // Run the ported pipeline over the built-in sample Akahu batch.
      await page
        .getByRole("button", { name: /load sample transactions/i })
        .click();
      await expect(
        page.getByRole("heading", { name: "Synced ledger" }),
      ).toBeVisible();

      // Settlement-dated settled txns post; the PENDING one is skipped.
      //   +5000 (salary) -1800 (rent) -89.99 (spark) -152.40 (groceries) = 2957.61
      const ledgerPanel = page.locator(".ws-panel:has(#ws-ledger-heading)");
      await expect(
        ledgerPanel.getByRole("row", { name: /Assets:Bank:Everyday/ }),
      ).toContainText("$2,957.61");
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$2,957.61",
      );

      // Idempotent: re-running does not double-count.
      await page
        .getByRole("button", { name: /load sample transactions/i })
        .click();
      await expect(page.locator(".ws-metric__value").first()).toHaveText(
        "$2,957.61",
      );
    });

    test("connect Akahu (Vault), list accounts, sync, and disconnect", async ({
      page,
    }) => {
      // Mock the Akahu API on the port the dev server's AKAHU_BASE_URL points at
      // (see playwright.config.ts). Serves one account and two settled txns.
      const mock: Server = http.createServer((req, res) => {
        res.setHeader("content-type", "application/json");
        const url = req.url ?? "";
        if (url.startsWith("/accounts/") && url.includes("/transactions")) {
          res.end(
            JSON.stringify({
              items: [
                {
                  _id: "akx_1",
                  _account: "acc_mock_1",
                  status: "SETTLED",
                  date: "2026-06-01",
                  settlement_date: "2026-06-01",
                  amount: 4200.0,
                  currency: "NZD",
                  description: "PAYROLL",
                  merchant: { name: "Employer" },
                },
                {
                  _id: "akx_2",
                  _account: "acc_mock_1",
                  status: "SETTLED",
                  date: "2026-06-02",
                  settlement_date: "2026-06-02",
                  amount: -60.0,
                  currency: "NZD",
                  description: "GROCERIES",
                  merchant: { name: "Countdown" },
                },
              ],
            }),
          );
        } else if (url.startsWith("/accounts")) {
          res.end(
            JSON.stringify({
              items: [
                { _id: "acc_mock_1", name: "Mock Everyday", status: "ACTIVE" },
              ],
            }),
          );
        } else {
          res.statusCode = 404;
          res.end("{}");
        }
      });
      await new Promise<void>((resolve) => mock.listen(59999, resolve));

      try {
        const email = `e2e-akahu-${Date.now()}@example.com`;
        await page.goto("/signup");
        await page.waitForLoadState("networkidle");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill("supersecret123");
        await page.getByRole("button", { name: /create account/i }).click();
        await expect(page).toHaveURL(/\/onboarding$/);
        await page.getByRole("button", { name: /let's go/i }).click();
        await page.getByLabel("Workspace name").fill("Akahu Co");
        await page.getByRole("button", { name: /create workspace/i }).click();
        await page.getByRole("button", { name: /go to my workspace/i }).click();
        await expect(page).toHaveURL(/\/workspace$/);

        // Connect: token is stored encrypted in Vault via the connect_akahu RPC.
        await page.getByLabel("Akahu user token").fill("user_token_mock_abc");
        await page.getByRole("button", { name: /connect akahu/i }).click();
        await expect(page.getByText(/connected to akahu/i)).toBeVisible();

        // List the authorized accounts (hits the mock /accounts).
        await page.getByRole("button", { name: /load my accounts/i }).click();
        await expect(page.getByText("Mock Everyday")).toBeVisible();

        // Sync pulls txns → ingests to Postgres. Bank balance = 4200 - 60 = 4140.
        await page
          .getByRole("listitem")
          .filter({ hasText: "Mock Everyday" })
          .getByRole("button", { name: "Sync" })
          .click();
        await expect(page.getByText(/synced 2 transactions/i)).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Synced ledger" }),
        ).toBeVisible();
        await expect(page.locator(".ws-metric__value").first()).toHaveText(
          "$4,140.00",
        );

        // Idempotent re-sync.
        await page
          .getByRole("listitem")
          .filter({ hasText: "Mock Everyday" })
          .getByRole("button", { name: "Sync" })
          .click();
        await expect(page.getByText(/2 already seen/i)).toBeVisible();

        // Disconnect removes the Vault secret and revokes the connection.
        await page.getByRole("button", { name: /disconnect/i }).click();
        await expect(page.getByText(/akahu disconnected/i)).toBeVisible();
      } finally {
        await new Promise<void>((resolve) => mock.close(() => resolve()));
      }
    });
  },
);
