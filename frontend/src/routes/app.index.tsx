import {
  createFileRoute,
  useLoaderData,
  useRouter,
  Link,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { HomeSummary } from "~/components/home/HomeSummary";
import { workspaceStage } from "~/server/workspaceStage";
import type { WorkspaceLedgerSummary } from "~/server/workspaceLedger";
import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { trackProductEvent } from "~/lib/productAnalytics";
import "~/components/home/home.css";

const loadSampleDataFn = createServerFn({ method: "POST" }).handler(async () => {
  const { loadSampleData } = await import("~/server/sampleIngestion");
  return loadSampleData();
});

const refreshLedgerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceLedgerSummary> => {
    const { getWorkspaceLedger } = await import("~/server/workspaceLedger");
    return getWorkspaceLedger();
  },
);

const refreshDashboardFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<LedgerDashboardData> => {
    const { getWorkspaceDashboard } = await import("~/server/workspaceDashboard");
    return getWorkspaceDashboard();
  },
);

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

/**
 * Home answers one question: am I OK? The control brief is the headline rather
 * than a card in a grid, the four numbers behind it come next, then anything
 * that needs a person, then what the app noticed. Fixed layout, nothing to
 * configure — four seconds and you leave.
 */
function AppHome() {
  const {
    account,
    ledger: initialLedger,
    dashboard,
  } = useLoaderData({ from: "/app" });
  const router = useRouter();
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [ledger, setLedger] = useState(initialLedger);
  const [dashboardData, setDashboardData] = useState(dashboard);
  const tenant = account.tenant!;

  useEffect(() => {
    trackProductEvent("dashboard_viewed");
  }, []);

  const stage = workspaceStage({
    accountCount: ledger.totals.accountCount,
    hasJournalBalances: ledger.hasJournalBalances,
  });
  const isEmpty = stage === "empty";

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
    <>
      <HomeSummary dashboard={dashboardData} subtitle={tenant.name} />

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
                Link a bank through Akahu and let YouInc build your ledger as
                transactions arrive.
              </p>
              <Link className="auth-primary" to="/app/accounts" hash="bank">
                Connect a bank →
              </Link>
            </li>
            <li className="ws-firstrun__step">
              <h3>Add an account yourself</h3>
              <p>
                No bank feed? Enter balances by hand to see your net worth right
                away.
              </p>
              <Link className="auth-secondary" to="/app/accounts" hash="manual">
                Add an account →
              </Link>
            </li>
            <li className="ws-firstrun__step">
              <h3>Try it with sample data</h3>
              <p>
                Not ready to connect anything? Load a sample batch to see it all
                working with real transactions.
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
                <small className="ws-firstrun__error" role="alert">
                  {sampleError}
                </small>
              ) : null}
            </li>
          </ol>
        </section>
      ) : null}

      {!isEmpty ? (
        <p className="home-sample">
          <button type="button" onClick={loadSample} disabled={sampleBusy}>
            {sampleBusy ? "Loading sample data…" : "Load sample transactions"}
          </button>
          <span>Adds another sample batch. Safe to run as many times as you like.</span>
          {sampleError ? <small role="alert">{sampleError}</small> : null}
        </p>
      ) : null}
    </>
  );
}
