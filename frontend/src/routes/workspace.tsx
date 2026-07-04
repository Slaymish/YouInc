import {
  createFileRoute,
  redirect,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { PRODUCT } from "~/components/marketing/config";
import { ManualBalancesEditor } from "~/components/workspace/ManualBalancesEditor";
import { AkahuConnectPanel } from "~/components/workspace/AkahuConnectPanel";
import { formatMoney } from "~/components/widgets/format";
import type { AccountState } from "~/server/accounts";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import type { AkahuConnectionStatus } from "~/server/akahuConnection";
import "~/styles/auth.css";
import "~/styles/workspace.css";

const loadWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    account: AccountState | null;
    ledger: WorkspaceLedgerSummary | null;
    akahu: AkahuConnectionStatus | null;
  }> => {
    const { getAccountState } = await import("~/server/accounts");
    const account = await getAccountState();
    if (!account || !account.tenant)
      return { account, ledger: null, akahu: null };
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    const { getAkahuConnectionStatus } =
      await import("~/server/akahuConnection");
    const [ledger, akahu] = await Promise.all([
      getWorkspaceLedger(),
      getAkahuConnectionStatus(),
    ]);
    return { account, ledger, akahu };
  },
);

const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutUser } = await import("~/server/accounts");
  await signOutUser();
});

const loadSampleDataFn = createServerFn({ method: "POST" }).handler(
  async () => {
    const { loadSampleData } = await import("~/server/sampleIngestion");
    return loadSampleData();
  },
);

const refreshLedgerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceLedgerSummary> => {
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    return getWorkspaceLedger();
  },
);

export const Route = createFileRoute("/workspace")({
  loader: async () => {
    const data = await loadWorkspace();
    if (!data.account) throw redirect({ to: "/signin" });
    if (!data.account.tenant) throw redirect({ to: "/onboarding" });
    return data as {
      account: AccountState;
      ledger: WorkspaceLedgerSummary;
      akahu: AkahuConnectionStatus;
    };
  },
  component: WorkspacePage,
});

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="ws-metric">
      <span className="ws-metric__label">{label}</span>
      <strong className="ws-metric__value">{value}</strong>
      {hint ? <span className="ws-metric__hint">{hint}</span> : null}
    </div>
  );
}

function WorkspacePage() {
  const { account, ledger: initialLedger, akahu } = Route.useLoaderData();
  const router = useRouter();
  useLightTheme();
  const [busy, setBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [ledger, setLedger] = useState(initialLedger);
  const tenant = account.tenant!;

  const hasAccounts = ledger.totals.accountCount > 0;

  async function signOut() {
    setBusy(true);
    try {
      const { getSupabaseBrowserClient } =
        await import("~/lib/supabaseBrowser");
      await getSupabaseBrowserClient().auth.signOut();
      await signOutFn();
      await router.navigate({ to: "/" });
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    setSampleBusy(true);
    setSampleError(null);
    try {
      await loadSampleDataFn();
      setLedger(await refreshLedgerFn());
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : "Could not load sample data.",
      );
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <Link className="ws-topbar__logo" to="/">
          {PRODUCT.name}
        </Link>
        <div className="ws-topbar__account">
          <span>{account.email}</span>
          <button
            className="ws-signout"
            type="button"
            onClick={signOut}
            disabled={busy}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="ws-main">
        <section className="ws-hero">
          <p className="ws-eyebrow">
            {tenant.tier === "concierge" ? "Concierge" : "Self-serve"} workspace
          </p>
          <h1>{tenant.name}</h1>
          <p className="ws-lede">
            {hasAccounts
              ? "Your live financial position, from the accounts you're tracking."
              : "Add your accounts to see your net worth, assets, and liabilities at a glance."}
          </p>
        </section>

        <section className="ws-metrics" aria-label="Financial summary">
          <Metric
            label="Net worth"
            value={formatMoney(ledger.totals.netWorthCents)}
            hint={
              hasAccounts
                ? `${ledger.totals.accountCount} account${ledger.totals.accountCount === 1 ? "" : "s"}`
                : "No accounts yet"
            }
          />
          <Metric
            label="Assets"
            value={formatMoney(ledger.totals.assetsCents)}
          />
          <Metric
            label="Liabilities"
            value={formatMoney(ledger.totals.liabilitiesCents)}
          />
          <Metric
            label="Asset / liability"
            value={
              ledger.totals.assetLiabilityRatio != null
                ? `${ledger.totals.assetLiabilityRatio.toFixed(2)}×`
                : "—"
            }
          />
        </section>

        <section className="ws-panel" aria-labelledby="ws-accounts-heading">
          <div className="ws-panel__head">
            <h2 id="ws-accounts-heading">Your accounts</h2>
          </div>
          <ManualBalancesEditor summary={ledger} onChange={setLedger} />
        </section>

        {ledger.hasJournalBalances ? (
          <section className="ws-panel" aria-labelledby="ws-ledger-heading">
            <div className="ws-panel__head">
              <h2 id="ws-ledger-heading">Synced ledger</h2>
            </div>
            <div className="ws-ledger">
              <p className="ws-ledger__note">
                Balances below are derived from posted transactions in your
                double-entry ledger. Manual accounts above take precedence where
                they overlap.
              </p>
              <table className="mb-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th className="mb-numeric">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.balances
                    .filter((b) => !b.isManual)
                    .map((b) => (
                      <tr key={b.account}>
                        <td>
                          <code className="mb-account">{b.account}</code>
                          <span
                            className={
                              "mb-tag mb-tag--" + b.accountType.toLowerCase()
                            }
                          >
                            {b.accountType}
                          </span>
                        </td>
                        <td className="mb-numeric">
                          {formatMoney(b.balanceCents)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="ws-panel" aria-labelledby="ws-akahu-heading">
          <div className="ws-panel__head">
            <h2 id="ws-akahu-heading">Connect your bank</h2>
          </div>
          <div style={{ padding: "1.25rem" }}>
            <AkahuConnectPanel status={akahu} onLedgerChange={setLedger} />
          </div>
        </section>

        <section className="ws-cards">
          <article className="ws-card">
            <h3>Try it with sample data</h3>
            <p>
              No bank connected yet? Load a sample transaction batch to see a
              synced double-entry ledger in action.
            </p>
            <button
              className="auth-secondary"
              type="button"
              onClick={loadSample}
              disabled={sampleBusy}
            >
              {sampleBusy ? "Loading sample data…" : "Load sample transactions"}
            </button>
            {sampleError ? (
              <small
                className="ws-card__note"
                role="alert"
                style={{ color: "var(--danger, #c0492f)" }}
              >
                {sampleError}
              </small>
            ) : null}
          </article>
          <article className="ws-card">
            <h3>See the full dashboard</h3>
            <p>
              Open the live demo to preview the widgets your workspace will grow
              into.
            </p>
            <a className="auth-secondary" href="/demo">
              Open the live demo →
            </a>
          </article>
        </section>

        <p className="ws-help">
          Want a bespoke setup, integration, or AI automation?{" "}
          <Link to="/custom-builds">Book a concierge build →</Link>
        </p>
      </main>
    </div>
  );
}
