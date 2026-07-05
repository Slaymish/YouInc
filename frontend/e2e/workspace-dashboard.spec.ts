import { test, expect } from "@playwright/test";

// End-to-end coverage for Phase 1 of the DashboardGrid port onto the
// authenticated /workspace (see server/workspaceDashboard.ts +
// components/workspace/workspaceWidgetIds.ts). Like rules-editor.spec.ts and
// signup-flow.spec.ts, this exercises the real Supabase Auth + Postgres path,
// so it needs a running local Supabase stack (`supabase start`) and is gated
// on YOUINC_E2E_SUPABASE so the default `pnpm test:e2e` stays green with no
// database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e workspace-dashboard
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "workspace dashboard (Phase 1)"
    : "workspace dashboard (Phase 1) (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("renders the Phase-1 widgets with computed values after loading sample data", async ({
      page,
    }) => {
      const email = `e2e-dashboard-${Date.now()}@example.com`;

      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill("supersecret123");
      await page.getByRole("button", { name: /create account/i }).click();
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();
      await page.getByLabel("Workspace name").fill("Dashboard Co");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);

      const dashboardSection = page.locator(".ws-dashboard-section");
      await expect(
        dashboardSection.getByRole("heading", { name: "Dashboard" }),
      ).toBeVisible();

      // Before any data, the grid still renders (all Phase-1 fields are
      // zero/empty) — the default "This Week" tab's metrics all read zero.
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Net Worth')) strong"),
      ).toHaveText("$0.00");

      await page
        .getByRole("button", { name: "Load sample transactions" })
        .click();
      // The sample batch nets to a single asset account with no configured
      // credit facility: $5,000 salary − $1,800 rent − $89.99 software −
      // $152.40 groceries − $40 unclassified ATM withdrawal = $2,917.61, all
      // in one month. The ATM withdrawal deliberately matches no rule, so it
      // posts to the tenant's suspense account (see sampleIngestion.ts) —
      // that's the one item the suspense-reclassify e2e spec resolves.
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Net Worth')) strong"),
      ).toHaveText("$2,917.61");

      // ── "This Week" tab (default): control-brief + 4 P&L metrics ────────
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Burn / Mo')) strong"),
      ).toHaveText("$2,082.39");
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Margin')) strong"),
      ).toHaveText("58.4%");
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Runway')) strong"),
      ).toHaveText("1.4m");
      // Runway (1.4 months) is below the 3-month threshold, so the control
      // brief should flag it rather than reporting a surplus.
      await expect(dashboardSection.locator(".brief")).toContainText(
        "Runway below threshold",
      );

      // ── "Wealth" tab: liquidity, credit facilities, asset mix ───────────
      // exact: true avoids ambiguity with the Action Center's per-item
      // "Wealth →" navigation button (AttentionWidget), now that Phase 4
      // enables `attention` on /workspace.
      await dashboardSection.getByRole("button", { name: "Wealth", exact: true }).click();
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Assets')) strong"),
      ).toHaveText("$2,917.61");
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Liabilities')) strong"),
      ).toHaveText("$0.00");
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Available Liquidity')) strong"),
      ).toHaveText("$2,917.61");

      const liquidityPanel = dashboardSection.locator("section.panel:has(h2:text-is('Cash Position'))");
      await expect(
        liquidityPanel.locator(".liquidity-row--primary .liquidity-value"),
      ).toHaveText("$2,917.61");

      // The sample account mapping has no credit_limit_cents, so this is a
      // genuinely populated (not merely empty-by-omission) empty state.
      const creditPanel = dashboardSection.locator("section.panel:has(h2:text-is('Credit Facilities'))");
      await expect(creditPanel).toContainText("NO CREDIT FACILITIES CONFIGURED");

      const assetMixPanel = dashboardSection.locator("section.panel:has(h2:text-is('Asset Mix'))");
      await expect(assetMixPanel).toContainText("Cash");
      await expect(assetMixPanel).toContainText("100%");
    });
  },
);
