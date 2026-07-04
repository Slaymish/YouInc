import { describe, expect, it } from "vitest";
import { computeWorkspacePnlTotals } from "./workspacePnlMath";

describe("computeWorkspacePnlTotals", () => {
  it("matches the shared income-statement math and derives runway from assets", () => {
    const totals = computeWorkspacePnlTotals(
      [
        { month: "2026-06", account: "Income:Salary", amountCents: 500_000 },
        {
          month: "2026-06",
          account: "Expenses:Housing:Rent",
          amountCents: -180_000,
        },
        {
          month: "2026-06",
          account: "Expenses:Software",
          amountCents: -8_999,
        },
        {
          month: "2026-06",
          account: "Expenses:Groceries",
          amountCents: -15_240,
        },
      ],
      295_761,
    );

    expect(totals.incomeCents).toBe(500_000);
    expect(totals.expensesCents).toBe(204_239);
    expect(totals.ebitdaCents).toBe(295_761);
    expect(totals.ebitdaMargin).toBeCloseTo(295_761 / 500_000);
    expect(totals.averageMonthlyIncomeCents).toBe(500_000);
    expect(totals.monthlyOverheadCents).toBe(204_239);
    expect(totals.runwayMonths).toBeCloseTo(295_761 / 204_239, 4);
  });

  it("returns a null runway when there is no monthly overhead yet", () => {
    const totals = computeWorkspacePnlTotals([], 100_000);
    expect(totals.incomeCents).toBe(0);
    expect(totals.monthlyOverheadCents).toBe(0);
    expect(totals.runwayMonths).toBeNull();
  });

  it("only nets rows whose account is namespaced Income:/Expenses:", () => {
    const totals = computeWorkspacePnlTotals(
      [
        { month: "2026-06", account: "Income:Salary", amountCents: 100_000 },
        { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: 100_000 },
      ],
      50_000,
    );
    expect(totals.incomeCents).toBe(100_000);
  });
});
