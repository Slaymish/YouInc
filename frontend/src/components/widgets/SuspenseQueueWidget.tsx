import { useRouter } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  ClassifyTransactionInput,
  LedgerDashboardData,
  SuspenseItem,
} from "~/server/ledger";
import { formatMoney, leafAccount } from "./format";

const classifyFn = createServerFn({ method: "POST" })
  .validator((data: ClassifyTransactionInput) => data)
  .handler(async ({ data }) => {
    const { requireSession } = await import("~/server/auth");
    requireSession();
    const { classifyTransaction } = await import("~/server/ledger");
    return classifyTransaction(data);
  });

const syncAndReclassifyFn = createServerFn({ method: "POST" })
  .validator((data: { accountId: string }) => data)
  .handler(async ({ data }) => {
    const { requireSession } = await import("~/server/auth");
    requireSession();
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

const NEW_CATEGORY_OPTION = "__new_category__";

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
  const [newAccount, setNewAccount] = useState("");
  const [mode, setMode] = useState<ClassifyMode>("rule");
  const [message, setMessage] = useState<string | null>(null);

  const isNewCategory = account === NEW_CATEGORY_OPTION;
  const targetAccount = isNewCategory ? newAccount.trim() : account;

  function classify() {
    if (!targetAccount) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await classifyFn({
          data: { externalId: item.externalId, targetAccount, mode },
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

  const sourceAccount = item.counterAccount
    ? leafAccount(item.counterAccount)
    : "unknown account";
  const flowLabel =
    item.direction === "out"
      ? `Paid from ${sourceAccount}`
      : `Received into ${sourceAccount}`;

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
        <span className={`numeric queue-amount-${item.direction}`}>
          {formatMoney(item.amountCents)}
        </span>
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
          <option value={NEW_CATEGORY_OPTION}>+ New category…</option>
        </select>
        {isNewCategory ? (
          <input
            aria-label="New category account"
            placeholder="Income:Personal:Gifts"
            value={newAccount}
            onChange={(e) => setNewAccount(e.currentTarget.value)}
          />
        ) : null}
        <select
          aria-label="Classification scope"
          value={mode}
          onChange={(e) => setMode(e.currentTarget.value as ClassifyMode)}
        >
          <option value="rule">Rule</option>
          <option value="once">Just this one</option>
        </select>
        <button type="button" disabled={isPending || !targetAccount} onClick={classify}>
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

  // Sum magnitudes (not signed) so the header reflects total value parked,
  // not a near-zero net of offsetting inflows and outflows.
  const totalCents = items.reduce((sum, item) => sum + Math.abs(item.amountCents), 0);

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
