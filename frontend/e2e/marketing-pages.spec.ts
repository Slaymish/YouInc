import { test, expect } from "@playwright/test";

test("custom-builds page loads publicly", async ({ page }) => {
  await page.goto("/custom-builds");
  await expect(page).toHaveURL(/\/custom-builds$/); // not redirected to /login
  await expect(
    page.getByRole("heading", { level: 1, name: /get your own finance engineer/i }),
  ).toBeVisible();
  // Pricing anchor is consistent with config.ts PRICING.
  await expect(page.getByText("NZD $1,500")).toBeVisible();
  await expect(page.getByText("From NZD $149")).toBeVisible();
});

test("widgets page loads publicly and renders live widgets", async ({ page }) => {
  await page.goto("/widgets");
  await expect(page).toHaveURL(/\/widgets$/); // not redirected to /login
  await expect(
    page.getByRole("heading", { level: 1, name: /every widget, running live/i }),
  ).toBeVisible();
  // A live widget rendered from the registry on sample data.
  await expect(
    page.getByRole("heading", { name: "Net Worth Trend", exact: true }),
  ).toBeVisible();
});

test("landing nav reaches both new pages", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Widgets", exact: true }).click();
  await expect(page).toHaveURL(/\/widgets$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/");
  await nav.getByRole("link", { name: "Custom builds", exact: true }).click();
  await expect(page).toHaveURL(/\/custom-builds$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("pricing nav link scrolls to the landing pricing section from a subpage", async ({
  page,
}) => {
  await page.goto("/custom-builds");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/#pricing-heading$/);
  await expect(page.locator("#pricing-heading")).toBeInViewport();
});

test("session-gated widgets show placeholders, not live forms, on /widgets", async ({
  page,
}) => {
  await page.goto("/widgets");
  // All four gated widgets appear as designed placeholders...
  await expect(page.getByText("Connects to your live account")).toHaveCount(4);
  for (const label of ["Ingestion", "Manual Accounts", "Source Systems", "Suspense Queue"]) {
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
  // ...and none of their live mutation controls are rendered.
  await expect(page.getByRole("button", { name: "Sync" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /add account/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /classify/i })).toHaveCount(0);
});
