import { useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import type {
  AkahuAccountSummary,
  AkahuConnectionStatus,
  AkahuSyncResult,
} from "~/server/akahuConnection";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";

// --- Server functions --------------------------------------------------------

const connectFn = createServerFn({ method: "POST" })
  .validator((userToken: string) => userToken)
  .handler(async ({ data: userToken }): Promise<AkahuConnectionStatus> => {
    const { connectAkahu } = await import("~/server/akahuConnection");
    return connectAkahu(userToken);
  });

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
  .validator((accountId: string) => accountId)
  .handler(async ({ data: accountId }): Promise<AkahuSyncResult> => {
    const { syncAkahuAccount } = await import("~/server/akahuConnection");
    return syncAkahuAccount(accountId);
  });

const refreshLedgerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceLedgerSummary> => {
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    return getWorkspaceLedger();
  },
);

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong — please try again.";
}

interface Props {
  status: AkahuConnectionStatus;
  /** Called with the refreshed ledger after a successful sync. */
  onLedgerChange: (next: WorkspaceLedgerSummary) => void;
}

export function AkahuConnectPanel({ status: initialStatus, onLedgerChange }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<AkahuAccountSummary[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function connect() {
    if (!token.trim()) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const next = await connectFn({ data: token.trim() });
        setStatus(next);
        setToken("");
        setMessage("Akahu connected. Load your accounts to sync.");
      } catch (err) {
        setError(errorMessage(err));
      }
    });
  }

  function disconnect() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const next = await disconnectFn();
        setStatus(next);
        setAccounts(null);
        setMessage("Akahu disconnected.");
      } catch (err) {
        setError(errorMessage(err));
      }
    });
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
        const result = await syncFn({ data: accountId });
        onLedgerChange(await refreshLedgerFn());
        setStatus((s) => ({ ...s, lastSyncedAt: new Date().toISOString() }));
        setMessage(
          `Synced ${result.fetched} transaction${result.fetched === 1 ? "" : "s"}: ` +
            `${result.posted} posted, ${result.skippedDuplicate} already seen, ` +
            `${result.skippedPending} pending skipped.`,
        );
      } catch (err) {
        setError(errorMessage(err));
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
            <button className="auth-secondary akahu-panel__disconnect" type="button" onClick={disconnect} disabled={pending}>
              Disconnect
            </button>
          </div>

          {accounts !== null ? (
            accounts.length === 0 ? (
              <p className="akahu-panel__note">No Akahu accounts found for this token.</p>
            ) : (
              <ul className="akahu-accounts">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.name}</strong>
                      <code className="akahu-accounts__id">{a.id}</code>
                    </div>
                    <button type="button" onClick={() => sync(a.id)} disabled={pending}>
                      Sync
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </>
      ) : (
        <>
          <p className="akahu-panel__note">
            Connect your bank through Akahu to sync transactions automatically. Paste
            your Akahu <strong>user token</strong> from{" "}
            <a href="https://my.akahu.io" target="_blank" rel="noopener noreferrer">
              my.akahu.io
            </a>
            . It's stored encrypted and never shown again.
          </p>
          <div className="akahu-panel__connect">
            <input
              aria-label="Akahu user token"
              type="password"
              autoComplete="off"
              placeholder="user_token_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={pending}
            />
            <button className="auth-primary" type="button" onClick={connect} disabled={pending || !token.trim()}>
              {pending ? "Connecting…" : "Connect Akahu"}
            </button>
          </div>
        </>
      )}

      {message ? <p className="akahu-panel__ok" role="status">{message}</p> : null}
      {error ? <p className="mb-error" role="alert">{error}</p> : null}
    </div>
  );
}
