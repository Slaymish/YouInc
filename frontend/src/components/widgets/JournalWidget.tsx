import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { NoData } from "./NoData";
import { formatMoney } from "./format";

export function JournalWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  if (!dashboard.recentTransactions.length) return <NoData
        message="No transactions yet."
        hint="Connect a bank or load the sample batch to see them here."
      />;

  return (
    <div className="journal">
      {dashboard.recentTransactions.map((transaction) => (
        <article key={transaction.externalId}>
          <div>
            <time>{transaction.transactionDate}</time>
            <strong>{transaction.description}</strong>
            <span>{transaction.ruleId ?? "SUSPENSE"}</span>
          </div>
          <div>
            {transaction.postings.slice(0, 3).map((posting) => (
              <code key={`${transaction.externalId}-${posting.account}-${posting.side}`}>
                {posting.side[0].toUpperCase()} {posting.account} {formatMoney(posting.amountCents)}
              </code>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
