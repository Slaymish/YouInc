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
// Phase 2+3: pnl[], incomeBreakdown[]/expenseBreakdown[],
// recentTransactions[], netWorthTrend[], categoryMonthly[], dailySpend[],
// recurringPayments[] — see the derive.ts pure functions each widget below
// reads (monthPulse, netWorthVelocity, incomeConcentration,
// cashflowWaterfall, spendingAnomalies, spendCalendar, rollingAverages,
// runwayProjection) and JournalWidget/RecurringWidget/*BreakdownWidget.
//
// Phase 4 (added here): pipeline[]/routing[]/suspenseQueue[] are now real
// (workspaceSuspenseMath.ts / workspacePipeline.ts), so `attention` and
// `ledger-confidence` (pure presentational — read only the `dashboard` prop)
// and the new tenant-scoped `suspense-queue` (has its own resolve mutation,
// tenantReclassify.ts) are safe to include.
//
// Still excluded: `ingestion` / `source-systems` (no per-tenant sourceAccounts
// yet) and `manual-accounts` (rendered directly on the /workspace route, not
// through the grid).
export const WORKSPACE_WIDGET_IDS: WidgetId[] = [
  "attention",
  "ledger-confidence",
  "suspense-queue",
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
