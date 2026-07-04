import { test, expect } from "@playwright/test";

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
  },
);
