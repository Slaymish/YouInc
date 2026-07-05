import { test, expect } from "@playwright/test";

// Reproducing a genuinely unconfirmed Supabase account isn't feasible against
// the local dev stack: `supabase/config.toml` sets `enable_confirmations =
// false` for local dev (see frontend/CLAUDE.md — "local ... has
// enable_confirmations = false, so signUp returns a live session"), so
// `signInWithPassword` never surfaces `email_not_confirmed` there — that
// enforcement only kicks in against a project with confirmations turned on
// (production). Flipping the flag locally would also break every other e2e
// spec that depends on signUp returning an immediate session
// (signup-flow.spec.ts and friends run in the same shared local stack).
//
// Instead, this test intercepts the browser's request to Supabase's
// `/auth/v1/token` endpoint and returns the exact error shape GoTrue sends
// for an unconfirmed account (`error_code: "email_not_confirmed"` — see
// @supabase/auth-js's error-codes.ts for the installed SDK version), so the
// real client-side path (signInWithPassword -> classifyAuthError -> resend
// UI in routes/signin.tsx) runs end-to-end in a real browser against the
// real app, with only the backend response stubbed.
test("signin with an unconfirmed account shows the resend option", async ({
  page,
}) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: 400,
        error_code: "email_not_confirmed",
        msg: "Email not confirmed",
      }),
    });
  });

  await page.goto("/signin");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("unverified@example.com");
  await page.getByLabel("Password").fill("supersecret123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/isn't verified yet/i)).toBeVisible();
  // Match loosely on "resend" rather than the full label: once clicked, the
  // button's accessible name changes to a "Resend available in Ns" cooldown
  // label, and Playwright locators re-resolve by name at assertion time.
  const resendButton = page.getByRole("button", { name: /resend/i });
  await expect(resendButton).toHaveText(/resend verification email/i);
  await expect(resendButton).toBeEnabled();
  // The generic error paragraph must not also render for this case.
  await expect(page.locator(".auth-error")).toHaveCount(0);

  // Resending hits the sibling GoTrue endpoint; stub success and confirm the
  // UI reflects it (confirmation message + cooldown disabling the button).
  await page.route("**/auth/v1/resend", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
  await resendButton.click();
  await expect(page.getByText(/verification email sent/i)).toBeVisible();
  await expect(resendButton).toBeDisabled();
  await expect(resendButton).toHaveText(/resend available in \d+s/i);
});

test("signin with the wrong password still shows the generic error (no regression)", async ({
  page,
}) => {
  await page.route("**/auth/v1/token?grant_type=password", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      }),
    });
  });

  await page.goto("/signin");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill("someone@example.com");
  await page.getByLabel("Password").fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /resend/i })).toHaveCount(0);
});
