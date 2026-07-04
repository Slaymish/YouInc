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
  | "spend-calendar";

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
    label: "Action Center",
    category: "overview",
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 3,
  },
  {
    id: "control-brief",
    label: "Control Brief",
    category: "overview",
    defaultW: 6,
    defaultH: 2,
    minW: 4,
    minH: 2,
  },
  {
    id: "metric-net-worth",
    label: "Net Worth",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-runway",
    label: "Runway",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-burn",
    label: "Burn / Mo",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-margin",
    label: "Margin",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-assets",
    label: "Assets",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-liabilities",
    label: "Liabilities",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "liquidity",
    label: "Cash Position",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "metric-available-liquidity",
    label: "Available Liquidity",
    category: "stats",
    defaultW: 2,
    defaultH: 2,
    minW: 2,
    minH: 2,
  },
  {
    id: "credit-facility",
    label: "Credit Facilities",
    category: "finance",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 2,
  },
  {
    id: "operating-statement",
    label: "Operating Statement",
    category: "finance",
    defaultW: 7,
    defaultH: 5,
    minW: 4,
    minH: 4,
  },
  {
    id: "ledger-confidence",
    label: "Ledger Confidence",
    category: "finance",
    defaultW: 5,
    defaultH: 4,
    minW: 3,
    minH: 4,
  },
  {
    id: "balance-sheet",
    label: "Balance Sheet",
    category: "finance",
    defaultW: 7,
    defaultH: 14,
    minW: 4,
    minH: 4,
  },
  {
    id: "journal",
    label: "Journal",
    category: "data",
    defaultW: 7,
    defaultH: 10,
    minW: 4,
    minH: 4,
  },
  {
    id: "month-pulse",
    label: "Month Pulse",
    category: "overview",
    defaultW: 4,
    defaultH: 2,
    minW: 3,
    minH: 2,
  },
  {
    id: "runway-projection",
    label: "Runway Projection",
    category: "overview",
    defaultW: 5,
    defaultH: 4,
    minW: 4,
    minH: 3,
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
    defaultH: 6,
    minW: 4,
    minH: 4,
  },
  {
    id: "rolling-burn",
    label: "Rolling Average",
    category: "finance",
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 4,
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
    defaultH: 4,
    minW: 3,
    minH: 4,
  },
  {
    id: "net-worth-velocity",
    label: "Net-Worth Velocity",
    category: "overview",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    id: "income-concentration",
    label: "Income Concentration",
    category: "finance",
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    id: "cashflow-waterfall",
    label: "Cashflow Waterfall",
    category: "finance",
    defaultW: 6,
    defaultH: 5,
    minW: 4,
    minH: 4,
  },
  {
    id: "spending-anomalies",
    label: "Spending Anomalies",
    category: "finance",
    defaultW: 5,
    defaultH: 3,
    minW: 3,
    minH: 3,
  },
  {
    id: "spend-calendar",
    label: "Spend Calendar",
    category: "finance",
    defaultW: 7,
    defaultH: 3,
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
