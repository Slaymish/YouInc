import { useRouter } from "@tanstack/react-router";
import { useTransition, useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import type { LedgerDashboardData, SyncLedgerInput, SyncLedgerResult } from "~/server/ledger";

const syncLedgerFn = createServerFn({ method: "POST" })
  .validator((data: SyncLedgerInput) => data)
  .handler(async ({ data }) => {
    const { syncLedger } = await import("~/server/ledger");
    return syncLedger(data);
  });

const reclassifyFn = createServerFn({ method: "POST" }).handler(async () => {
  const { reclassifyLedger } = await import("~/server/ledger");
  return reclassifyLedger();
});

function formatDateTime(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function TableList({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="table-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SyncResult({ result }: { result: SyncLedgerResult }) {
  const body = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
  return (
    <div className={`sync-result ${result.ok ? "ok" : "danger"}`} role="status">
      <strong>{result.ok ? "SYNC COMPLETE" : `SYNC FAILED${result.code ? ` (${result.code})` : ""}`}</strong>
      {body ? <pre>{body}</pre> : null}
    </div>
  );
}

export function IngestionWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncLedgerResult | null>(null);

  const primaryAccount = dashboard.sourceAccounts[0];

  const rows: Array<[string, string]> = [
    ["Raw", dashboard.pipeline.rawCached.toLocaleString()],
    ["Posted", dashboard.pipeline.posted.toLocaleString()],
    ["Pending", dashboard.pipeline.pending.toLocaleString()],
    ["Window", `${dashboard.pipeline.earliestTransactionDate ?? "n/a"} → ${dashboard.pipeline.latestTransactionDate ?? "n/a"}`],
    ["Last sync", formatDateTime(dashboard.pipeline.lastSeenAt)],
  ];

  function sync() {
    if (!primaryAccount) return;
    startTransition(async () => {
      const syncResult = await syncLedgerFn({ data: { accountId: primaryAccount.accountId, delta: true } });
      await reclassifyFn();
      setResult(syncResult);
      await router.invalidate();
    });
  }

  return (
    <div className="stack">
      <div className="sync-actions">
        <button type="button" disabled={isPending || !primaryAccount} onClick={sync}>
          {isPending ? "Syncing..." : "Sync"}
        </button>
        {primaryAccount ? <small className="form-hint">{primaryAccount.accountId}</small> : null}
      </div>
      {result ? <SyncResult result={result} /> : null}
      <TableList rows={rows} />
      <div className="db-path">{dashboard.databasePath}</div>
      {dashboard.syncState.length ? (
        <div className="sync-list">
          {dashboard.syncState.slice(0, 6).map((row) => (
            <span key={row.key}>{row.key}: {row.value}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
