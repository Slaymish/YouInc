import { describe, expect, it } from "vitest";
import { headlineMetrics } from "./headlineMetrics";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

// Only the fields headlineMetrics and explainMetric read; the rest of the
// payload is irrelevant here and stubbing it whole would obscure the point.
// Metric ids match the widget registry so the card and the headline share one
// explainer (metricExplainers.ts).
const dashboard = {
  pnl: [{ month: "2026-07" }, { month: "2026-08" }],
  totals: {
    netWorthCents: 18422000,
    assetsCents: 20000000,
    liabilitiesCents: 1578000,
    cashCents: 1241000,
    expensesCents: 836000,
    monthlyOverheadCents: 418000,
    runwayMonths: 47.8,
  },
} as unknown as LedgerDashboardData;

describe("headlineMetrics", () => {
  it("shows the working for net worth in real figures", () => {
    // Act
    const [netWorth] = headlineMetrics(dashboard);

    // Assert
    expect(netWorth.value).toBe("$184,220.00");
    expect(netWorth.explainer[2]).toBe("$200,000.00 − $15,780.00 = $184,220.00");
    expect(netWorth.explainer.at(-1)).toMatch(/settled up today/);
  });

  it("divides spend by the months actually on record", () => {
    // Act
    const spend = headlineMetrics(dashboard).find((m) => m.id === "metric-burn");

    // Assert
    expect(spend?.explainer[0]).toContain("across 2 months");
    expect(spend?.explainer[1]).toBe("$8,360.00 ÷ 2 = $4,180.00");
  });

  it("says runway counts everything you own, because the maths does", () => {
    // Act
    const runway = headlineMetrics(dashboard).find((m) => m.id === "metric-runway");

    // Assert
    expect(runway?.value).toBe("47.8m");
    expect(runway?.explainer[0]).toContain("Everything you own");
    expect(runway?.explainer.at(-1)).toMatch(/sold what you own/);
  });

  it("explains an empty runway instead of showing arithmetic on nothing", () => {
    // Arrange
    const empty = {
      ...dashboard,
      totals: { ...dashboard.totals, runwayMonths: null },
    } as unknown as LedgerDashboardData;

    // Act
    const runway = headlineMetrics(empty).find((m) => m.id === "metric-runway");

    // Assert
    expect(runway?.value).toBe("n/a");
    expect(runway?.explainer[0]).toMatch(/no spending on record/);
  });
});
