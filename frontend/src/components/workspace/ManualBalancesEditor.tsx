import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  WorkspaceLedgerSummary,
  WorkspaceManualBalance,
} from "~/server/workspaceLedger";
import { formatMoney } from "~/components/widgets/format";
import { ToastViewport } from "~/components/ui/Toast";
import { useUndoToasts, type UndoToasts } from "~/components/ui/useUndo";

// --- Server functions (each re-checks the Supabase user inside the DAL) ------

// `asOfDate` is optional and only supplied by undo, which restores the deleted
// row's original date rather than stamping today.
const upsertBalanceFn = createServerFn({ method: "POST" })
  .validator((data: { account: string; balanceCents: number; asOfDate?: string }) => data)
  .handler(async ({ data }): Promise<WorkspaceLedgerSummary> => {
    const { upsertWorkspaceBalance } = await import("~/server/workspaceLedger");
    return upsertWorkspaceBalance(data);
  });

const deleteBalanceFn = createServerFn({ method: "POST" })
  .validator((account: string) => account)
  .handler(async ({ data: account }): Promise<WorkspaceLedgerSummary> => {
    const { deleteWorkspaceBalance } = await import("~/server/workspaceLedger");
    return deleteWorkspaceBalance(account);
  });

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

interface Props {
  summary: WorkspaceLedgerSummary;
  onChange: (next: WorkspaceLedgerSummary) => void;
}

/**
 * One row per place money sits, whether it syncs or you typed it. Synced rows
 * are read-only — they come from transactions, so editing the total here would
 * be a number with nothing behind it.
 */
function SyncedRow({ row }: { row: WorkspaceLedgerSummary["balances"][number] }) {
  return (
    <tr>
      <td>
        <code className="mb-account">{row.account}</code>
        <span className={"mb-tag mb-tag--" + row.accountType.toLowerCase()}>
          {row.accountType}
        </span>
        <span className="mb-tag mb-source">Synced</span>
      </td>
      <td className="mb-numeric">{formatMoney(row.balanceCents)}</td>
      <td className="mb-actions" />
    </tr>
  );
}

/**
 * Undo for a removed balance. Server-first like every other mutation here — no
 * optimistic restore, because the route loader is invalidated after `onChange`
 * and would clobber client-only state.
 */
async function restoreBalance(
  removed: WorkspaceManualBalance,
  onChange: Props["onChange"],
  toasts: UndoToasts,
): Promise<void> {
  try {
    onChange(
      await upsertBalanceFn({
        data: {
          account: removed.account,
          balanceCents: removed.balanceCents,
          asOfDate: removed.asOfDate,
        },
      }),
    );
    toasts.notify({ message: `Restored ${removed.account}.` });
  } catch (err) {
    toasts.notify({ message: `Couldn't restore ${removed.account}: ${errorMessage(err)}` });
  }
}

function BalanceRow({
  row,
  onChange,
  onRemoved,
}: {
  row: WorkspaceManualBalance;
  onChange: Props["onChange"];
  /** Raises the undo toast in the parent — this row unmounts on delete. */
  onRemoved: (removed: WorkspaceManualBalance) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dollars, setDollars] = useState((row.balanceCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);

  const parsedCents = Math.round(parseFloat(dollars) * 100);
  const dirty = !Number.isNaN(parsedCents) && parsedCents !== row.balanceCents;

  function save() {
    if (Number.isNaN(parsedCents)) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await upsertBalanceFn({ data: { account: row.account, balanceCents: parsedCents } });
        onChange(next);
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await deleteBalanceFn({ data: row.account });
        onChange(next);
        onRemoved(row);
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <tr>
      <td>
        <code className="mb-account">{row.account}</code>
        <span className={"mb-tag mb-tag--" + row.accountType.toLowerCase()}>{row.accountType}</span>
        <span className="mb-tag mb-source">Entered by hand</span>
      </td>
      <td className="mb-numeric">
        <input
          aria-label={`Balance for ${row.account}`}
          type="number"
          step="0.01"
          value={dollars}
          onChange={(e) => setDollars(e.target.value)}
          disabled={pending}
        />
      </td>
      <td className="mb-actions">
        <button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "…" : dirty ? "Save" : "Saved"}
        </button>
        <button type="button" className="mb-remove" onClick={remove} disabled={pending}>
          Remove
        </button>
        {error ? <span className="mb-error" role="alert">{error}</span> : null}
      </td>
    </tr>
  );
}

function AddBalance({ onChange }: { onChange: Props["onChange"] }) {
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [dollars, setDollars] = useState("");
  const [error, setError] = useState<string | null>(null);

  const parsedCents = Math.round(parseFloat(dollars) * 100);
  const valid = account.trim().includes(":") && !Number.isNaN(parsedCents);

  function add() {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      try {
        const next = await upsertBalanceFn({ data: { account: account.trim(), balanceCents: parsedCents } });
        setAccount("");
        setDollars("");
        onChange(next);
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  return (
    <div className="mb-add">
      <input
        aria-label="New account path"
        placeholder="Assets:Bank:Everyday"
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        disabled={pending}
      />
      <input
        aria-label="New account balance"
        type="number"
        step="0.01"
        placeholder="0.00"
        value={dollars}
        onChange={(e) => setDollars(e.target.value)}
        disabled={pending}
      />
      <button type="button" className="auth-primary" onClick={add} disabled={pending || !valid}>
        {pending ? "Adding…" : "Add account"}
      </button>
      {error ? <p className="mb-error" role="alert">{error}</p> : null}
      <p className="mb-hint">
        Use a namespaced path — <code>Assets:…</code> counts toward net worth,{" "}
        <code>Liabilities:…</code> against it (enter liabilities as a negative balance).
      </p>
    </div>
  );
}

export function ManualBalancesEditor({ summary, onChange }: Props) {
  const rows = summary.manualBalances;
  // Synced balances are derived from posted transactions; manual entries win
  // where both exist, which is why these are the non-manual rows only.
  const synced = summary.balances.filter((b) => !b.isManual);
  const toasts = useUndoToasts();

  // `manual_account_balances` is keyed on (tenant_id, account) and has no
  // soft-delete column, so undo is a plain re-upsert from the row we held.
  function offerUndo(removed: WorkspaceManualBalance) {
    toasts.notify({
      message: `Removed ${removed.account}.`,
      onUndo: () => {
        void restoreBalance(removed, onChange, toasts);
      },
    });
  }

  const hasRows = rows.length > 0 || synced.length > 0;

  return (
    <div className="mb-editor">
      {hasRows ? (
        <div className="mb-table-wrap">
          <table className="mb-table">
            <thead>
              <tr>
                <th>Account</th>
                <th className="mb-numeric">Balance</th>
                <th className="mb-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <BalanceRow
                  key={row.account}
                  row={row}
                  onChange={onChange}
                  onRemoved={offerUndo}
                />
              ))}
              {synced.map((row) => (
                <SyncedRow key={row.account} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-empty">
          No accounts yet. Add your first account below to start tracking your net worth.
        </p>
      )}
      <AddBalance onChange={onChange} />
      {synced.length > 0 ? (
        <p className="mb-note">
          Synced balances come from your transactions. Where you've entered a
          balance yourself, we use yours.
        </p>
      ) : null}
      <ToastViewport {...toasts} />
    </div>
  );
}
