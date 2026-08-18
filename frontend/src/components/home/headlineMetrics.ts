// The four numbers on Home. The working behind each one comes from
// metricExplainers.ts, shared with the metric cards so a figure is never
// explained two different ways.
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatMonths } from "~/components/widgets/format";
import { explainMetric } from "~/components/widgets/metricExplainers";

export interface HeadlineMetric {
  id: string;
  label: string;
  value: string;
  /** Lines of working, in your own numbers. The last one says what it means. */
  explainer: readonly string[];
}

export function headlineMetrics(dashboard: LedgerDashboardData): HeadlineMetric[] {
  const { totals } = dashboard;

  return [
    {
      id: "metric-net-worth",
      label: "Net worth",
      value: formatMoney(totals.netWorthCents),
      explainer: explainMetric("metric-net-worth", dashboard) ?? [],
    },
    {
      id: "cash",
      label: "Cash",
      value: formatMoney(totals.cashCents),
      explainer: explainMetric("cash", dashboard) ?? [],
    },
    {
      id: "metric-burn",
      label: "Monthly spend",
      value: formatMoney(totals.monthlyOverheadCents),
      explainer: explainMetric("metric-burn", dashboard) ?? [],
    },
    {
      id: "metric-runway",
      label: "Runway",
      value: formatMonths(totals.runwayMonths),
      explainer: explainMetric("metric-runway", dashboard) ?? [],
    },
  ];
}
