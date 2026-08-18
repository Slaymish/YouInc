import { useMemo } from "react";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney } from "~/components/widgets/format";
import {
  sortPlainTransactions,
  toPlainTransaction,
} from "~/components/widgets/plainTransaction";
import "./transaction-list.css";

/**
 * Transactions as a person reads them: when, what, which category, how much.
 * Debits, credits and rule ids stay in the Workshop — see the interface plan
 * §03.
 */
export function TransactionList({ dashboard }: { dashboard: LedgerDashboardData }) {
  const rows = useMemo(
    () => sortPlainTransactions(dashboard.recentTransactions.map(toPlainTransaction)),
    [dashboard.recentTransactions],
  );

  if (rows.length === 0) {
    return (
      <div className="txn-empty">
        <p className="txn-empty__line">Nothing here yet.</p>
        <p className="txn-empty__note">
          Connect a bank or load the sample transactions and they'll appear here
          as they arrive.
        </p>
      </div>
    );
  }

  return (
    <ul className="txn-list">
      {rows.map((row) => (
        <li className="txn-row" key={row.externalId}>
          <div className="txn-row__what">
            <strong>{row.description}</strong>
            <span className="txn-row__meta">
              <time dateTime={row.date}>{row.date}</time>
              {row.category ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="txn-row__category">{row.category}</span>
                </>
              ) : row.needsCategory ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="txn-row__unsorted">needs a category</span>
                </>
              ) : null}
            </span>
          </div>
          <span className={`txn-row__amount txn-row__amount--${row.direction}`}>
            {row.direction === "out" ? "−" : "+"}
            {formatMoney(row.amountCents)}
          </span>
        </li>
      ))}
    </ul>
  );
}
