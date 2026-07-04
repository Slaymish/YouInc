import { test, expect } from "@playwright/test";

test("custom-builds page loads publicly", async ({ page }) => {
  await page.goto("/custom-builds");
  await expect(page).toHaveURL(/\/custom-builds$/); // not redirected to /login
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /get your own finance engineer/i,
    }),
  ).toBeVisible();
  // Pricing anchor is consistent with config.ts PRICING.
  await expect(page.getByText("NZD $1,500")).toBeVisible();
  await expect(page.getByText("From NZD $149")).toBeVisible();
});

test("widgets page loads publicly and renders live widgets", async ({
  page,
}) => {
  await page.goto("/widgets");
  await expect(page).toHaveURL(/\/widgets$/); // not redirected to /login
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /every widget, running live/i,
    }),
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

test("pricing nav link routes to the dedicated pricing comparison page from a subpage", async ({
  page,
}) => {
  await page.goto("/custom-builds");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Pricing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /every plan, every detail/i }),
  ).toBeVisible();
});

// v1 trust/resource/company pages. Slugs are pinned to the routes in
// frontend/src/routes/*.tsx and the ids in staticPages.tsx — keep them stable.
const STATIC_PAGES: ReadonlyArray<{ slug: string; heading: RegExp }> = [
  { slug: "/privacy", heading: /privacy policy/i },
  { slug: "/terms", heading: /terms of service/i },
  { slug: "/security", heading: /security at youinc/i },
  { slug: "/data-deletion", heading: /export, disconnect, and delete/i },
  { slug: "/contact", heading: /talk to a real person/i },
  { slug: "/docs", heading: /documentation/i },
  { slug: "/help", heading: /help and support/i },
  { slug: "/integrations", heading: /integrations/i },
  { slug: "/status", heading: /system status/i },
  { slug: "/changelog", heading: /changelog/i },
  { slug: "/roadmap", heading: /roadmap/i },
  { slug: "/about", heading: /founder-led finance software/i },
  { slug: "/compare", heading: /how youinc is different/i },
  { slug: "/use-cases", heading: /what people use youinc for/i },
];

for (const { slug, heading } of STATIC_PAGES) {
  test(`static page ${slug} loads publicly`, async ({ page }) => {
    await page.goto(slug);
    // Public: not redirected to /login.
    await expect(page).toHaveURL(new RegExp(`${slug}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
  });
}

test("footer trust links are discoverable and route correctly", async ({
  page,
}) => {
  await page.goto("/");
  const trustNav = page.getByRole("navigation", { name: "Trust" });
  for (const [name, url] of [
    ["Security", /\/security$/],
    ["Privacy", /\/privacy$/],
    ["Terms", /\/terms$/],
    ["Data deletion", /\/data-deletion$/],
    ["Status", /\/status$/],
  ] as const) {
    await page.goto("/");
    // Wait for hydration so the click drives the client router rather than
    // landing before handlers attach (which no-ops and leaves us on "/").
    await page.waitForLoadState("networkidle");
    await trustNav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("header exposes docs and security to visitors", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Docs", exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /documentation/i }),
  ).toBeVisible();

  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await nav.getByRole("link", { name: "Security", exact: true }).click();
  await expect(page).toHaveURL(/\/security$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /security at youinc/i }),
  ).toBeVisible();
});

test("session-gated widgets show placeholders, not live forms, on /widgets", async ({
  page,
}) => {
  await page.goto("/widgets");
  // All four gated widgets appear as designed placeholders...
  await expect(page.getByText("Connects to your live account")).toHaveCount(4);
  for (const label of [
    "Ingestion",
    "Manual Accounts",
    "Source Systems",
    "Suspense Queue",
  ]) {
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
  // ...and none of their live mutation controls are rendered.
  await expect(page.getByRole("button", { name: "Sync" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /add account/i })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /classify/i })).toHaveCount(0);
});
