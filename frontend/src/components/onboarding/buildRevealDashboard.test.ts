import { describe, expect, it } from "vitest";
import { buildRevealDashboard } from "./buildRevealDashboard";
import type { QuizState } from "./quizModel";

const AT = "2026-07-13T00:00:00.000Z";
const state: QuizState = {
  version: 1,
  goal: "net-worth",
  entries: [
    { category: "everyday", cents: 500000 }, // +5,000 cash
    { category: "kiwisaver", cents: 4000000 }, // +40,000 semi_liquid
    { category: "mortgage", cents: 30000000 }, // -300,000 liability
  ],
};

describe("buildRevealDashboard", () => {
  it("computes net worth = assets - liabilities from the answers", () => {
    const d = buildRevealDashboard(state, AT);
    expect(d.totals.assetsCents).toBe(4500000);
    expect(d.totals.liabilitiesCents).toBe(30000000); // surfaced positive
    expect(d.totals.netWorthCents).toBe(-25500000);
  });

  it("marks the database as existing so widgets do not short-circuit", () => {
    expect(buildRevealDashboard(state, AT).databaseExists).toBe(true);
  });

  it("tags balances with NZD currency and a liquidity tier", () => {
    const d = buildRevealDashboard(state, AT);
    const everyday = d.balances.find((b) => b.account === "Assets:Bank:Everyday");
    expect(everyday?.currency).toBe("NZD");
    expect(everyday?.liquidityTier).toBe("cash");
    expect(everyday?.isManual).toBe(true);
  });

  it("sums cashCents from cash-tier assets only", () => {
    expect(buildRevealDashboard(state, AT).totals.cashCents).toBe(500000);
  });

  it("returns empty analytics collections and a null error", () => {
    const d = buildRevealDashboard(state, AT);
    expect(d.pnl).toEqual([]);
    expect(d.recentTransactions).toEqual([]);
    expect(d.error).toBeNull();
    expect(d.generatedAt).toBe(AT);
  });
});
