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
    ? "the sorting task"
    : "the sorting task (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("one tap sorts a transaction, and the correction persists", async ({
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
      await expect(page).toHaveURL(/\/app$/);

      // Loading the sample batch is a Home action; net worth landing is the
      // stable "it's in" signal.
      await page.getByRole("button", { name: "Load sample transactions" }).click();
      await expect(
        page.locator('.home-metric:has(.home-metric__label:text-is("Net worth")) .home-metric__value'),
      ).toHaveText("$2,917.61");

      // ── Activity: the one thing the rules couldn't place ─────────────────
      await page.getByRole("link", { name: "Activity" }).click();
      await expect(page).toHaveURL(/\/app\/activity$/);

      const task = page.locator(".sort-task");
      await expect(task.locator(".sort-task__count")).toHaveText(
        "1 thing needs a category",
      );
      const card = task.locator(".sort-card");
      await expect(card).toContainText("ATM WITHDRAWAL QUEEN STREET");
      await expect(card).toContainText("$40.00");

      // No suggestion fits a cash withdrawal, so take the long way.
      await card.getByRole("button", { name: "Something else" }).click();
      await card.getByRole("textbox").fill("Expenses:Cash");
      await card.getByRole("button", { name: "Sort it" }).click();

      // The row leaves at once and the undo window opens. Dismissing the toast
      // closes that window, which is what commits the correction — so the test
      // doesn't have to wait out the timer.
      await expect(page.getByText(/Sorted ATM WITHDRAWAL QUEEN STREET/i)).toBeVisible();
      await page.getByRole("button", { name: "Dismiss notification" }).click();
      await expect(page.locator(".sort-done__line")).toHaveText("All sorted.");

      // ── Reload: the correction is a real posted transaction, not optimistic
      // client state (workspaceDashboard.ts recomputes from Postgres on every
      // load).
      await page.reload();
      await expect(page).toHaveURL(/\/app\/activity$/);
      await expect(page.locator(".sort-done__line")).toHaveText("All sorted.");
      await expect(page.locator(".txn-list")).toContainText(
        "ATM WITHDRAWAL QUEEN STREET",
      );
      await expect(page.locator(".txn-list")).not.toContainText("needs a category");
    });
  },
);
