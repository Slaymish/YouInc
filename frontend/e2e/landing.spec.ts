import { test, expect } from "@playwright/test";

test("landing page describes the project and points at the demo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const demoCta = page
    .getByRole("link", { name: /open the demo/i })
    .first();
  await expect(demoCta).toHaveAttribute("href", /\/demo$/);
  await demoCta.click();
  await expect(page).toHaveURL(/\/demo$/);
});

// The public surface is a demo plus docs. Nothing here is sold, and nothing
// solicits: no price, no booking link, no support chat, no feedback prompt.
test("landing page carries no product surface", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).not.toContainText(
    /NZD \$|per month|\/mo\b|free trial|add a card|book a call/i,
  );
  await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /ask hamish/i }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(
    /did you find what you needed/i,
  );
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

test("the demo runs without a session", async ({ page }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
