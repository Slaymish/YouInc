import { useMemo, useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { LedgerDashboardData, SuspenseItem } from "~/components/dashboard/dashboardData";
import type { ReclassifySuspenseItemInput } from "~/server/tenantReclassify";
import { formatMoney } from "~/components/widgets/format";
import { ToastViewport } from "~/components/ui/Toast";
import { useUndoToasts } from "~/components/ui/useUndo";
import { suggestCategories } from "./categorySuggestions";
import "./sorting-task.css";

// The interaction people do fifty times. One tap sorts a transaction, the row
// leaves immediately, and the write is deferred until the undo window closes —
// reclassifySuspenseItem posts a correction transaction and refuses the
// suspense account as a target, so there is no server-side inverse to undo
// with. Deferring is what makes the tap reversible at all.
const reclassifyFn = createServerFn({ method: "POST" })
  .validator((data: ReclassifySuspenseItemInput) => data)
  .handler(async ({ data }): Promise<SuspenseItem[]> => {
    const { reclassifySuspenseItem } = await import("~/server/tenantReclassify");
    return reclassifySuspenseItem(data);
  });

function categoryLabel(account: string): string {
  const parts = account.split(":");
  return parts[parts.length - 1] || account;
}

function directionOf(item: SuspenseItem): "in" | "out" {
  return item.direction === "out" ? "out" : "in";
}

export function SortingTask({
  dashboard,
  onResolved,
  persist = true,
}: {
  dashboard: LedgerDashboardData;
  /** Fires after a committed write, so the page can refresh its figures. */
  onResolved?: () => void;
  /**
   * False on the signed-out demo: the interaction is real, the write isn't —
   * there is no ledger to post a correction to.
   */
  persist?: boolean;
}) {
  const [queue, setQueue] = useState(dashboard.suspenseQueue);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toasts = useUndoToasts();

  // Categories already in use, most-used first — the ranking input.
  const usageOrder = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of dashboard.expenseBreakdown) counts.set(row.account, row.amountCents);
    for (const row of dashboard.incomeBreakdown) counts.set(row.account, row.amountCents);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([account]) => account);
  }, [dashboard.expenseBreakdown, dashboard.incomeBreakdown]);

  function sort(item: SuspenseItem, targetAccount: string) {
    setError(null);
    setCustomFor(null);
    setCustomValue("");
    // Optimistic: the row goes now. The write waits for the undo window.
    setQueue((rows) => rows.filter((row) => row.externalId !== item.externalId));

    toasts.notify({
      message: `Sorted ${item.description} into ${categoryLabel(targetAccount)}.`,
      onUndo: () => {
        setQueue((rows) =>
          rows.some((row) => row.externalId === item.externalId) ? rows : [item, ...rows],
        );
      },
      onCommit: () => {
        if (!persist) return;
        startTransition(async () => {
          try {
            const next = await reclassifyFn({
              data: { externalId: item.externalId, targetAccount },
            });
            setQueue(next);
            onResolved?.();
          } catch (err) {
            // Put it back rather than pretending it was sorted.
            setQueue((rows) =>
              rows.some((row) => row.externalId === item.externalId) ? rows : [item, ...rows],
            );
            setError(
              err instanceof Error
                ? `${item.description} couldn't be sorted: ${err.message}`
                : `${item.description} couldn't be sorted.`,
            );
          }
        });
      },
    });
  }

  if (queue.length === 0) {
    return (
      <div className="sort-done">
        <p className="sort-done__line">All sorted.</p>
        <p className="sort-done__note">
          Everything that's come in has a category. New transactions the rules
          can't place will show up here.
        </p>
        <ToastViewport {...toasts} />
      </div>
    );
  }

  return (
    <div className="sort-task">
      <p className="sort-task__count">
        {queue.length} {queue.length === 1 ? "thing needs" : "things need"} a category
      </p>

      {error ? (
        <p className="sort-task__error" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="sort-list">
        {queue.map((item) => {
          const direction = directionOf(item);
          const suggestions = suggestCategories({
            knownAccounts: dashboard.knownAccounts,
            usageOrder,
            direction,
          });
          const isCustom = customFor === item.externalId;

          return (
            <li className="sort-card" key={item.externalId}>
              <div className="sort-card__head">
                <div className="sort-card__what">
                  <strong>{item.description}</strong>
                  <time dateTime={item.transactionDate}>{item.transactionDate}</time>
                </div>
                <span className={`sort-card__amount sort-card__amount--${direction}`}>
                  {direction === "out" ? "−" : "+"}
                  {formatMoney(Math.abs(item.amountCents))}
                </span>
              </div>

              <div className="sort-card__choices">
                {suggestions.map((account) => (
                  <button
                    key={account}
                    type="button"
                    className="sort-choice"
                    onClick={() => sort(item, account)}
                  >
                    {categoryLabel(account)}
                  </button>
                ))}
                <button
                  type="button"
                  className="sort-choice sort-choice--other"
                  aria-expanded={isCustom}
                  onClick={() => {
                    setCustomFor(isCustom ? null : item.externalId);
                    setCustomValue("");
                  }}
                >
                  Something else
                </button>
              </div>

              {isCustom ? (
                <form
                  className="sort-card__custom"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const target = customValue.trim();
                    if (target) sort(item, target);
                  }}
                >
                  <label>
                    <span>Category</span>
                    <input
                      autoFocus
                      list="sort-known-accounts"
                      value={customValue}
                      placeholder="Expenses:Groceries"
                      onChange={(event) => setCustomValue(event.currentTarget.value)}
                    />
                  </label>
                  <button className="sort-choice" type="submit" disabled={!customValue.trim()}>
                    Sort it
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      <datalist id="sort-known-accounts">
        {dashboard.knownAccounts.map((account) => (
          <option key={account} value={account} />
        ))}
      </datalist>

      <ToastViewport {...toasts} />
    </div>
  );
}
