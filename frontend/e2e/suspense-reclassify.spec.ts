import { test, expect } from "@playwright/test";

// End-to-end coverage for Phase 4 of the DashboardGrid port onto the
// authenticated /workspace: pipeline/routing health + the suspense queue +
// reclassify (see server/workspaceDashboard.ts, workspaceSuspenseMath.ts,
// workspacePipeline.ts, tenantReclassify.ts, components/widgets/
// SuspenseQueueWidget.tsx). Like workspace-dashboard.spec.ts and
// rules-editor.spec.ts, this exercises the real Supabase Auth + Postgres
// path, so it needs a running local Supabase stack (`supabase start`) and is
// gated on YOUINC_E2E_SUPABASE so the default `pnpm test:e2e` stays green
// with no database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e suspense-reclassify
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "suspense queue + reclassify (Phase 4)"
    : "suspense queue + reclassify (Phase 4) (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("pipeline/routing health is non-placeholder, and reclassifying resolves the queued item", async ({
      page,
    }) => {
      const email = `e2e-suspense-${Date.now()}@example.com`;

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
      await page.getByLabel("Workspace name").fill("Suspense Co");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);

      const dashboardSection = page.locator(".ws-dashboard-section");
      await expect(
        dashboardSection.getByRole("heading", { name: "Dashboard" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Load sample transactions" }).click();
      // Wait for the load to land before switching tabs (Net Worth is
      // Phase-1 populated data — a stable "it landed" signal).
      await expect(
        dashboardSection.locator(".metric-inner:has(p:text-is('Net Worth')) strong"),
      ).toHaveText("$2,917.61");

      // ── "Books" tab: pipeline/routing health + the suspense queue ───────
      await dashboardSection.getByRole("button", { name: "Books", exact: true }).click();

      // The sample batch's one deliberately-unmatched transaction (ATM
      // withdrawal, see sampleIngestion.ts) routes to suspense: 5 posted
      // transactions, 1 unresolved => 80% classification, not the 0/"n/a"
      // placeholder the dashboard showed before Phase 4.
      const confidencePanel = dashboardSection.locator(
        "section.panel:has(h2:text-is('Ledger Confidence'))",
      );
      await expect(confidencePanel.locator("strong").first()).toHaveText("80%");
      await expect(confidencePanel).toContainText("Suspense");
      await expect(confidencePanel).toContainText("$40.00");

      const queuePanel = dashboardSection.locator(
        "section.panel:has(h2:text-is('Suspense Queue'))",
      );
      await expect(queuePanel.locator(".queue-summary strong")).toHaveText("1");
      await expect(queuePanel).toContainText("ATM WITHDRAWAL QUEEN STREET");
      await expect(queuePanel).toContainText("Out");
      await expect(queuePanel).toContainText("$40.00");

      // ── Resolve the one queued item via reclassify ──────────────────────
      const queueItem = queuePanel.locator(".queue-item");
      await queueItem.getByRole("combobox").selectOption({ label: "+ New category…" });
      await queueItem.getByRole("textbox").fill("Expenses:Cash");
      await queueItem.getByRole("button", { name: "Resolve" }).click();

      await expect(queuePanel).toContainText("ALL CLASSIFIED");
      await expect(queuePanel).not.toContainText("ATM WITHDRAWAL QUEEN STREET");

      // ── Reload: confirm the resolution is a real, persisted correction
      // transaction (workspaceDashboard.ts recomputes from Postgres on every
      // load), not just optimistic client state.
      await page.reload();
      await expect(page).toHaveURL(/\/workspace$/);
      const reloadedDashboard = page.locator(".ws-dashboard-section");
      await reloadedDashboard.getByRole("button", { name: "Books", exact: true }).click();

      const reloadedConfidence = reloadedDashboard.locator(
        "section.panel:has(h2:text-is('Ledger Confidence'))",
      );
      await expect(reloadedConfidence.locator("strong").first()).toHaveText("100%");

      const reloadedQueue = reloadedDashboard.locator(
        "section.panel:has(h2:text-is('Suspense Queue'))",
      );
      await expect(reloadedQueue).toContainText("ALL CLASSIFIED");
    });
  },
);
