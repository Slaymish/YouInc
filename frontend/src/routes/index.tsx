import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { LedgerDashboardData } from "~/server/ledger";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import "~/components/dashboard/dashboard.css";

const getLedgerDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("~/server/auth");
  requireSession();
  const { readLedgerDashboard } = await import("~/server/ledger");
  return readLedgerDashboard();
});

export const Route = createFileRoute("/")({
  loader: async () => getLedgerDashboard(),
  component: DashboardPage,
});

type Theme = "light" | "dark";

function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("youinc-theme");
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("youinc-theme", theme);
  }, [theme]);

  return [theme ?? "light", setTheme] as const;
}

function formatDateTime(value: string | null) {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

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
  const [theme, setTheme] = useTheme();
  const hasLedgerData = dashboard.balances.length > 0 || dashboard.pnl.length > 0;

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
        </div>
      </header>

      {dashboard.error ? <Alert title="DB READ ERROR" body={dashboard.error} /> : null}
      {!hasLedgerData ? <EmptyLedgerState dashboard={dashboard} /> : null}

      <DashboardGrid dashboard={dashboard} />
    </main>
  );
}
