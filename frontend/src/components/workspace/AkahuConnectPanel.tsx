import { useEffect, useState, useTransition } from "react";
import { createServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
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

const startTrialFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<AkahuConnectionStatus> => {
    const { startTrial } = await import("~/server/akahuConnection");
    return startTrial();
  },
);

const AKAHU_OAUTH_ERROR_COPY: Record<string, string> = {
  auth: "You need to be signed in to connect Akahu. Please sign in and try again.",
  not_configured: "Akahu OAuth isn't configured on this server yet.",
  denied: "Akahu authorization was cancelled or denied.",
  state: "Couldn't verify the Akahu connection request. Please try again.",
  exchange: "Couldn't complete the Akahu connection. Please try again.",
};

function akahuOAuthErrorMessage(code: string): string {
  return AKAHU_OAUTH_ERROR_COPY[code] ?? "Something went wrong connecting to Akahu.";
}

// Server errors that gate a plan-restricted action are prefixed
// "TIER_RESTRICTED: " (see akahuConnection.ts connectAkahu) so callers could
// branch on it without relying on the HTTP-ish status code, which doesn't
// survive the server-fn serialization boundary. The UI already hides the
// connect form for Free tenants, so this only surfaces if that check is
// somehow bypassed — strip the marker and show the human sentence.
const TIER_RESTRICTED_PREFIX = "TIER_RESTRICTED: ";

function errorMessage(error: unknown): string {
  const raw = (() => {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message: unknown }).message);
    }
    return "Something went wrong — please try again.";
  })();
  return raw.startsWith(TIER_RESTRICTED_PREFIX)
    ? raw.slice(TIER_RESTRICTED_PREFIX.length)
    : raw;
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

  // The OAuth callback (api.akahu.callback.ts) redirects the full browser
  // back to /workspace with either ?akahu_connected=1 or ?akahu_error=<code>.
  // Surface that as a banner once, strip it from the URL so a reload doesn't
  // re-show it, and refetch the connection status the callback just changed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("akahu_connected");
    const errorCode = params.get("akahu_error");
    if (!connected && !errorCode) return;

    if (connected) {
      setError(null);
      setMessage("Akahu connected. Load your accounts to sync.");
    } else if (errorCode) {
      setMessage(null);
      setError(akahuOAuthErrorMessage(errorCode));
    }

    params.delete("akahu_connected");
    params.delete("akahu_error");
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );

    startTransition(async () => {
      try {
        setStatus(await statusFn());
      } catch {
        // Keep the banner even if the refetch fails; a manual reload will
        // pick up the real status via the route loader.
      }
    });
    // Intentionally run once on mount only — this reads the URL the browser
    // just landed on after the OAuth redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function startTrial() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const next = await startTrialFn();
        setStatus(next);
        setMessage("Your 14-day free trial of live sync has started — connect your bank below.");
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
      {status.tier === "free" && status.canConnectLive && status.trialDaysLeft !== null ? (
        <p className="akahu-panel__trial" role="status">
          {status.trialDaysLeft} {status.trialDaysLeft === 1 ? "day" : "days"} of live
          sync left — <Link to="/pricing">add a card</Link> to keep it after your trial.
        </p>
      ) : null}
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
      ) : !status.canConnectLive ? (
        status.trialEndsAt === null ? (
          <>
            <p className="akahu-panel__note">
              Live bank sync keeps your accounts updating themselves. Try it free
              for 14 days — no card. After that it's NZD $15/mo and you can cancel
              anytime. Your manual accounts and every widget stay free either way.
            </p>
            <div className="akahu-panel__connect">
              <button
                className="auth-primary akahu-panel__connect-link"
                type="button"
                onClick={startTrial}
                disabled={pending}
              >
                {pending ? "Starting…" : "Try live sync free for 14 days"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="akahu-panel__note">
              Your free trial of live sync has ended. Add a card to keep your bank
              syncing automatically — NZD $15/mo, cancel anytime. Your data stays
              put, and manual accounts remain free.
            </p>
            <div className="akahu-panel__connect">
              <Link className="auth-primary akahu-panel__connect-link" to="/pricing">
                Keep live sync — add a card
              </Link>
            </div>
          </>
        )
      ) : status.oauthConfigured ? (
        <>
          <p className="akahu-panel__note">
            Connect your bank through Akahu to sync transactions automatically.
            You'll be taken to Akahu to authorize access, then brought back
            here — your token is stored encrypted and never shown again.
          </p>
          <div className="akahu-panel__connect">
            {/* Plain <a> (not TanStack Router's <Link>) so this is a real
                full-page navigation to the server route, not a client-side
                route match / fetch. */}
            <a className="auth-primary akahu-panel__connect-link" href="/api/akahu/oauth/start">
              Connect with Akahu
            </a>
          </div>
        </>
      ) : (
        <p className="akahu-panel__note">
          Akahu OAuth not configured — set AKAHU_SECRET + AKAHU_OAUTH_REDIRECT_URI
          and verify a Full App with OAuth enabled.
        </p>
      )}

      {message ? <p className="akahu-panel__ok" role="status">{message}</p> : null}
      {error ? <p className="mb-error" role="alert">{error}</p> : null}
    </div>
  );
}
