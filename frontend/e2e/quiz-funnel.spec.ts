import { test, expect } from "@playwright/test";

test("/start renders the goal question publicly (no auth)", async ({ page }) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/start$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /what are you trying to get a handle on/i }),
  ).toBeVisible();
});

test("quiz flows goal → balances → reveal with the user's own numbers", async ({ page }) => {
  await page.goto("/start");
  const goal = page.getByRole("button", { name: /know my true net worth/i });
  await expect(goal).toBeVisible();
  // SSR page: the first click can land before React hydration attaches handlers.
  // Retry selecting the goal until the first balance screen actually appears.
  await expect(async () => {
    if (await goal.isVisible().catch(() => false)) await goal.click();
    await expect(
      page.getByRole("heading", { level: 1, name: /everyday account/i }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
  // First balance screen (everyday): type an exact amount, then advance.
  await page.getByLabel(/type it exactly/i).fill("5000");
  await page.getByRole("button", { name: /^next$/i }).click();
  // Skip the remaining categories to reach the reveal.
  for (let i = 0; i < 8; i++) {
    const skip = page.getByRole("button", { name: /i don't have this/i });
    if (await skip.isVisible().catch(() => false)) await skip.click();
  }
  // Net worth = the single $5,000 everyday balance (no liabilities).
  await expect(page.locator(".reveal__networth")).toHaveText("$5,000.00");
  await expect(page.getByRole("link", { name: /save your picture/i })).toHaveAttribute(
    "href",
    /\/signup/,
  );
});

test("pricing table links visitors into the quiz, not signup", async ({ page }) => {
  await page.goto("/pricing");
  const startLinks = page.locator('a[href="/start"]');
  await expect(startLinks.first()).toBeVisible();
  // The old direct-to-signup primary CTA should no longer be the entry point.
  await expect(page.locator('.start-free a[href="/signup"]')).toHaveCount(0);
});
