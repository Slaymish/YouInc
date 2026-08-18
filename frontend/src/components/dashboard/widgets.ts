export type WidgetId =
  | "attention"
  | "control-brief"
  | "metric-net-worth"
  | "metric-runway"
  | "metric-burn"
  | "metric-margin"
  | "metric-assets"
  | "metric-liabilities"
  | "metric-available-liquidity"
  | "liquidity"
  | "credit-facility"
  | "asset-mix"
  | "month-pulse"
  | "runway-projection"
  | "operating-statement"
  | "rolling-burn"
  | "net-worth-trend"
  | "expense-breakdown"
  | "income-breakdown"
  | "ledger-confidence"
  | "balance-sheet"
  | "journal"
  | "recurring"
  | "net-worth-velocity"
  | "income-concentration"
  | "cashflow-waterfall"
  | "spending-anomalies"
  | "spend-calendar"
  | "suspense-queue";

export type WidgetCategory =
  | "overview"
  | "stats"
  | "finance"
  | "data"
  | "actions";

export interface WidgetDefinition {
  id: WidgetId;
  label: string;
  category: WidgetCategory;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: "attention",
    label: "Needs attention",
    category: "overview",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 4,
  },
  {
    id: "control-brief",
    label: "Control Brief",
    category: "overview",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 4,
  },
  {
    id: "metric-net-worth",
    label: "Net Worth",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "metric-runway",
    label: "Runway",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "metric-burn",
    label: "Monthly spend",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "metric-margin",
    label: "Savings rate",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "metric-assets",
    label: "Assets",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "metric-liabilities",
    label: "Liabilities",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "liquidity",
    label: "Cash",
    category: "stats",
    defaultW: 4,
    defaultH: 4,
    minW: 4,
    minH: 4,
  },
  {
    id: "metric-available-liquidity",
    label: "Cash + credit available",
    category: "stats",
    defaultW: 3,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "credit-facility",
    label: "Credit Facilities",
    category: "finance",
    defaultW: 5,
    defaultH: 3,
    minW: 4,
    minH: 3,
  },
  {
    id: "operating-statement",
    label: "Income & expenses",
    category: "finance",
    defaultW: 7,
    defaultH: 6,
    minW: 4,
    minH: 6,
  },
  {
    id: "ledger-confidence",
    label: "Ledger Confidence",
    category: "finance",
    defaultW: 5,
    defaultH: 5,
    minW: 3,
    minH: 5,
  },
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    category: "finance",
    defaultW: 7,
    defaultH: 8,
    minW: 4,
    minH: 8,
  },
  {
    id: "journal",
    label: "Transactions",
    category: "data",
    defaultW: 7,
    defaultH: 8,
    minW: 4,
    minH: 8,
  },
  {
    id: "month-pulse",
    label: "Month Pulse",
    category: "overview",
    defaultW: 6,
    defaultH: 3,
    minW: 6,
    minH: 3,
  },
  {
    id: "runway-projection",
    label: "Runway Projection",
    category: "overview",
    defaultW: 5,
    defaultH: 5,
    minW: 4,
    minH: 5,
  },
  {
    id: "asset-mix",
    label: "Asset Mix",
    category: "stats",
    defaultW: 3,
    defaultH: 3,
    minW: 2,
    minH: 3,
  },
  {
    id: "net-worth-trend",
    label: "Net Worth Trend",
    category: "finance",
    defaultW: 7,
    defaultH: 8,
    minW: 6,
    minH: 8,
  },
  {
    id: "rolling-burn",
    label: "Spending trend",
    category: "finance",
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 5,
  },
  {
    id: "expense-breakdown",
    label: "Expense Breakdown",
    category: "finance",
    defaultW: 5,
    defaultH: 5,
    minW: 3,
    minH: 4,
  },
  {
    id: "income-breakdown",
    label: "Income Breakdown",
    category: "finance",
    defaultW: 5,
    defaultH: 5,
    minW: 3,
    minH: 4,
  },
  {
    id: "recurring",
    label: "Recurring & Subscriptions",
    category: "finance",
    defaultW: 5,
    defaultH: 5,
    minW: 3,
    minH: 5,
  },
  {
    id: "net-worth-velocity",
    label: "Net worth pace",
    category: "overview",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 4,
  },
  {
    id: "income-concentration",
    label: "Income Concentration",
    category: "finance",
    defaultW: 4,
    defaultH: 5,
    minW: 3,
    minH: 5,
  },
  {
    id: "cashflow-waterfall",
    label: "Where the money went",
    category: "finance",
    defaultW: 6,
    defaultH: 6,
    minW: 4,
    minH: 6,
  },
  {
    id: "spending-anomalies",
    label: "Spending Anomalies",
    category: "finance",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 4,
  },
  {
    id: "spend-calendar",
    label: "Spend Calendar",
    category: "finance",
    defaultW: 7,
    defaultH: 4,
    minW: 4,
    minH: 4,
  },
  {
    id: "suspense-queue",
    label: "Needs a category",
    category: "actions",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
  },
];

export const WIDGET_MAP = new Map(WIDGET_REGISTRY.map((w) => [w.id, w]));

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  overview: "Overview",
  stats: "Stats",
  finance: "Finance",
  data: "Data",
  actions: "Actions",
};

export const CATEGORY_ORDER: WidgetCategory[] = [
  "overview",
  "stats",
  "finance",
  "data",
  "actions",
];
