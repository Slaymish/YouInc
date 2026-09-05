import { useEffect, useRef, useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import "~/components/ui/toast.css";
import type {
  AkahuAccountSummary,
  AkahuConnectionStatus,
  AkahuSyncResult,
} from "~/server/akahuConnection";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";

// --- Server functions --------------------------------------------------------

const statusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AkahuConnectionStatus> => {
    const { getAkahuConnectionStatus } = await import("~/server/akahuConnection");
    return getAkahuConnectionStatus();
  },
);

const disconnectFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AkahuConnectionStatus> => {
    const { disconnectAkahu } = await import("~/server/akahuConnection");
    return disconnectAkahu();
  },
);

const listAccountsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AkahuAccountSummary[]> => {
    const { listConnectedAccounts } = await import("~/server/akahuConnection");
    return listConnectedAccounts();
  },
);

const syncFn = createServerFn({ method: "POST" })
  .validator((data: { accountId: string; fromDate?: string; toDate?: string }) => data)
  .handler(async ({ data }): Promise<AkahuSyncResult> => {
    const { syncAkahuAccount } = await import("~/server/akahuConnection");
    return syncAkahuAccount(data.accountId, data.fromDate, data.toDate);
  });

const refreshLedgerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceLedgerSummary> => {
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    return getWorkspaceLedger();
  },
);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sync failed. Please try again.';
}

interface Props {
  status: AkahuConnectionStatus;
  /** Called with the refreshed ledger after a successful sync. */
  onLedgerChange: (next: WorkspaceLedgerSummary) => void;
  /** Called after every sync attempt (success or failure) so a sync-history
   *  panel elsewhere on the page can refresh. */
  onSynced?: () => void;
}

function defaultFromDate(): string {
  return new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function AkahuConnectPanel({ status: initialStatus, onLedgerChange, onSynced }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [accounts, setAccounts] = useState<AkahuAccountSummary[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState("");
  // Disconnect gets a two-step confirm rather than an undo: it destroys the
  // Vault-stored Akahu token, and only Akahu can issue a replacement.
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const disconnectRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  // Move focus onto the confirm button, and back to the trigger on cancel, so
  // the step is reachable and escapable without a pointer.
  useEffect(() => {
    if (confirmingDisconnect) confirmRef.current?.focus();
    else if (wasConfirming.current) disconnectRef.current?.focus();
    wasConfirming.current = confirmingDisconnect;
  }, [confirmingDisconnect]);

  function disconnect() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const next = await disconnectFn();
        setStatus(next);
        setAccounts(null);
        setConfirmingDisconnect(false);
        setMessage(
          "Akahu disconnected. Reconnecting means authorising a new token with Akahu.",
        );
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function cancelDisconnect() {
    setConfirmingDisconnect(false);
    setMessage("Disconnect cancelled.");
  }

  function loadAccounts() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        setAccounts(await listAccountsFn());
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function sync(accountId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await syncFn({
          data: { accountId, fromDate: fromDate || undefined, toDate: toDate || undefined },
        });
        onLedgerChange(await refreshLedgerFn());
        setStatus((s) => ({ ...s, lastSyncedAt: new Date().toISOString() }));
        setMessage(
          `Synced ${result.fetched} transaction${result.fetched === 1 ? "" : "s"}: ` +
            `${result.posted} posted, ${result.skippedDuplicate} already seen, ` +
            `${result.skippedPending} pending skipped.`,
        );
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        onSynced?.();
      }
    });
  }

  if (!status.appConfigured) {
    return (
      <div className="akahu-panel">
        <p className="akahu-panel__note">
          Live bank sync via Akahu isn't enabled on this server yet. You can still
          track accounts manually above, or load sample transactions to preview the
          synced ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="akahu-panel">
      {status.connected ? (
        <>
          <p className="akahu-panel__status">
            <span className="akahu-dot" aria-hidden="true" /> Connected to Akahu
            {status.lastSyncedAt ? (
              <span className="akahu-panel__meta">
                {" "}· last synced {new Date(status.lastSyncedAt).toLocaleString("en-NZ")}
              </span>
            ) : null}
          </p>

          <div className="akahu-panel__actions">
            <button className="auth-primary" type="button" onClick={loadAccounts} disabled={pending}>
              {pending && accounts === null ? "Loading…" : "Load my accounts"}
            </button>
            {confirmingDisconnect ? (
              <div
                className="confirm-inline"
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelDisconnect();
                }}
              >
                <p className="confirm-inline__prompt">
                  Really disconnect? Your Akahu token will be revoked — you'll
                  need to authorise a new one with Akahu to reconnect.
                </p>
                <button
                  ref={confirmRef}
                  className="auth-secondary akahu-panel__disconnect"
                  type="button"
                  onClick={disconnect}
                  disabled={pending}
                >
                  {pending ? "Disconnecting…" : "Yes, disconnect"}
                </button>
                <button
                  className="auth-secondary"
                  type="button"
                  onClick={cancelDisconnect}
                  disabled={pending}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                ref={disconnectRef}
                className="auth-secondary akahu-panel__disconnect"
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setConfirmingDisconnect(true);
                }}
                disabled={pending}
              >
                Disconnect
              </button>
            )}
          </div>

          {accounts !== null ? (
            accounts.length === 0 ? (
              <p className="akahu-panel__note">No Akahu accounts found for this token.</p>
            ) : (
              <>
                <div className="akahu-panel__range">
                  <label>
                    From
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      disabled={pending}
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      placeholder="today"
                      disabled={pending}
                    />
                  </label>
                  <span className="akahu-panel__meta">
                    Defaults to the last 90 days through today when left blank.
                  </span>
                </div>
                <ul className="akahu-accounts">
                  {accounts.map((a) => (
                    <li key={a.id}>
                      <div>
                        <strong>{a.name}</strong>
                        <code className="akahu-accounts__id">{a.id}</code>
                        {a.status?.toUpperCase() === "INACTIVE" ? (
                          <p className="mb-error" role="alert">
                            This account needs attention. Reconnect with Akahu to resume updates.
                          </p>
                        ) : null}
                      </div>
                      <button type="button" onClick={() => sync(a.id)} disabled={pending}>
                        Sync
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : null}
        </>
      ) : (
        <p className="akahu-panel__note">
          Bank sync is optional. Set AKAHU_APP_TOKEN and AKAHU_USER_TOKEN in your
          local environment file, then restart YouInc. After replacing a revoked
          token, use Settings to enable sync again.
        </p>
      )}

      {message ? <p className="akahu-panel__ok" role="status">{message}</p> : null}
      {error ? <p className="mb-error" role="alert">{error}</p> : null}
    </div>
  );
}
