import {
  createFileRoute,
  useLoaderData,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { ManualBalancesEditor } from "~/components/workspace/ManualBalancesEditor";
import { WORKSPACE_WIDGET_IDS } from "~/components/workspace/workspaceWidgetIds";
import { formatMoney } from "~/components/widgets/format";
import { workspaceStage } from "~/server/workspaceStage";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

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

const refreshDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LedgerDashboardData> => {
    const { getWorkspaceDashboard } = await import(
      "~/server/workspaceDashboard"
    );
    return getWorkspaceDashboard();
  },
);

export const Route = createFileRoute("/workspace/")({
  component: WorkspaceOverview,
});

function WorkspaceOverview() {
  const {
    account,
    ledger: initialLedger,
    dashboard,
  } = useLoaderData({ from: "/workspace" });
  const router = useRouter();
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [ledger, setLedger] = useState(initialLedger);
  const [dashboardData, setDashboardData] = useState(dashboard);
  const tenant = account.tenant!;

  const stage = workspaceStage({
    accountCount: ledger.totals.accountCount,
    hasJournalBalances: ledger.hasJournalBalances,
  });
  const isEmpty = stage === "empty";

  // Manual edits update local state (instant metric feedback) and invalidate
  // the parent loader so the Settings tab stays consistent.
  function handleLedgerChange(next: WorkspaceLedgerSummary) {
    setLedger(next);
    void router.invalidate();
  }

  async function loadSample() {
    setSampleBusy(true);
    setSampleError(null);
    try {
      await loadSampleDataFn();
      const [nextLedger, nextDashboard] = await Promise.all([
        refreshLedgerFn(),
        refreshDashboardFn(),
      ]);
      setLedger(nextLedger);
      setDashboardData(nextDashboard);
      await router.invalidate();
    } catch (err) {
      setSampleError(
        err instanceof Error ? err.message : "Could not load sample data.",
      );
    } finally {
      setSampleBusy(false);
    }
  }

  return (
    <main className="ws-main">
      <section className="ws-hero">
        <p className="ws-eyebrow">
          {tenant.tier === "concierge" ? "Concierge" : "Self-serve"} workspace
        </p>
        <h1>{tenant.name}</h1>
        <p className="ws-lede">
          {isEmpty
            ? "Add your accounts to see your net worth, assets, and liabilities at a glance."
            : "Your financial position, the decisions it suggests, and the ledger behind it."}
        </p>
      </section>

      {isEmpty ? (
        <section className="ws-firstrun" aria-labelledby="ws-firstrun-heading">
          <div className="ws-firstrun__head">
            <h2 id="ws-firstrun-heading">Get started</h2>
            <p>Pick one — you can do the others later.</p>
          </div>
          <ol className="ws-firstrun__steps">
            <li className="ws-firstrun__step">
              <h3>Connect your bank</h3>
              <p>
                Link a bank securely through Akahu and let YouInc build your
                ledger automatically.
              </p>
              <Link
                className="auth-primary"
                to="/workspace/settings"
                hash="bank"
              >
                Connect a bank →
              </Link>
            </li>
            <li className="ws-firstrun__step">
              <h3>Add an account manually</h3>
              <p>
                No bank in Akahu? Enter balances by hand to see your net worth
                right away.
              </p>
              <Link className="auth-secondary" to="/workspace" hash="accounts">
                Add an account →
              </Link>
            </li>
            <li className="ws-firstrun__step">
              <h3>Try it with sample data</h3>
              <p>
                Not ready to connect anything? Load a sample batch to see a
                synced double-entry ledger in action.
              </p>
              <button
                className="auth-secondary"
                type="button"
                onClick={loadSample}
                disabled={sampleBusy}
              >
                {sampleBusy
                  ? "Loading sample data…"
                  : "Load sample transactions"}
              </button>
              {sampleError ? (
                <small className="ws-firstrun__error" role="alert">
                  {sampleError}
                </small>
              ) : null}
            </li>
          </ol>
        </section>
      ) : null}

      <section
        className="ws-dashboard-section"
        aria-labelledby="ws-dashboard-heading"
      >
        <h2 id="ws-dashboard-heading" className="ws-section-heading">
          Financial dashboard
        </h2>
        <DashboardGrid
          dashboard={dashboardData}
          storageKey={`youinc.workspace.layout.v3.${tenant.id}`}
          allowedWidgetIds={WORKSPACE_WIDGET_IDS}
        />
      </section>

      <section
        id="accounts"
        className="ws-panel"
        aria-labelledby="ws-accounts-heading"
      >
        <div className="ws-panel__head">
          <h2 id="ws-accounts-heading">Your accounts</h2>
        </div>
        <ManualBalancesEditor summary={ledger} onChange={handleLedgerChange} />
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

      {!isEmpty ? (
        <section className="ws-cards">
          <article className="ws-card">
            <h3>Load more sample data</h3>
            <p>
              Add another sample transaction batch to see the synced ledger grow
              (idempotent — safe to run again).
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
              <small className="ws-card__note" role="alert">
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
      ) : null}

      <p className="ws-help">
        Want a bespoke setup, integration, or AI automation?{" "}
        <Link to="/custom-builds">Book a concierge build →</Link>
      </p>
    </main>
  );
}
