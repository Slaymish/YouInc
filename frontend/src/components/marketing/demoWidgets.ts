import type { WidgetId } from "../dashboard/widgets";

// Every widget except ingestion / manual-accounts / source-systems /
// suspense-queue, which trigger session-gated server mutations that would
// 401 on the public demo (see the *Widget.tsx files for the createServerFn
// calls). Everything else only reads the `dashboard` prop, so it's safe to
// offer on /demo — this is the `allowedWidgetIds` passed to DashboardGrid,
// letting the public demo mirror the real dashboard's tabs almost 1:1.
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
