import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { formatDateTime } from "~/components/widgets/format";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";
import { DEMO_WIDGET_IDS } from "~/components/marketing/demoWidgets";
import { BOOKING_URL } from "~/components/marketing/config";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing.css";

// Separate from the real dashboard's storage key so demo edits (tab/layout
// customization on sample data) never read from or clobber a real user's
// saved layout — see useDashboardLayout's `storageKey` option.
const DEMO_STORAGE_KEY = "youinc.demo.layout.v1";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  useLightTheme();
  const dashboard = SAMPLE_DASHBOARD;

  return (
    <>
      <header className="mk demo-banner">
        <div>
          <strong>Live demo</strong> — sample data, this is exactly what your
          dashboard looks like once your bank is connected.
        </div>
        <nav className="demo-banner__cta">
          <Link className="mk-btn mk-btn--ghost" to="/">
            ← Back
          </Link>
          <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            Book a call
          </a>
        </nav>
      </header>

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
            <a
              className="theme-toggle demo-header-cta"
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a call
            </a>
          </div>
        </header>

        <DashboardGrid
          dashboard={dashboard}
          storageKey={DEMO_STORAGE_KEY}
          allowedWidgetIds={DEMO_WIDGET_IDS}
        />
      </main>
    </>
  );
}
