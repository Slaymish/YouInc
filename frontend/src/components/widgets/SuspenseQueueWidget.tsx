import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { LedgerDashboardData, SuspenseItem } from "~/components/dashboard/dashboardData";
import type { ReclassifySuspenseItemInput } from "~/server/tenantReclassify";
import { formatMoney, leafAccount } from "./format";

// Tenant-scoped rebuild of the retired single-tenant SuspenseQueueWidget (see
// git history at 6065eee~1). Reads `dashboard.suspenseQueue` /
// `dashboard.knownAccounts` (workspaceDashboard.ts / workspaceSuspenseMath.ts)
// and resolves ONE item at a time via tenantReclassify.ts's
// reclassifySuspenseItem — a balanced correction transaction, not a row
// mutation (see that module's docs). No "sync + reclassify" action here: live
// Akahu sync already has its own surface (AkahuConnectPanel.tsx).
const reclassifyFn = createServerFn({ method: "POST" })
  .validator((data: ReclassifySuspenseItemInput) => data)
  .handler(async ({ data }): Promise<SuspenseItem[]> => {
    const { reclassifySuspenseItem } = await import("~/server/tenantReclassify");
    return reclassifySuspenseItem(data);
  });

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

const NEW_CATEGORY_OPTION = "__new_category__";

function QueueRow({
  item,
  knownAccounts,
  onResolved,
}: {
  item: SuspenseItem;
  knownAccounts: string[];
  onResolved: (queue: SuspenseItem[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [newAccount, setNewAccount] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const isNewCategory = account === NEW_CATEGORY_OPTION;
  const targetAccount = (isNewCategory ? newAccount : account).trim();

  function resolve() {
    if (!targetAccount) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const queue = await reclassifyFn({
          data: { externalId: item.externalId, targetAccount },
        });
        onResolved(queue);
      } catch (error) {
        setMessage(errorMessage(error));
      }
    });
  }

  const sourceAccount = item.counterAccount ? leafAccount(item.counterAccount) : "unknown account";
  const flowLabel =
    item.direction === "out" ? `Paid from ${sourceAccount}` : `Received into ${sourceAccount}`;

  return (
    <article className="queue-item">
      <div className="queue-item-head">
        <div>
          <time>{item.transactionDate}</time>
          <strong>{item.description}</strong>
          <span className={`queue-flow queue-flow-${item.direction}`}>
            <span className="queue-flow-tag">{item.direction === "out" ? "Out" : "In"}</span>
            {flowLabel}
          </span>
        </div>
        <span className={`numeric queue-amount-${item.direction}`}>{formatMoney(item.amountCents)}</span>
      </div>
      <div className="queue-classify">
        <select
          aria-label={`Reclassify ${item.description}`}
          value={account}
          onChange={(e) => setAccount(e.currentTarget.value)}
          disabled={isPending}
        >
          <option value="">Reclassify as…</option>
          {knownAccounts.map((acct) => (
            <option key={acct} value={acct}>
              {acct}
            </option>
          ))}
          <option value={NEW_CATEGORY_OPTION}>+ New category…</option>
        </select>
        {isNewCategory ? (
          <input
            aria-label="New category account"
            placeholder="Expenses:Groceries"
            value={newAccount}
            onChange={(e) => setNewAccount(e.currentTarget.value)}
            disabled={isPending}
          />
        ) : null}
        <button type="button" disabled={isPending || !targetAccount} onClick={resolve}>
          {isPending ? "…" : "Resolve"}
        </button>
      </div>
      {message ? (
        <small className="queue-error" role="alert">
          {message}
        </small>
      ) : null}
    </article>
  );
}

export function SuspenseQueueWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const [items, setItems] = useState(dashboard.suspenseQueue);

  if (!items.length) {
    return (
      <div className="queue-clear">
        <strong>ALL CLASSIFIED</strong>
        <span>No transactions parked in suspense.</span>
      </div>
    );
  }

  // Sum magnitudes (not signed) so the header reflects total value parked,
  // not a near-zero net of offsetting inflows and outflows.
  const totalCents = items.reduce((sum, item) => sum + Math.abs(item.amountCents), 0);

  return (
    <div className="stack">
      <div className="queue-summary">
        <strong>{items.length}</strong>
        <span>unclassified · {formatMoney(totalCents)}</span>
      </div>
      <div className="queue-list">
        {items.map((item) => (
          <QueueRow
            key={item.externalId}
            item={item}
            knownAccounts={dashboard.knownAccounts}
            onResolved={setItems}
          />
        ))}
      </div>
    </div>
  );
}
