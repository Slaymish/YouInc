import { test, expect } from "@playwright/test";

// End-to-end coverage for the per-tenant classification-rules editor on
// /workspace (see components/workspace/RulesEditor.tsx + server/tenantRules.ts).
// Like signup-flow.spec.ts, this exercises the real Supabase Auth + Postgres
// path, so it needs a running local Supabase stack (`supabase start`) and is
// gated on YOUINC_E2E_SUPABASE so the default `pnpm test:e2e` stays green with
// no database.
//
//   YOUINC_E2E_SUPABASE=1 pnpm test:e2e rules-editor
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

test.describe(
  supabaseReady
    ? "per-tenant rules editor"
    : "per-tenant rules editor (skipped: set YOUINC_E2E_SUPABASE=1)",
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

    test("add, edit, toggle, and delete a classification rule", async ({
      page,
    }) => {
      const email = `e2e-rules-${Date.now()}@example.com`;
      await signUpIntoWorkspace(page, email, "Rules Co");

      // Classification rules live on the workspace Settings tab.
      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/workspace\/settings$/);

      const rulesPanel = page.locator(".ws-panel:has(#ws-rules-heading)");
      await expect(
        rulesPanel.getByRole("heading", { name: "Classification rules" }),
      ).toBeVisible();
      await expect(rulesPanel.getByText(/No rules yet/)).toBeVisible();

      // Only one rule ever exists in this test, so the first (only) row is a
      // stable handle across display <-> edit-form re-renders.
      const row = rulesPanel.locator("table tbody tr").first();

      // ── Add ──────────────────────────────────────────────────────────────
      await rulesPanel
        .getByRole("button", { name: "+ Add rule", exact: true })
        .click();
      await rulesPanel.getByLabel("Name").fill("Coffee Test");
      await rulesPanel.getByLabel("Route to account").fill("Expenses:Coffee");
      await rulesPanel
        .getByLabel("Description matches (regex)")
        .fill("coffee");
      await rulesPanel
        .getByRole("button", { name: "Add rule", exact: true })
        .click();

      await expect(row).toContainText("coffee_test");
      await expect(row).toContainText("Expenses:Coffee");
      await expect(row).toContainText("description ~ /coffee/");

      // ── Edit ─────────────────────────────────────────────────────────────
      await row.getByRole("button", { name: "Edit" }).click();
      await row.getByLabel("Priority").fill("50");
      await row.getByLabel("Merchant matches (regex)").fill("cafe");
      await row.getByRole("button", { name: "Save changes" }).click();

      await expect(row.locator("td").first()).toHaveText("50");
      await expect(row).toContainText("merchant ~ /cafe/");
      await expect(row).toContainText("description ~ /coffee/");

      // ── Toggle enabled ───────────────────────────────────────────────────
      await expect(row).not.toHaveClass(/rule-row--disabled/);
      await row.getByRole("button", { name: "Disable" }).click();
      await expect(row).toHaveClass(/rule-row--disabled/);
      await expect(row.getByRole("button", { name: "Enable" })).toBeVisible();

      await row.getByRole("button", { name: "Enable" }).click();
      await expect(row).not.toHaveClass(/rule-row--disabled/);

      // ── Delete ───────────────────────────────────────────────────────────
      await row.getByRole("button", { name: "Delete" }).click();
      await expect(rulesPanel.getByText(/No rules yet/)).toBeVisible();
      await expect(rulesPanel.getByText("coffee_test")).toHaveCount(0);
    });

    test("validation errors surface in the UI", async ({ page }) => {
      // Server functions (tenantRules.ts, and every other server/*.ts module)
      // now throw a catchable `ServerFnError` (server/serverError.ts) on
      // invalid input instead of `new Response(msg, { status })`. TanStack
      // Start's server-fn client treats a *thrown* Response as a raw
      // passthrough (sets `x-tss-raw: true` and resolves the call with the
      // Response object itself instead of rejecting), which used to mean
      // RulesEditor's `try { setRules(await action()) } catch { setError(...) }`
      // never reached its catch. A thrown Error is serialized into the RPC
      // result's `error` field and rejects client-side as expected, so it now
      // lands in the catch block and renders below.
      const email = `e2e-rules-invalid-${Date.now()}@example.com`;
      await signUpIntoWorkspace(page, email, "Rules Validation Co");

      const rulesPanel = page.locator(".ws-panel:has(#ws-rules-heading)");
      const alert = rulesPanel.getByRole("alert");

      await rulesPanel
        .getByRole("button", { name: "+ Add rule", exact: true })
        .click();

      // Empty name: a whitespace-only value passes the browser's `required`
      // check (it's a non-empty string) but normalizes server-side to "".
      await rulesPanel.getByLabel("Name").fill(" ");
      await rulesPanel.getByLabel("Route to account").fill("Expenses:Test");
      await rulesPanel
        .getByLabel("Description matches (regex)")
        .fill("anything");
      await rulesPanel
        .getByRole("button", { name: "Add rule", exact: true })
        .click();
      await expect(alert).toHaveText(/name/i);

      // No match condition: valid name/account, but every condition field is
      // blank.
      await rulesPanel.getByLabel("Name").fill("Valid Name");
      await rulesPanel.getByLabel("Description matches (regex)").fill("");
      await rulesPanel
        .getByRole("button", { name: "Add rule", exact: true })
        .click();
      await expect(alert).toHaveText(/match condition/i);

      // Invalid regex: unbalanced group.
      await rulesPanel
        .getByLabel("Description matches (regex)")
        .fill("(unclosed");
      await rulesPanel
        .getByRole("button", { name: "Add rule", exact: true })
        .click();
      await expect(alert).toHaveText(/regular expression/i);

      // None of the invalid submissions created a rule.
      await expect(rulesPanel.getByText(/No rules yet/)).toBeVisible();
    });
  },
);
