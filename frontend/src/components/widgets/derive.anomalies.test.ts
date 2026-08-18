import { describe, expect, it } from "vitest";
import type { CategoryMonthPoint } from "~/server/analytics";
import { spendingAnomalies } from "./derive";

/** Four months of one category's spend: three prior months, then the latest. */
function series(
  account: string,
  priorValuesCents: [number, number, number],
  currentCents: number,
): CategoryMonthPoint[] {
  const months = ["2026-03", "2026-04", "2026-05", "2026-06"];
  return [...priorValuesCents, currentCents].map((amountCents, index) => ({
    account,
    month: months[index],
    amountCents,
  }));
}

describe("spendingAnomalies", () => {
  it("flags an upward anomaly when the latest month spikes above prior history", () => {
    const categoryMonthly = series(
      "Expenses:Food:Groceries",
      [80_00, 100_00, 120_00],
      300_00,
    );

    const result = spendingAnomalies(categoryMonthly);

    expect(result.hasEnoughHistory).toBe(true);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0]).toMatchObject({
      account: "Expenses:Food:Groceries",
      direction: "above",
      meanCents: 100_00,
    });
    expect(result.anomalies[0].z).toBeGreaterThan(0);
    expect(result.anomalies[0].deltaCents).toBe(200_00);
  });

  it("flags a downward anomaly when the latest month drops below prior history", () => {
    const categoryMonthly = series(
      "Expenses:Food:Dining",
      [120_00, 100_00, 80_00],
      0,
    );

    const result = spendingAnomalies(categoryMonthly);

    expect(result.hasEnoughHistory).toBe(true);
    expect(result.anomalies).toHaveLength(1);
    expect(result.anomalies[0]).toMatchObject({
      account: "Expenses:Food:Dining",
      direction: "below",
      meanCents: 100_00,
    });
    expect(result.anomalies[0].z).toBeLessThan(0);
    expect(result.anomalies[0].deltaCents).toBe(-100_00);
  });

  it("returns both directions together, sorted by magnitude rather than raw z", () => {
    // A: weak upward anomaly, just over the threshold.
    const weakOverspend = series(
      "Expenses:Subscriptions",
      [95_00, 100_00, 105_00],
      107_00,
    );
    // B: strong downward anomaly, far bigger in magnitude than A.
    const strongUnderspend = series(
      "Expenses:Travel",
      [300_00, 280_00, 320_00],
      100_00,
    );

    const result = spendingAnomalies([...weakOverspend, ...strongUnderspend]);

    expect(result.anomalies).toHaveLength(2);
    // Strong downward anomaly leads despite its negative z — a naive
    // `b.z - a.z` sort would wrongly put the weak overspend first.
    expect(result.anomalies[0].account).toBe("Expenses:Travel");
    expect(result.anomalies[0].direction).toBe("below");
    expect(result.anomalies[1].account).toBe("Expenses:Subscriptions");
    expect(result.anomalies[1].direction).toBe("above");
    expect(Math.abs(result.anomalies[0].z)).toBeGreaterThan(
      Math.abs(result.anomalies[1].z),
    );
  });

  it("reports insufficient history when fewer than MIN_PRIOR_MONTHS+1 months exist", () => {
    const account = "Expenses:Food:Groceries";
    const categoryMonthly: CategoryMonthPoint[] = [
      { account, month: "2026-04", amountCents: 100_00 },
      { account, month: "2026-05", amountCents: 110_00 },
      { account, month: "2026-06", amountCents: 300_00 },
    ];

    const result = spendingAnomalies(categoryMonthly);

    expect(result.hasEnoughHistory).toBe(false);
    expect(result.anomalies).toEqual([]);
    expect(result.month).toBe("2026-06");
  });

  it("skips a category with zero standard deviation in its prior history", () => {
    const categoryMonthly = series(
      "Expenses:Rent",
      [100_00, 100_00, 100_00],
      500_00,
    );

    const result = spendingAnomalies(categoryMonthly);

    expect(result.hasEnoughHistory).toBe(true);
    expect(result.anomalies).toEqual([]);
  });
});
