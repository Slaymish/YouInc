import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { WIDGET_MAP, type WidgetId } from "../dashboard/widgets";
import { Explainer } from "~/components/ui/Explainer";
import { explainMetric } from "./metricExplainers";
import { formatMoney, formatMonths, formatPercent } from "./format";

// Label comes from WIDGET_MAP (the single source of truth for widget copy) —
// this map only owns the value accessor per metric.
const METRIC_VALUE_ACCESSORS: Partial<
  Record<WidgetId, (d: LedgerDashboardData) => string>
> = {
  "metric-net-worth": (d) => formatMoney(d.totals.netWorthCents),
  "metric-runway": (d) => formatMonths(d.totals.runwayMonths),
  "metric-burn": (d) => formatMoney(d.totals.monthlyOverheadCents),
  "metric-margin": (d) => formatPercent(d.totals.ebitdaMargin),
  "metric-assets": (d) => formatMoney(d.totals.assetsCents),
  "metric-liabilities": (d) => formatMoney(d.totals.liabilitiesCents),
  "metric-available-liquidity": (d) =>
    formatMoney(d.totals.availableLiquidityCents),
};

export function MetricWidget({
  id,
  dashboard,
}: {
  id: WidgetId;
  dashboard: LedgerDashboardData;
}) {
  const value = METRIC_VALUE_ACCESSORS[id];
  if (!value) return null;
  // Fall back to the raw id rather than rendering blank if the registry ever
  // drops an entry this map still serves.
  const label = WIDGET_MAP.get(id)?.label ?? id;
  const explainer = explainMetric(id, dashboard);
  return (
    <div className="metric-inner">
      <p>{label}</p>
      <span className="metric-value">
        <strong>{value(dashboard)}</strong>
        {explainer ? (
          <Explainer subject={label.toLowerCase()} lines={explainer} />
        ) : null}
      </span>
    </div>
  );
}
