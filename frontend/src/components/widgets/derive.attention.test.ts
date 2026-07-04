import { describe, expect, it } from "vitest";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { buildAttentionItems } from "./derive";

const NOW = new Date("2026-06-30T00:00:00Z");

/** A healthy, all-clear dashboard. Tests override only what they exercise. */
function baseDashboard(): LedgerDashboardData {
  return {
    databasePath: "/tmp/ledger.sqlite3",
    databaseExists: true,
    generatedAt: NOW.toISOString(),
    manualBalances: [],
    totals: {
      netWorthCents: 5_000_00,
      assetsCents: 6_000_00,
      liabilitiesCents: 1_000_00,
      assetLiabilityRatio: 6,
      incomeCents: 8_000_00,
      expensesCents: 5_000_00,
      ebitdaCents: 3_000_00,
      ebitdaMargin: 0.375,
      averageMonthlyIncomeCents: 8_000_00,
      monthlyOverheadCents: 5_000_00,
      runwayMonths: 12,
      transactionCount: 100,
      rawTransactionCount: 100,
      cashCents: 3_000_00,
      creditHeadroomCents: 0,
      creditLimitCents: 0,
      availableLiquidityCents: 3_000_00,
    },
    balances: [],
    creditFacilities: [],
    pnl: [],
    incomeBreakdown: [],
    expenseBreakdown: [],
    suspenseQueue: [],
    netWorthTrend: [],
    recentTransactions: [],
    recurringPayments: [],
    categoryMonthly: [],
    dailySpend: [],
    pipeline: {
      rawCached: 100,
      posted: 100,
      pending: 0,
      zeroAmount: 0,
      unprocessed: 0,
      earliestTransactionDate: "2026-01-01",
      latestTransactionDate: "2026-06-29",
      lastSeenAt: "2026-06-29T12:00:00Z",
    },
    sourceAccounts: [],
    knownAccounts: [],
    routing: {
      journalCount: 100,
      customRuleCount: 10,
      nzfccFallbackCount: 0,
      suspenseCount: 0,
      suspenseCents: 0,
      classificationRate: 1,
    },
    syncState: [],
    error: null,
  };
}

/**
 * categoryMonthly with a varied-but-modest history then a spike in the latest
 * month. Prior months must vary so the category has a non-zero standard
 * deviation — otherwise the z-score is undefined and no anomaly is flagged.
 */
function spikingCategory(): LedgerDashboardData["categoryMonthly"] {
  const account = "Expenses:Food:Groceries";
  return [
    { month: "2026-03", account, amountCents: 80_00 },
    { month: "2026-04", account, amountCents: 100_00 },
    { month: "2026-05", account, amountCents: 120_00 },
    { month: "2026-06", account, amountCents: 300_00 },
  ];
}

