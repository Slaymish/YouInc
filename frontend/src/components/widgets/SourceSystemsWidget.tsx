import { useRouter } from "@tanstack/react-router";
import { useTransition, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { AccountMappingInput, LedgerDashboardData } from "~/server/ledger";

const saveAccountMappingFn = createServerFn({ method: "POST" })
  .validator((data: AccountMappingInput) => data)
  .handler(async ({ data }) => {
    const { requireSession } = await import("~/server/auth");
    requireSession();
    const { upsertAccountMapping } = await import("~/server/ledger");
    return upsertAccountMapping(data);
  });

function NoData({ message }: { message: string }) {
  return <p className="no-data">{message}</p>;
}

function creditLimitDollarsFor(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function SourceAccountMappingRow({
  row,
}: {
  row: LedgerDashboardData["sourceAccounts"][number];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ledgerAccount, setLedgerAccount] = useState(row.ledgerAccount);
  const [accountType, setAccountType] = useState<
    AccountMappingInput["accountType"]
  >(row.accountType);
  const [creditLimitDollars, setCreditLimitDollars] = useState(
    creditLimitDollarsFor(row.creditLimitCents),
  );
  const [message, setMessage] = useState<string | null>(null);

  const parsedLimitCents =
    creditLimitDollars.trim() === ""
      ? null
      : Math.round(parseFloat(creditLimitDollars) * 100);
  const limitValid =
    creditLimitDollars.trim() === "" ||
    (!Number.isNaN(parsedLimitCents) && (parsedLimitCents ?? 0) >= 0);

  const dirty =
    ledgerAccount !== row.ledgerAccount ||
    accountType !== row.accountType ||
    parsedLimitCents !== row.creditLimitCents;

  function saveMapping() {
    if (!limitValid) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await saveAccountMappingFn({
          data: {
            accountId: row.accountId,
            ledgerAccount,
            accountType,
            creditLimitCents:
              accountType === "liability" ? parsedLimitCents : null,
          },
        });
        setMessage("saved");
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <tr
      className={row.mappingStatus === "unmapped" ? "unmapped-row" : undefined}
    >
      <td>
        <strong>{row.accountId}</strong>
        <span>{row.mappingStatus}</span>
      </td>
      <td>
        <input
          className="mapping-input"
          value={ledgerAccount}
          onChange={(e) => setLedgerAccount(e.currentTarget.value)}
        />
      </td>
      <td>
        <select
          value={accountType}
          onChange={(e) =>
            setAccountType(
              e.currentTarget.value as AccountMappingInput["accountType"],
            )
          }
        >
          <option value="asset">Asset</option>
          <option value="liability">Liability</option>
        </select>
      </td>
      <td>
        {accountType === "liability" ? (
          <input
            className="mapping-input"
            placeholder="Credit limit (facility)"
            value={creditLimitDollars}
            onChange={(e) => setCreditLimitDollars(e.currentTarget.value)}
          />
        ) : (
          <span className="no-data">n/a</span>
        )}
      </td>
      <td className="numeric">{row.rawCount.toLocaleString()}</td>
      <td className="numeric">{row.processedCount.toLocaleString()}</td>
      <td>{row.latestTransactionDate ?? "n/a"}</td>
      <td>
        <button
          type="button"
          disabled={isPending || !dirty || !limitValid}
          onClick={saveMapping}
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {message ? <small>{message}</small> : null}
      </td>
    </tr>
  );
}

export function SourceSystemsWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  if (!dashboard.sourceAccounts.length)
    return <NoData message="NO SOURCE ACCOUNTS" />;

  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>Account</th>
            <th>Ledger Mapping</th>
            <th>Type</th>
            <th>Credit Limit</th>
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
