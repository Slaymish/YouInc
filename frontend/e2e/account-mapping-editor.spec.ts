import { test, expect } from "@playwright/test";

// End-to-end coverage for the per-tenant Akahu account -> ledger account
// mapping editor on /workspace (see
// components/workspace/AccountMappingEditor.tsx + server/accountMappings.ts).
// Like rules-editor.spec.ts, this exercises the real Supabase Auth + Postgres
// path, so it needs a running local Supabase stack (`supabase start`) and is
// gated on YOUINC_E2E_SUPABASE so the default `pnpm test:e2e` stays green with
// no database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e account-mapping-editor
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "account mapping editor"
    : "account mapping editor (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    async function signUpIntoWorkspace(
      page: import("@playwright/test").Page,
      email: string,
      workspaceName: string,
    ) {
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
      await page.getByLabel("Workspace name").fill(workspaceName);
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);
    }

    test("add, edit, and delete an account mapping (free-text account id)", async ({
      page,
    }) => {
      const email = `e2e-mapping-${Date.now()}@example.com`;
      await signUpIntoWorkspace(page, email, "Mapping Co");

      const panel = page.locator(".ws-panel:has(#ws-account-mappings-heading)");
      await expect(
        panel.getByRole("heading", { name: "Account mappings" }),
      ).toBeVisible();
      await expect(panel.getByText(/No account mappings yet/)).toBeVisible();

      // Only one mapping ever exists in this test, so the first (only) row is
      // a stable handle across display <-> edit-form re-renders.
      const row = panel.locator("table tbody tr").first();

      // ── Add (asset, no credit limit field) ──────────────────────────────
      await panel
        .getByRole("button", { name: "+ Add mapping", exact: true })
        .click();
      await panel.getByLabel("Akahu account").fill("acc_mock_checking");
      await panel.getByLabel("Ledger account").fill("Assets:Bank:Everyday");
      await panel
        .getByRole("button", { name: "Add mapping", exact: true })
        .click();

      await expect(row).toContainText("acc_mock_checking");
      await expect(row).toContainText("Assets:Bank:Everyday");
      await expect(row).toContainText("asset");

      // ── Edit: switch to liability + set a credit limit ──────────────────
      await row.getByRole("button", { name: "Edit" }).click();
      await row.getByLabel("Ledger account").fill("Liabilities:CreditCard");
      await row.getByLabel("Account type").selectOption("liability");
      await row.getByLabel("Credit limit (optional)").fill("5000");
      await row.getByRole("button", { name: "Save changes" }).click();

      await expect(row).toContainText("Liabilities:CreditCard");
      await expect(row).toContainText("liability");
      await expect(row).toContainText("$5,000.00");

      // ── Delete ───────────────────────────────────────────────────────────
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(panel.getByText(/No account mappings yet/)).toBeVisible();
      await expect(panel.getByText("acc_mock_checking")).toHaveCount(0);
    });

    test("validation errors surface in the UI", async ({ page }) => {
      const email = `e2e-mapping-invalid-${Date.now()}@example.com`;
      await signUpIntoWorkspace(page, email, "Mapping Validation Co");

      const panel = page.locator(".ws-panel:has(#ws-account-mappings-heading)");
      const alert = panel.getByRole("alert");

      await panel
        .getByRole("button", { name: "+ Add mapping", exact: true })
        .click();

      // Empty ledger account (not namespaced).
      await panel.getByLabel("Akahu account").fill("acc_x");
      await panel.getByLabel("Ledger account").fill("Checking");
      await panel
        .getByRole("button", { name: "Add mapping", exact: true })
        .click();
      await expect(alert).toHaveText(/namespaced/i);

      // None of the invalid submissions created a mapping.
      await expect(panel.getByText(/No account mappings yet/)).toBeVisible();
    });
  },
);
