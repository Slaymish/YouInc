import type { WidgetId } from "../dashboard/widgets";

// Every registered widget. All of them only read the `dashboard` prop (the
// old SQLite-mutation widgets — ingestion / manual-accounts / source-systems
// / suspense-queue — were removed along with the retired single-tenant
// `/dashboard` and `server/ledger.ts`), so it's safe to offer all of them on
// /demo — this is the `allowedWidgetIds` passed to DashboardGrid.
export const DEMO_WIDGET_IDS: WidgetId[] = [
  "attention",
  "control-brief",
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "metric-assets",
  "metric-liabilities",
  "metric-available-liquidity",
  "liquidity",
  "credit-facility",
  "asset-mix",
  "month-pulse",
  "runway-projection",
  "operating-statement",
  "rolling-burn",
  "net-worth-trend",
  "expense-breakdown",
  "income-breakdown",
  "ledger-confidence",
  "balance-sheet",
  "journal",
  "recurring",
  "net-worth-velocity",
  "income-concentration",
  "cashflow-waterfall",
  "spending-anomalies",
  "spend-calendar",
];

// The real widgets composed into the landing page's dashboard-frame miniature
// (DashboardFrame.tsx) — one hero chart, two metrics, three supporting panels.
export const SHOWCASE_WIDGET_IDS: WidgetId[] = [
  "net-worth-trend",
  "metric-net-worth",
  "metric-runway",
  "expense-breakdown",
  "income-breakdown",
  "cashflow-waterfall",
];