describe("buildAttentionItems", () => {
  it("returns no items for a healthy, decision-grade ledger", () => {
    expect(buildAttentionItems(baseDashboard(), NOW)).toEqual([]);
  });

  it("returns only a critical no-database row when the ledger is missing", () => {
    const dashboard = { ...baseDashboard(), databaseExists: false };
    const items = buildAttentionItems(dashboard, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "no-database", severity: "critical" });
  });

  it("flags suspense items as an action with the right count and target", () => {
    const dashboard = baseDashboard();
    dashboard.routing.suspenseCount = 3;
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "suspense",
    );
    expect(item).toMatchObject({ severity: "action", targetView: "books" });
    expect(item?.label).toContain("3");
    expect(item?.label).toContain("transactions");
  });

  it("flags low runway as critical and routes to wealth", () => {
    const dashboard = baseDashboard();
    dashboard.totals.runwayMonths = 2.8;
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "runway",
    );
    expect(item).toMatchObject({ severity: "critical", targetView: "wealth" });
  });

  it("flags tightening runway as a review note, not critical", () => {
    const dashboard = baseDashboard();
    dashboard.totals.runwayMonths = 5;
    const items = buildAttentionItems(dashboard, NOW);
    expect(items.find((i) => i.id === "runway")).toBeUndefined();
    expect(items.find((i) => i.id === "runway-warn")).toMatchObject({
      severity: "review",
    });
  });

  it("flags a stale sync once past the threshold", () => {
    const dashboard = baseDashboard();
    dashboard.pipeline.lastSeenAt = "2026-06-20T00:00:00Z"; // 10 days
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "stale-sync",
    );
    expect(item).toMatchObject({ severity: "action" });
    expect(item?.label).toContain("10");
  });

  it("does not flag a recent sync", () => {
    const items = buildAttentionItems(baseDashboard(), NOW);
    expect(items.find((i) => i.id === "stale-sync")).toBeUndefined();
  });

  it("flags unmapped source accounts and ignores configured ones", () => {
    const dashboard = baseDashboard();
    dashboard.sourceAccounts = [
      { mappingStatus: "unmapped" },
      { mappingStatus: "configured" },
    ] as LedgerDashboardData["sourceAccounts"];
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "unmapped",
    );
    expect(item).toMatchObject({ severity: "action", targetView: "books" });
    expect(item?.label).toContain("1");
  });

  it("summarizes spending anomalies as one review row to cash flow", () => {
    const dashboard = baseDashboard();
    dashboard.categoryMonthly = spikingCategory();
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "anomalies",
    );
    expect(item).toMatchObject({ severity: "review", targetView: "cash-flow" });
    expect(item?.label).toContain("Groceries");
  });

  it("flags a newly started recurring commitment", () => {
    const dashboard = baseDashboard();
    dashboard.recurringPayments = [
      {
        description: "Streaming Co",
        account: "Expenses:Subscriptions",
        amountCents: 20_00,
        occurrences: 2,
        cadenceDays: 30,
        cadence: "monthly",
        monthlyEquivalentCents: 20_00,
        firstDate: "2026-06-10",
        lastDate: "2026-06-29",
      },
    ];
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "new-recurring",
    );
    expect(item).toMatchObject({ severity: "review", targetView: "cash-flow" });
    expect(item?.label).toContain("Streaming Co");
  });

  it("ignores long-standing recurring payments", () => {
    const dashboard = baseDashboard();
    dashboard.recurringPayments = [
      {
        description: "Old Gym",
        account: "Expenses:Health",
        amountCents: 50_00,
        occurrences: 12,
        cadenceDays: 30,
        cadence: "monthly",
        monthlyEquivalentCents: 50_00,
        firstDate: "2025-01-10",
        lastDate: "2026-06-10",
      },
    ];
    const items = buildAttentionItems(dashboard, NOW);
    expect(items.find((i) => i.id === "new-recurring")).toBeUndefined();
  });

  it("flags a credit facility above the utilization threshold", () => {
    const dashboard = baseDashboard();
    dashboard.creditFacilities = [
      {
        account: "Liabilities:CreditCard:Amex",
        accountId: "acc_amex",
        limitCents: 500_00,
        drawnCents: 400_00,
        headroomCents: 100_00,
        utilization: 0.8,
      },
    ];
    const item = buildAttentionItems(dashboard, NOW).find(
      (i) => i.id === "credit-utilization",
    );
    expect(item).toMatchObject({ severity: "review", targetView: "wealth" });
    expect(item?.label).toContain("Amex");
  });

  it("does not flag a facility well under the utilization threshold", () => {
    const dashboard = baseDashboard();
    dashboard.creditFacilities = [
      {
        account: "Liabilities:CreditCard:Amex",
        accountId: "acc_amex",
        limitCents: 500_00,
        drawnCents: 50_00,
        headroomCents: 450_00,
        utilization: 0.1,
      },
    ];
    const items = buildAttentionItems(dashboard, NOW);
    expect(items.find((i) => i.id === "credit-utilization")).toBeUndefined();
  });

  it("orders items critical → action → review", () => {
    const dashboard = baseDashboard();
    dashboard.totals.runwayMonths = 2; // critical
    dashboard.routing.suspenseCount = 4; // action
    dashboard.categoryMonthly = spikingCategory(); // review
    const severities = buildAttentionItems(dashboard, NOW).map(
      (i) => i.severity,
    );
    expect(severities).toEqual(
      [...severities].sort((a, b) => {
        const rank = { critical: 0, action: 1, review: 2 } as const;
        return rank[a] - rank[b];
      }),
    );
    expect(severities[0]).toBe("critical");
  });
});
