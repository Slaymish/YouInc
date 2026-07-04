import type { WidgetId } from "../dashboard/widgets";

// Read-widget allowlist for the authenticated /workspace dashboard (see
// server/workspaceDashboard.ts). Unlike DEMO_WIDGET_IDS (public,
// unauthenticated /demo), /workspace IS authenticated, so the exclusion
// reason there (mutation widgets would 401) does not apply here — this list
// is scoped for a different reason: only include widgets whose data
// getWorkspaceDashboard() actually populates.
//
// Phase 1: totals.{incomeCents,expensesCents,ebitdaCents,ebitdaMargin,
// averageMonthlyIncomeCents,monthlyOverheadCents,runwayMonths,cashCents,
// creditLimitCents,creditHeadroomCents,availableLiquidityCents,
// netWorthCents,assetsCents,liabilitiesCents}, creditFacilities,
// balances[].liquidityTier.
//
// Phase 2+3 (added here): pnl[], incomeBreakdown[]/expenseBreakdown[],
// recentTransactions[], netWorthTrend[], categoryMonthly[], dailySpend[],
// recurringPayments[] — see the derive.ts pure functions each widget below
// reads (monthPulse, netWorthVelocity, incomeConcentration,
// cashflowWaterfall, spendingAnomalies, spendCalendar, rollingAverages,
// runwayProjection) and JournalWidget/RecurringWidget/*BreakdownWidget.
//
// Still excluded: widgets needing pipeline/routing/suspense-queue health
// (attention, ledger-confidence, suspense-queue, ingestion, source-systems)
// or session-gated mutation widgets (manual-accounts) — no per-tenant
// equivalent yet (Phase 4).
export const WORKSPACE_WIDGET_IDS: WidgetId[] = [
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "metric-assets",
  "metric-liabilities",
  "metric-available-liquidity",
  "liquidity",
  "credit-facility",
  "control-brief",
  "asset-mix",
  "month-pulse",
  "operating-statement",
  "journal",
  "net-worth-trend",
  "net-worth-velocity",
  "runway-projection",
  "expense-breakdown",
  "income-breakdown",
  "income-concentration",
  "cashflow-waterfall",
  "spending-anomalies",
  "spend-calendar",
  "rolling-burn",
  "recurring",
];
