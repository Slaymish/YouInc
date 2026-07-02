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

test("waitlist signup succeeds and offers the demo", async ({ page }) => {
  await page.goto("/");
  // This is a client component: the SSR'd HTML is interactive-looking before
  // React has hydrated and attached the form's onSubmit handler. Clicking too
  // early falls through to the browser's native (unhandled) form submission
  // instead of the intercepted serverFn call. Wait for the network to settle
  // — a reliable proxy for hydration completing on this page — before typing.
  await page.waitForLoadState("networkidle");
  const form = page.locator(".hero .waitlist-form");
  await form.getByPlaceholder("you@email.com").fill("e2e@example.com");
  await form.getByRole("button", { name: /start free/i }).click();
  await expect(page.getByText(/you're on the list/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open the live demo/i })).toBeVisible();
});

test("public demo renders real widgets without auth and hides mutation controls", async ({ page }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/demo$/); // not redirected to /login
  await expect(page.getByRole("heading", { name: "Net Worth", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize" })).toHaveCount(0);
});
