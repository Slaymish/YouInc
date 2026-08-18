import { test, expect } from "@playwright/test";

// The whole public surface: the project page, the demo, and three reference
// pages. Slugs are pinned to routes in frontend/src/routes and the ids in
// staticPages.tsx — keep them in step.
const REFERENCE_PAGES: ReadonlyArray<{ slug: string; heading: RegExp }> = [
  { slug: "/docs", heading: /documentation/i },
  { slug: "/help", heading: /common questions/i },
  { slug: "/privacy", heading: /privacy/i },
];

for (const page_ of REFERENCE_PAGES) {
  test(`${page_.slug} renders publicly`, async ({ page }) => {
    await page.goto(page_.slug);
    await expect(page).toHaveURL(new RegExp(`${page_.slug}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: page_.heading }),
    ).toBeVisible();
  });
}

test("header nav reaches the demo and the docs", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);

  await page.goto("/");
  await nav.getByRole("link", { name: "Demo", exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
});

test("footer exposes the docs and the source", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Docs" })).toBeVisible();
  await expect(
    footer.getByRole("link", { name: /source on github/i }),
  ).toHaveAttribute("href", /github\.com/);
});

// Everything that made this look like a product for sale, or a hosted service
// with a support desk, is gone. A 404 here is the point.
test("retired product and trust routes are gone", async ({ page }) => {
  const retired = [
    "/pricing",
    "/custom-builds",
    "/start",
    "/security",
    "/terms",
    "/status",
    "/about",
    "/contact",
    "/compare",
    "/use-cases",
    "/integrations",
    "/changelog",
    "/roadmap",
    "/data-deletion",
    "/widgets",
  ];
  for (const slug of retired) {
    const response = await page.goto(slug);
    expect(response?.status(), `${slug} should not exist`).toBe(404);
  }
});

test("no public page quotes a price or a booking link", async ({ page }) => {
  // /demo is excluded from the money-string check: it renders a sample ledger,
  // whose amounts are the whole point.
  for (const slug of ["/", "/docs", "/help", "/privacy"]) {
    await page.goto(slug);
    await expect(page.locator("body")).not.toContainText(
      /NZD \$|per month|\/mo\b|free trial|add a card/i,
    );
  }
  for (const slug of ["/", "/demo", "/docs", "/help", "/privacy"]) {
    await page.goto(slug);
    await expect(page.locator('a[href*="cal.com"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/pricing"]')).toHaveCount(0);
  }
});
