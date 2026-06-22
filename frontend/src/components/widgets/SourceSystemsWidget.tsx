import { useRouter } from "@tanstack/react-router";
import { useTransition, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { AccountMappingInput, LedgerDashboardData } from "~/server/ledger";

const saveAccountMappingFn = createServerFn({ method: "POST" })
  .validator((data: AccountMappingInput) => data)
  .handler(async ({ data }) => {
    const { upsertAccountMapping } = await import("~/server/ledger");
    return upsertAccountMapping(data);
  });

function NoData({ message }: { message: string }) {
  return <p className="no-data">{message}</p>;
}

function SourceAccountMappingRow({ row }: { row: LedgerDashboardData["sourceAccounts"][number] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ledgerAccount, setLedgerAccount] = useState(row.ledgerAccount);
  const [accountType, setAccountType] = useState<AccountMappingInput["accountType"]>(row.accountType);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = ledgerAccount !== row.ledgerAccount || accountType !== row.accountType;

  function saveMapping() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveAccountMappingFn({ data: { accountId: row.accountId, ledgerAccount, accountType } });
        setMessage("saved");
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <tr className={row.mappingStatus === "unmapped" ? "unmapped-row" : undefined}>
      <td>
        <strong>{row.accountId}</strong>
        <span>{row.mappingStatus}</span>
      </td>
      <td>
        <input className="mapping-input" value={ledgerAccount} onChange={(e) => setLedgerAccount(e.currentTarget.value)} />
      </td>
      <td>
        <select value={accountType} onChange={(e) => setAccountType(e.currentTarget.value as AccountMappingInput["accountType"])}>
          <option value="asset">Asset</option>
          <option value="liability">Liability</option>
        </select>
      </td>
      <td className="numeric">{row.rawCount.toLocaleString()}</td>
      <td className="numeric">{row.processedCount.toLocaleString()}</td>
      <td>{row.latestTransactionDate ?? "n/a"}</td>
      <td>
        <button type="button" disabled={isPending || !dirty} onClick={saveMapping}>
          {isPending ? "Saving..." : "Save"}
        </button>
        {message ? <small>{message}</small> : null}
      </td>
    </tr>
  );
}

export function SourceSystemsWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  if (!dashboard.sourceAccounts.length) return <NoData message="NO SOURCE ACCOUNTS" />;

  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Ledger Mapping</th>
            <th>Type</th>
            <th className="numeric">Raw</th>
            <th className="numeric">Posted</th>
            <th>Latest</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {dashboard.sourceAccounts.map((row) => (
            <SourceAccountMappingRow row={row} key={row.accountId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
