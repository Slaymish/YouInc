import type { LedgerDashboardData } from "~/server/ledger";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

function NoData({ message }: { message: string }) {
  return <p className="no-data">{message}</p>;
}

export function JournalWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  if (!dashboard.recentTransactions.length) return <NoData message="NO JOURNAL ENTRIES" />;

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
