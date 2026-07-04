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
import { formatMoney } from "~/components/widgets/format";
import type { AccountState } from "~/server/accounts";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import "~/styles/auth.css";
import "~/styles/workspace.css";

const loadWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    account: AccountState | null;
    ledger: WorkspaceLedgerSummary | null;
  }> => {
    const { getAccountState } = await import("~/server/accounts");
    const account = await getAccountState();
    if (!account || !account.tenant) return { account, ledger: null };
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    const ledger = await getWorkspaceLedger();
    return { account, ledger };
  },
);

const signOutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { signOutUser } = await import("~/server/accounts");
  await signOutUser();
});

export const Route = createFileRoute("/workspace")({
  loader: async () => {
    const data = await loadWorkspace();
    if (!data.account) throw redirect({ to: "/signin" });
    if (!data.account.tenant) throw redirect({ to: "/onboarding" });
    return data as { account: AccountState; ledger: WorkspaceLedgerSummary };
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
  const { account, ledger: initialLedger } = Route.useLoaderData();
  const router = useRouter();
  useLightTheme();
  const [busy, setBusy] = useState(false);
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

        <section className="ws-cards">
          <article className="ws-card">
            <h3>Connect a bank</h3>
            <p>
              Securely link your accounts through Akahu, New Zealand's
              open-finance provider, to keep balances current automatically.
            </p>
            <button className="auth-primary" type="button" disabled>
              Connect via Akahu (coming soon)
            </button>
            <small className="ws-card__note">
              Manual accounts work today; automatic sync is being rolled out.
            </small>
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
