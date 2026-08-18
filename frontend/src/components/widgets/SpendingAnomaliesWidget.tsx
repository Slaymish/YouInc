import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatPercent, leafAccount } from "./format";
import { NoData } from "./NoData";
import { spendingAnomalies, type CategoryAnomaly } from "./derive";

export function SpendingAnomaliesWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const { month, hasEnoughHistory, anomalies } = spendingAnomalies(
    dashboard.categoryMonthly,
  );

  if (!hasEnoughHistory) {
    return <NoData
        message="Four months of history needed."
        hint="Then this points out any category running well above or below its usual."
      />;
  }
  if (!anomalies.length) {
    return <NoData
        message={`Nothing unusual in ${month ?? "this month"}.`}
        hint="Every category is running close to its own normal."
      />;
  }

  return (
    <div className="stack">
      <div className="anomaly-head">
        <strong>{anomalies.length}</strong>
        <span>
          {anomalies.length === 1 ? "category" : "categories"} out of the
          ordinary in {month}
        </span>
      </div>
      <ul className="anomaly-list">
        {anomalies.map((anomaly) => (
          <AnomalyRow key={anomaly.account} anomaly={anomaly} />
        ))}
      </ul>
      <p className="form-hint">
        z-score of this month vs each category&apos;s prior-month history.
      </p>
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: CategoryAnomaly }) {
  const magnitude = anomaly.meanCents
    ? Math.abs(anomaly.deltaCents) / anomaly.meanCents
    : null;
  const isAbove = anomaly.direction === "above";

  return (
    <li className="anomaly-item">
      <div className="anomaly-info">
        <span className="anomaly-name" title={anomaly.account}>
          {leafAccount(anomaly.account)}
        </span>
        <span className="anomaly-meta">
          avg {formatMoney(anomaly.meanCents)} · {Math.abs(anomaly.z).toFixed(1)}σ
        </span>
      </div>
      <div className="anomaly-figures">
        <span className="anomaly-current numeric">
          {formatMoney(anomaly.currentCents)}
        </span>
        <span className={`delta ${isAbove ? "delta--bad" : "delta--good"}`}>
          {isAbove ? "▲" : "▼"} {magnitude === null ? "n/a" : formatPercent(magnitude)}
        </span>
      </div>
    </li>
  );
}
