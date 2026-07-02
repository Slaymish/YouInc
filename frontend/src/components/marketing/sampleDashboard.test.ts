import { describe, expect, it } from "vitest";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";

const isInt = (n: number) => Number.isInteger(n);

describe("SAMPLE_DASHBOARD", () => {
  it("looks like a populated ledger (widgets have data to render)", () => {
    expect(SAMPLE_DASHBOARD.databaseExists).toBe(true);
    expect(SAMPLE_DASHBOARD.error).toBeNull();
    expect(SAMPLE_DASHBOARD.balances.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.pnl.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.netWorthTrend.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.expenseBreakdown.length).toBeGreaterThan(0);
    expect(SAMPLE_DASHBOARD.dailySpend.length).toBeGreaterThan(0);
  });

  it("keeps the net-worth identity and integer cents", () => {
    const t = SAMPLE_DASHBOARD.totals;
    expect(t.netWorthCents).toBe(t.assetsCents - t.liabilitiesCents);
    expect(isInt(t.netWorthCents)).toBe(true);
    expect(SAMPLE_DASHBOARD.balances.every((b) => isInt(b.balanceCents))).toBe(true);
    expect(SAMPLE_DASHBOARD.dailySpend.every((d) => isInt(d.spendCents))).toBe(true);
  });
});
