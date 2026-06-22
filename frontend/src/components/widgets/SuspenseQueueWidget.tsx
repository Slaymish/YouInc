import type { LedgerDashboardData } from "~/server/ledger";
import { formatMoney } from "./format";

export function SuspenseQueueWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const items = dashboard.suspenseQueue;

  if (!items.length) {
    return (
      <div className="queue-clear">
        <strong>ALL CLASSIFIED</strong>
        <span>No transactions parked in suspense.</span>
      </div>
    );
  }

  const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);

  return (
    <div className="stack">
      <div className="queue-summary">
        <strong>{items.length}</strong>
        <span>unclassified · {formatMoney(totalCents)}</span>
      </div>
      <div className="queue-list">
        {items.map((item) => (
          <article key={item.externalId} className="queue-item">
            <div>
              <time>{item.transactionDate}</time>
              <strong>{item.description}</strong>
            </div>
            <span className="numeric">{formatMoney(item.amountCents)}</span>
          </article>
        ))}
      </div>
    </div>
  );
}
