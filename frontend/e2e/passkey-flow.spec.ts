import { test, expect, type Page } from "@playwright/test";

// Passkey golden paths for the multi-step auth redesign. These need:
//   * a running local Supabase stack (`supabase start`), and
//   * the dev server started with SUPABASE_SERVICE_ROLE_KEY set (the passkey
//     registration insert + the passkey→session bridge use the service role).
// Gated on YOUINC_E2E_SUPABASE like signup-flow.spec.ts so the default
// public-page e2e run stays green with no database.
//
//   YOUINC_E2E_SUPABASE=1 SUPABASE_SERVICE_ROLE_KEY=... pnpm test:e2e passkey-flow
const supabaseReady = process.env.YOUINC_E2E_SUPABASE === "1";

/** Attach a virtual platform authenticator with a resident key + auto user
 * verification, so the WebAuthn ceremonies complete without real hardware. */
async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  const { authenticatorId } = await client.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return { client, authenticatorId };
}

test.describe(
  supabaseReady
    ? "passkey auth"
    : "passkey auth (skipped: set YOUINC_E2E_SUPABASE=1)",
  () => {
    test.skip(!supabaseReady, "requires a running local Supabase stack");

    test("expired/invalid flow token redirects back to step 1", async ({
      page,
    }) => {
      // A bogus flow token → get_auth_flow returns null → the step loader
      // redirects to step 1 with the "that link expired" notice (never a hard
      // error).
      await page.goto(
        "/signup/name?flow=00000000-0000-0000-0000-000000000000",
      );
      await expect(page).toHaveURL(/\/signup\?notice=expired$/);
      await expect(page.getByText(/that link expired/i)).toBeVisible();
    });

    test("signup with a passkey (dev), then sign in with it", async ({
      page,
    }) => {
      await addVirtualAuthenticator(page);
      const email = `e2e-passkey-${Date.now()}@example.com`;

      // --- Signup via passkey ---
      await page.goto("/signup");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: /continue/i }).click();
      // Skip the optional name step.
      await page.getByRole("button", { name: /continue/i }).click();
      // Create the passkey (virtual authenticator answers the ceremony).
      await page.getByRole("button", { name: /create a passkey/i }).click();

      // Dev has confirmations off → live session → straight to onboarding.
      await expect(page).toHaveURL(/\/onboarding$/);
      await page.getByRole("button", { name: /let's go/i }).click();
      await page.getByLabel("Workspace name").fill("Passkey Co");
      await page.getByRole("button", { name: /create workspace/i }).click();
      await page.getByRole("button", { name: /go to my workspace/i }).click();
      await expect(page).toHaveURL(/\/workspace$/);

      // --- Sign out ---
      await page.getByRole("button", { name: /sign out/i }).click();
      await expect(page).toHaveURL(/\/$/);

      // --- Sign in via passkey ---
      await page.goto("/signin");
      await page.waitForLoadState("networkidle");
      // Conditional-UI autofill may complete the sign-in on its own; otherwise
      // drive the explicit "Continue with passkey" button on step 2.
      const alreadyIn = await page
        .waitForURL(/\/onboarding|\/workspace/, { timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!alreadyIn) {
        await page.getByLabel("Email").fill(email);
        await page.getByRole("button", { name: /continue/i }).click();
        await page
          .getByRole("button", { name: /continue with passkey/i })
          .click();
      }

      await expect(page).toHaveURL(/\/onboarding|\/workspace/);
    });
  },
);
