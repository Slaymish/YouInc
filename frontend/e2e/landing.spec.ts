import { test, expect } from "@playwright/test";

test("landing hero renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("book-a-call links to the scheduler in a new tab", async ({ page }) => {
  await page.goto("/");
  const bookLink = page.getByRole("link", { name: "Book a call" }).first();
  await expect(bookLink).toHaveAttribute("href", /cal\.com|calendly\.com/);
  await expect(bookLink).toHaveAttribute("target", "_blank");
});

test("hero 'Start free' CTA routes to the signup flow", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const cta = page
    .locator(".hero .start-free")
    .getByRole("link", { name: /start free/i });
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /create your youinc account/i,
    }),
  ).toBeVisible();
  // The signup form collects the essentials for self-service onboarding.
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("signup page links back to sign-in and to the demo", async ({ page }) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute("href", /\/signin$/);
  await expect(
    page.getByRole("link", { name: /open the live demo/i }),
  ).toBeVisible();
});

test("public demo renders the real dashboard shell without auth", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/); // not redirected to /login
  // Same system-shell chrome as the authed /dashboard, not the old flat demo board.
  await expect(
    page.getByRole("heading", { name: "Entity Control" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Net Worth Trend", exact: true }),
  ).toBeVisible();
  // Full dashboard interactivity — tabs, customize/drag/resize — is available on sample data.
  await expect(
    page.getByRole("navigation", { name: "Dashboard views" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize" })).toBeVisible();
});

test("public demo's widget picker hides session-gated mutation widgets", async ({
  page,
}) => {
  await page.goto("/demo");
  // DashboardGrid is a client component; clicking before hydration attaches
  // handlers is a no-op (see the waitlist-signup test above for the same
  // pre-hydration pitfall). Wait for the network to settle first.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Customize" }).click();
  await page.getByRole("button", { name: "+ Add widget" }).click();
  await expect(
    page.getByRole("button", { name: "Ingestion", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Manual Accounts", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Source Systems", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Suspense Queue", exact: true }),
  ).toHaveCount(0);
});
