import { test, expect } from "@playwright/test";

test("invalid confirmation token redirects to /signin", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalid-token&type=email");
  await expect(page).toHaveURL(/\/signin/);
});

test("missing token redirects to /signin", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/\/signin/);
});
