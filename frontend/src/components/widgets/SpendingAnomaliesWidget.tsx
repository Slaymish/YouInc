import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatPercent, leafAccount } from "./format";
import { NoData } from "./NoData";
import { spendingAnomalies } from "./derive";

export function SpendingAnomaliesWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const { month, hasEnoughHistory, anomalies } = spendingAnomalies(
    dashboard.categoryMonthly,
  );

  if (!hasEnoughHistory) {
    return <NoData message="NEED 4+ MONTHS OF HISTORY" />;
  }
  if (!anomalies.length) {
    return <NoData message={`NOTHING UNUSUAL IN ${month ?? ""}`.trim()} />;
  }

  return (
    <div className="stack">
      <div className="anomaly-head">
        <strong>{anomalies.length}</strong>
        <span>categories above normal in {month}</span>
      </div>
      <ul className="anomaly-list">
        {anomalies.map((anomaly) => {
          const overshoot = anomaly.meanCents
            ? anomaly.deltaCents / anomaly.meanCents
            : null;
          return (
            <li key={anomaly.account} className="anomaly-item">
              <div className="anomaly-info">
                <span className="anomaly-name" title={anomaly.account}>
                  {leafAccount(anomaly.account)}
                </span>
                <span className="anomaly-meta">
                  avg {formatMoney(anomaly.meanCents)} · {anomaly.z.toFixed(1)}σ
                </span>
              </div>
              <div className="anomaly-figures">
                <span className="anomaly-current numeric">
                  {formatMoney(anomaly.currentCents)}
                </span>
                <span className="delta delta--bad">
                  ▲ {overshoot === null ? "n/a" : formatPercent(overshoot)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="form-hint">
        z-score of this month vs each category&apos;s prior-month history.
      </p>
    </div>
  );
}
