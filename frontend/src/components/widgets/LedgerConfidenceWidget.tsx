import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("en-NZ", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

function TableList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="table-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LedgerConfidenceWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const rows: Array<[string, string]> = [
    ["Classification", formatPercent(dashboard.routing.classificationRate)],
    ["Custom Rules", dashboard.routing.customRuleCount.toLocaleString()],
    ["NZFCC Fallback", dashboard.routing.nzfccFallbackCount.toLocaleString()],
    ["Suspense", dashboard.routing.suspenseCount.toLocaleString()],
    ["Suspense Value", formatMoney(dashboard.routing.suspenseCents)],
  ];

  return (
    <div className="confidence">
      <strong>{formatPercent(dashboard.routing.classificationRate)}</strong>
      <TableList rows={rows} />
      {dashboard.routing.suspenseCount ? (
        <p className="exception">Exception: unresolved suspense exists.</p>
      ) : null}
    </div>
  );
}
