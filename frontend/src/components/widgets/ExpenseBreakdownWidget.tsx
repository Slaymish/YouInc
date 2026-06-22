import type { AccountTotal, LedgerDashboardData } from "~/server/ledger";
import { formatMoney, formatPercent, leafAccount } from "./format";
import { NoData } from "./NoData";

const MAX_ROWS = 8;

interface BreakdownListProps {
  rows: AccountTotal[];
  barClass: string;
}

export function BreakdownList({ rows, barClass }: BreakdownListProps) {
  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const max = Math.max(1, ...rows.map((row) => row.amountCents));
  const visible = rows.slice(0, MAX_ROWS);
  const remainder = rows.slice(MAX_ROWS);
  const remainderCents = remainder.reduce((sum, row) => sum + row.amountCents, 0);

  return (
    <div className="breakdown">
      {visible.map((row) => (
        <div key={row.account} className="breakdown-row">
          <div className="breakdown-head">
            <span className="breakdown-label" title={row.account}>
              {leafAccount(row.account)}
            </span>
            <span className="breakdown-value">{formatMoney(row.amountCents)}</span>
          </div>
          <div className="breakdown-meter">
            <div className="bar-track">
              <div
                className={`bar ${barClass}`}
                style={{ width: `${(row.amountCents / max) * 100}%` }}
              />
            </div>
            <span className="breakdown-pct">
              {formatPercent(total ? row.amountCents / total : null)}
            </span>
          </div>
        </div>
      ))}
      {remainder.length ? (
        <div className="breakdown-row breakdown-row--rest">
          <div className="breakdown-head">
            <span className="breakdown-label">+{remainder.length} more</span>
            <span className="breakdown-value">{formatMoney(remainderCents)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ExpenseBreakdownWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  if (!dashboard.expenseBreakdown.length) {
    return <NoData message="NO EXPENSE POSTINGS" />;
  }
  return <BreakdownList rows={dashboard.expenseBreakdown} barClass="expense" />;
}
