import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  ClassifyTransactionInput,
  LedgerDashboardData,
  SuspenseItem,
} from "~/server/ledger";
import { formatMoney } from "./format";

const classifyFn = createServerFn({ method: "POST" })
  .validator((data: ClassifyTransactionInput) => data)
  .handler(async ({ data }) => {
    const { classifyTransaction } = await import("~/server/ledger");
    return classifyTransaction(data);
  });

const syncAndReclassifyFn = createServerFn({ method: "POST" })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { syncLedger, reclassifyLedger } = await import("~/server/ledger");
    const sync = await syncLedger({ accountId: data.accountId, delta: true });
    const reclassify = await reclassifyLedger();
    return {
      ok: sync.ok && reclassify.ok,
      stdout: [sync.stdout.trim(), reclassify.stdout.trim()].filter(Boolean).join("\n"),
      stderr: [sync.stderr.trim(), reclassify.stderr.trim()].filter(Boolean).join("\n"),
    };
  });

type ClassifyMode = ClassifyTransactionInput["mode"];

function QueueRow({
  item,
  knownAccounts,
}: {
  item: SuspenseItem;
  knownAccounts: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [account, setAccount] = useState("");
  const [mode, setMode] = useState<ClassifyMode>("rule");
  const [message, setMessage] = useState<string | null>(null);

  function classify() {
    if (!account) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await classifyFn({
          data: { externalId: item.externalId, targetAccount: account, mode },
        });
        if (!result.ok) {
          setMessage(result.stderr.trim() || "Classify failed.");
          return;
        }
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <article className="queue-item">
      <div className="queue-item-head">
        <div>
          <time>{item.transactionDate}</time>
          <strong>{item.description}</strong>
        </div>
        <span className="numeric">{formatMoney(item.amountCents)}</span>
      </div>
      <div className="queue-classify">
        <select
          aria-label={`Classify ${item.description}`}
          value={account}
          onChange={(e) => setAccount(e.currentTarget.value)}
        >
          <option value="">Classify as…</option>
          {knownAccounts.map((acct) => (
            <option key={acct} value={acct}>
              {acct}
            </option>
          ))}
        </select>
        <select
          aria-label="Classification scope"
          value={mode}
          onChange={(e) => setMode(e.currentTarget.value as ClassifyMode)}
        >
          <option value="rule">Rule</option>
          <option value="once">Just this one</option>
        </select>
        <button type="button" disabled={isPending || !account} onClick={classify}>
          {isPending ? "…" : "Classify"}
        </button>
      </div>
      {message ? <small className="queue-error">{message}</small> : null}
    </article>
  );
}

function SyncReclassify({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncAndReclassifyFn({ data: { accountId } });
        setMessage(result.ok ? "Synced" : result.stderr.trim() || "Sync failed.");
        await router.invalidate();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    });
  }

  return (
    <div className="queue-sync">
      <button type="button" disabled={isPending} onClick={run}>
        {isPending ? "Syncing…" : "Sync + reclassify"}
      </button>
      {message ? <small>{message}</small> : null}
    </div>
  );
}

export function SuspenseQueueWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const items = dashboard.suspenseQueue;
  const primaryAccount = dashboard.sourceAccounts[0];

  if (!items.length) {
    return (
      <div className="stack">
        {primaryAccount ? <SyncReclassify accountId={primaryAccount.accountId} /> : null}
        <div className="queue-clear">
          <strong>ALL CLASSIFIED</strong>
          <span>No transactions parked in suspense.</span>
        </div>
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
      {primaryAccount ? <SyncReclassify accountId={primaryAccount.accountId} /> : null}
      <div className="queue-list">
        {items.map((item) => (
          <QueueRow
            key={item.externalId}
            item={item}
            knownAccounts={dashboard.knownAccounts}
          />
        ))}
      </div>
    </div>
  );
}
