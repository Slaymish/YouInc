import { test, expect } from "@playwright/test";

// End-to-end coverage of the signed-in pages: Home's headline figures, and the
// cards that moved onto Spending, Net worth and Accounts when the single
// dashboard grid was split up. Like rules-editor.spec.ts and
// signup-flow.spec.ts, this exercises the real Supabase Auth + Postgres path,
// so it needs a running local Supabase stack (`supabase start`) and is gated
// on YOUINC_E2E_SUPABASE so the default `pnpm test:e2e` stays green with no
// database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e workspace-dashboard
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "app pages"
    : "app pages (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("computes the figures across Home, Net worth, Accounts and Spending", async ({
      page,
    }) => {
      const email = `e2e-dashboard-${Date.now()}@example.com`;

      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: /continue/i }).click();
      // Step 2: name (optional) — skip straight through.
      await page.getByRole("button", { name: /continue/i }).click();
      // Step 3: choose the password branch instead of creating a passkey.
      await page.getByRole("link", { name: /use a password instead/i }).click();
      await page.getByLabel("Password", { exact: true }).fill("supersecret123");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();
      await page.getByLabel("Workspace name").fill("Dashboard Co");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/app$/);

      // Home leads with the four figures, not a grid of cards.
      const figure = (label: string) =>
        page.locator(`.home-metric:has(.home-metric__label:text-is("${label}")) .home-metric__value`);

      await expect(figure("Net worth")).toHaveText("$0.00");

      await page.getByRole("button", { name: "Load sample transactions" }).click();

      // The sample batch nets to a single asset account with no configured
      // credit facility: $5,000 salary − $1,800 rent − $89.99 software −
      // $152.40 groceries − $40 unclassified ATM withdrawal = $2,917.61, all in
      // one month. The ATM withdrawal deliberately matches no rule (see
      // sampleIngestion.ts), so it waits on Activity to be categorised.
      await expect(figure("Net worth")).toHaveText("$2,917.61");
      await expect(figure("Monthly spend")).toHaveText("$2,082.39");
      await expect(figure("Runway")).toHaveText("1.4m");

      // Runway under three months, so the headline flags it rather than
      // reporting a surplus. The single unsorted item is under
      // SUSPENSE_MINOR_THRESHOLD, so the categories branch doesn't pre-empt it.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Cash is running low",
      );
      await expect(page.locator(".home-headline__line")).toContainText(
        "1.4m of cash left",
      );

      // Sorting is the one thing that needs a person, so it earns a row.
      await expect(page.locator(".home-needs")).toContainText("category");

      // ── Net worth: the wealth cards ─────────────────────────────────────
      await page.getByRole("link", { name: "Net worth" }).click();
      await expect(page).toHaveURL(/\/app\/net-worth$/);
      await expect(
        page.locator(".metric-inner:has(p:text-is('Net Worth')) strong"),
      ).toHaveText("$2,917.61");
      await expect(
        page.locator(".metric-inner:has(p:text-is('Assets')) strong"),
      ).toHaveText("$2,917.61");
      await expect(
        page.locator(".metric-inner:has(p:text-is('Liabilities')) strong"),
      ).toHaveText("$0.00");
      const assetMix = page.locator("section.panel:has(h2:text-is('Asset Mix'))");
      await expect(assetMix).toContainText("Cash");
      await expect(assetMix).toContainText("100%");

      // ── Accounts: what the money is sitting in ──────────────────────────
      await page.getByRole("link", { name: "Accounts" }).click();
      await expect(page).toHaveURL(/\/app\/accounts$/);
      // text-is is exact, so the short "Cash" label matches only this panel.
      const cashPanel = page.locator("section.panel:has(h2:text-is('Cash'))");
      await expect(
        cashPanel.locator(".liquidity-row--primary .liquidity-value"),
      ).toHaveText("$2,917.61");
      // The sample mapping has no credit_limit_cents, so this is a genuinely
      // populated empty state rather than one that is empty by omission.
      const creditPanel = page.locator(
        "section.panel:has(h2:text-is('Credit Facilities'))",
      );
      await expect(creditPanel).toContainText(
        "No credit cards or overdrafts set up.",
      );

      // ── Spending: the P&L metrics ───────────────────────────────────────
      await page.getByRole("link", { name: "Spending" }).click();
      await expect(page).toHaveURL(/\/app\/spending$/);
      await expect(
        page.locator(".metric-inner:has(p:text-is('Monthly spend')) strong"),
      ).toHaveText("$2,082.39");
      await expect(
        page.locator(".metric-inner:has(p:text-is('Savings rate')) strong"),
      ).toHaveText("58.4%");
    });
  },
);
