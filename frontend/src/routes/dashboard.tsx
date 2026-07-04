import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { LedgerDashboardData } from "~/server/ledger";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { useTheme } from "~/hooks/useTheme";
import { formatDateTime } from "~/components/widgets/format";
import "~/components/dashboard/dashboard.css";

const getLedgerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("~/server/auth");
  requireSession();
  const { readLedgerDashboard } = await import("~/server/ledger");
  return readLedgerDashboard();
});

const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("~/server/auth");
  destroySession();
});

export const Route = createFileRoute("/dashboard")({
  loader: async () => getLedgerDashboard(),
  component: DashboardPage,
});

function EmptyLedgerState({ dashboard }: { dashboard: LedgerDashboardData }) {
  return (
    <section className="system-alert neutral">
      <strong>LEDGER NOT POPULATED</strong>
      <p>Initialize/sync the local ledger. This dashboard is empty until SQLite contains posted journals.</p>
      <code>python -m youinc_ledger.cli sync --mock-file tests/fixtures/akahu_transactions.json</code>
      <small>{dashboard.databasePath}</small>
    </section>
  );
}

function Alert({ title, body }: { title: string; body: string }) {
  return (
    <section className="system-alert danger" role="alert">
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}

function DashboardPage() {
  const dashboard = Route.useLoaderData();
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const hasLedgerData = dashboard.balances.length > 0 || dashboard.pnl.length > 0;

  async function logout() {
    await logoutFn();
    await router.navigate({ to: "/" });
  }

  return (
    <main className="system-shell">
      <header className="system-header">
        <div>
          <p>YouInc</p>
          <h1>Entity Control</h1>
        </div>
        <div className="header-controls">
          <dl>
            <div>
              <dt>Ledger</dt>
              <dd>{dashboard.databaseExists ? "ONLINE" : "NO DB"}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{formatDateTime(dashboard.generatedAt)}</dd>
            </div>
            <div>
              <dt>Raw / Posted</dt>
              <dd>
                {dashboard.pipeline.rawCached.toLocaleString()} /{" "}
                {dashboard.totals.transactionCount.toLocaleString()}
              </dd>
            </div>
          </dl>
          <button
            className="theme-toggle"
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"} mode
          </button>
          <button className="theme-toggle" type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>

      {dashboard.error ? <Alert title="DB READ ERROR" body={dashboard.error} /> : null}
      {!hasLedgerData ? <EmptyLedgerState dashboard={dashboard} /> : null}

      <DashboardGrid dashboard={dashboard} />
    </main>
  );
}
