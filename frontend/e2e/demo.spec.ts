import { test, expect } from "@playwright/test";

// The demo is the application on sample data, so this spec is also the only
// runnable coverage of the app shell, the nav, Home's headline figures, the
// analysis boards and the sorting task — everything else that renders them is
// behind a Supabase session.

test("the demo opens on Home with the headline figures", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const figure = (label: string) =>
    page.locator(
      `.home-metric:has(.home-metric__label:text-is("${label}")) .home-metric__value`,
    );
  for (const label of ["Net worth", "Cash", "Monthly spend", "Runway"]) {
    await expect(figure(label)).toBeVisible();
  }
  // The brief is the headline, not a card in a grid.
  await expect(page.locator(".home-headline__line")).not.toBeEmpty();
});

test("every figure can show its working", async ({ page }) => {
  await page.goto("/demo");
  const netWorth = page.locator(
    '.home-metric:has(.home-metric__label:text-is("Net worth"))',
  );
  await netWorth.getByRole("button", { name: /why is net worth/i }).click();
  const panel = netWorth.locator(".explainer__panel");
  await expect(panel).toContainText("Everything you own");
  // The last line says what the number means, not what the word means.
  await expect(panel.locator(".explainer__line--point")).toContainText(
    "settled up today",
  );
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("the nav reaches every everyday page, and hides the workshop", async ({
  page,
}) => {
  await page.goto("/demo");
  const nav = page.getByRole("navigation", { name: "Sections" });

  for (const [label, path] of [
    ["Spending", "/demo/spending"],
    ["Net worth", "/demo/net-worth"],
    ["Activity", "/demo/activity"],
    ["Accounts", "/demo/accounts"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
  }

  // The ledger's machinery is not part of the everyday layer.
  await expect(nav.getByRole("link", { name: "Workshop" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("the accounts screen asks you to run your own copy", async ({ page }) => {
  await page.goto("/demo/accounts");
  const install = page.getByRole("heading", {
    name: /this is where you'd connect your bank/i,
  });
  await expect(install).toBeVisible();
  await expect(
    page.getByRole("link", { name: /how to set it up/i }),
  ).toHaveAttribute("href", /\/docs$/);
  // No bank connection on a page with no ledger behind it.
  await expect(page.getByRole("button", { name: /connect with akahu/i })).toHaveCount(0);
});

test("sorting a transaction is one tap, and undoable", async ({ page }) => {
  await page.goto("/demo/activity");
  const card = page.locator(".sort-card").first();
  await expect(card).toBeVisible();
  const description = (await card.locator("strong").first().innerText()).trim();

  const before = await page.locator(".sort-card").count();
  await card.locator(".sort-choice").first().click();

  // The row goes immediately; the undo window opens with it.
  await expect(page.locator(".sort-card")).toHaveCount(before - 1);
  const toast = page.locator(".toast").first();
  await expect(toast).toContainText(`Sorted ${description}`);

  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".sort-card")).toHaveCount(before);
  await expect(page.locator(".sort-card").first()).toContainText(description);
});

test("transactions read as a plain list, with no debits or credits", async ({
  page,
}) => {
  await page.goto("/demo/activity");
  const list = page.locator(".txn-list");
  await expect(list.locator(".txn-row").first()).toBeVisible();
  await expect(list).not.toContainText(/debit|credit|SUSPENSE/i);
});

test("the analysis pages render their boards", async ({ page }) => {
  await page.goto("/demo/spending");
  await expect(page.locator(".dashboard-grid section.panel").first()).toBeVisible();
  await expect(
    page.locator(".metric-inner:has(p:text-is('Monthly spend')) strong"),
  ).toBeVisible();

  await page.goto("/demo/net-worth");
  await expect(
    page.locator("section.panel:has(h2:text-is('Net Worth Trend'))"),
  ).toBeVisible();
});

// Regression guard for the light soft-UI shadows that leaked onto the dark app:
// the dark tokens hang off `:root[data-theme="dark"]`, so if <html> ever loses
// the attribute the surfaces stay dark (`.ws-ledger-shell` remaps colour by
// hand) while every var(--soft-*) silently falls back to the light stack.
test("the document resolves the dark token set, not the light one", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const { raised, scheme } = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      raised: style.getPropertyValue("--soft-raised"),
      scheme: style.colorScheme,
    };
  });
  expect(scheme).toBe("dark");
  // The light stack's tell is an 0.8-opacity white halo; dark's is barely there.
  expect(raised).not.toContain("rgba(255, 255, 255, 0.8)");
  expect(raised).toContain("rgba(0, 0, 0, 0.55)");
});
