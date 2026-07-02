import type { WidgetId } from "../dashboard/widgets";

// Presentational widgets only — no ingestion/manual-accounts/source-systems,
// which trigger session-gated mutations that would 401 on the public demo.
export const DEMO_WIDGET_IDS: WidgetId[] = [
  "metric-net-worth",
  "metric-runway",
  "metric-burn",
  "metric-margin",
  "control-brief",
  "net-worth-trend",
  "operating-statement",
  "expense-breakdown",
  "income-breakdown",
  "asset-mix",
  "spend-calendar",
  "recurring",
];

export const SHOWCASE_WIDGET_IDS: WidgetId[] = [
  "metric-net-worth",
  "metric-runway",
  "net-worth-trend",
  "spend-calendar",
  "expense-breakdown",
  "asset-mix",
];
