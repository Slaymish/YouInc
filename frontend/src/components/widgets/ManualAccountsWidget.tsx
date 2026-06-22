import { useRouter } from "@tanstack/react-router";
import { useTransition, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { LedgerDashboardData, ManualBalanceInput, ManualBalanceRow } from "~/server/ledger";

const upsertManualBalanceFn = createServerFn({ method: "POST" })
  .validator((data: ManualBalanceInput) => data)
  .handler(async ({ data }) => {
    const { upsertManualBalance } = await import("~/server/ledger");
    return upsertManualBalance(data);
  });

function friendlyAccountLabel(account: string) {
  const parts = account.split(":");
  return parts
    .slice(-2)
    .map((s) => s.replace(/([A-Z])/g, " $1").trim())
    .join(" · ");
}

function ManualAccountRow({ row }: { row: ManualBalanceRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dollars, setDollars] = useState((row.balanceCents / 100).toFixed(2));
  const [message, setMessage] = useState<string | null>(null);

  const parsedCents = Math.round(parseFloat(dollars) * 100);
  const dirty = !Number.isNaN(parsedCents) && parsedCents !== row.balanceCents;

  function save() {
    if (Number.isNaN(parsedCents)) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await upsertManualBalanceFn({ data: { account: row.account, balanceCents: parsedCents } });
        setMessage("saved");
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <tr>
      <td>
        <strong>{friendlyAccountLabel(row.account)}</strong>
        <span>{row.account}</span>
      </td>
      <td className="numeric">
        <input
          className="mapping-input"
          value={dollars}
          onChange={(e) => setDollars(e.currentTarget.value)}
          onBlur={() => {
            const n = parseFloat(dollars);
            if (!Number.isNaN(n)) setDollars(n.toFixed(2));
          }}
        />
      </td>
      <td>{row.asOfDate}</td>
      <td>
        <button type="button" disabled={isPending || !dirty} onClick={save}>
          {isPending ? "Saving..." : "Save"}
        </button>
        {message ? <small>{message}</small> : null}
      </td>
    </tr>
  );
}

function AddManualAccount() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [dollars, setDollars] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const parsedCents = Math.round(parseFloat(dollars) * 100);
  const valid = account.trim().includes(":") && !Number.isNaN(parsedCents);

  function add() {
    if (!valid) return;
    startTransition(async () => {
      try {
        await upsertManualBalanceFn({ data: { account: account.trim(), balanceCents: parsedCents } });
        setAccount("");
        setDollars("");
        setMessage("added");
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <div className="sync-form-row">
      <label>
        Account
        <input value={account} placeholder="Assets:Investments:..." onChange={(e) => setAccount(e.currentTarget.value)} />
      </label>
      <label>
        Balance
        <input value={dollars} placeholder="0.00" onChange={(e) => setDollars(e.currentTarget.value)} />
      </label>
      <button type="button" disabled={isPending || !valid} onClick={add}>
        {isPending ? "Adding..." : "Add"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

export function ManualAccountsWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  return (
    <div className="stack">
      <div className="table-wrap compact-table">
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th className="numeric">Balance</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.manualBalances.map((row) => (
              <ManualAccountRow row={row} key={row.account} />
            ))}
          </tbody>
        </table>
      </div>
      <AddManualAccount />
    </div>
  );
}
