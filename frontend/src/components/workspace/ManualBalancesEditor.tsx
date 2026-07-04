import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  WorkspaceLedgerSummary,
  WorkspaceManualBalance,
} from "~/server/workspaceLedger";
import { formatMoney } from "~/components/widgets/format";

// --- Server functions (each re-checks the Supabase user inside the DAL) ------

const upsertBalanceFn = createServerFn({ method: "POST" })
  .validator((data: { account: string; balanceCents: number }) => data)
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

function BalanceRow({ row, onChange }: { row: WorkspaceManualBalance; onChange: Props["onChange"] }) {
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
  return (
    <div className="mb-editor">
      {rows.length > 0 ? (
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
                <BalanceRow key={row.account} row={row} onChange={onChange} />
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
      <p className="mb-note">
        {rows.length > 0
          ? "Balances are updated by hand for now. Automatic bank sync via Akahu is coming — it will keep these current for you."
          : "Prefer automatic updates? Bank sync via Akahu is coming soon."}
      </p>
    </div>
  );
}
