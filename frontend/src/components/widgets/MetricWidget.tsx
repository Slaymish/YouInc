import type { LedgerDashboardData } from "~/server/ledger";
import type { WidgetId } from "../dashboard/widgets";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
  }).format(cents / 100);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("en-NZ", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMonths(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}m`;
}

const METRIC_CONFIGS: Record<
  string,
  { label: string; value: (d: LedgerDashboardData) => string }
> = {
  "metric-net-worth": {
    label: "Net Worth",
    value: (d) => formatMoney(d.totals.netWorthCents),
  },
  "metric-runway": {
    label: "Runway",
    value: (d) => formatMonths(d.totals.runwayMonths),
  },
  "metric-burn": {
    label: "Burn / Mo",
    value: (d) => formatMoney(d.totals.monthlyOverheadCents),
  },
  "metric-margin": {
    label: "Margin",
    value: (d) => formatPercent(d.totals.ebitdaMargin),
  },
  "metric-assets": {
    label: "Assets",
    value: (d) => formatMoney(d.totals.assetsCents),
  },
  "metric-liabilities": {
    label: "Liabilities",
    value: (d) => formatMoney(d.totals.liabilitiesCents),
  },
  "metric-available-liquidity": {
    label: "Available Liquidity",
    value: (d) => formatMoney(d.totals.availableLiquidityCents),
  },
};

export function MetricWidget({
  id,
  dashboard,
}: {
  id: WidgetId;
  dashboard: LedgerDashboardData;
}) {
  const config = METRIC_CONFIGS[id];
  if (!config) return null;
  return (
    <div className="metric-inner">
      <p>{config.label}</p>
      <strong>{config.value(dashboard)}</strong>
    </div>
  );
}
