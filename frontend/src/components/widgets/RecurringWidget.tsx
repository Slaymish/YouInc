import type { LedgerDashboardData, RecurringCadence } from "~/components/dashboard/dashboardData";
import { formatMoney, leafAccount } from "./format";
import { NoData } from "./NoData";

const CADENCE_LABEL: Record<RecurringCadence, string> = {
  weekly: "wk",
  fortnightly: "2wk",
  monthly: "mo",
};

export function RecurringWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const payments = dashboard.recurringPayments;
  if (!payments.length) return <NoData message="NO RECURRING PAYMENTS DETECTED" />;

  const monthlyCommittedCents = payments.reduce(
    (sum, payment) => sum + payment.monthlyEquivalentCents,
    0,
  );
  const annualizedCents = monthlyCommittedCents * 12;
  const maxMonthly = Math.max(
    1,
    ...payments.map((payment) => payment.monthlyEquivalentCents),
  );

  return (
    <div className="stack">
      <div className="recurring-head">
        <div>
          <strong>{formatMoney(monthlyCommittedCents)}</strong>
          <span>committed / mo</span>
        </div>
        <div>
          <strong>{formatMoney(annualizedCents)}</strong>
          <span>annualized</span>
        </div>
      </div>
      <ul className="recurring-list">
        {payments.map((payment) => (
          <li key={`${payment.description}-${payment.firstDate}`} className="recurring-item">
            <div className="recurring-bar-track">
              <div
                className="recurring-bar"
                style={{ width: `${(payment.monthlyEquivalentCents / maxMonthly) * 100}%` }}
              />
            </div>
            <div className="recurring-info">
              <span className="recurring-name" title={payment.description}>
                {payment.description}
              </span>
              <span className="recurring-meta">
                {leafAccount(payment.account)} · {payment.occurrences}× ·{" "}
                {CADENCE_LABEL[payment.cadence]}
              </span>
            </div>
            <span className="recurring-amount numeric">
              {formatMoney(payment.amountCents)}
              <small>/{CADENCE_LABEL[payment.cadence]}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="form-hint">
        Detected from repeating descriptions with a stable cadence and amount.
      </p>
    </div>
  );
}
