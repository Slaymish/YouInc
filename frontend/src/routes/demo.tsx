import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { RouteLoadDial } from "~/components/dashboard/RouteLoadDial";
import { formatDateTime } from "~/components/widgets/format";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { SAMPLE_DASHBOARD } from "~/components/marketing/sampleDashboard";
import { DEMO_WIDGET_IDS } from "~/components/marketing/demoWidgets";
import { BOOKING_URL } from "~/components/marketing/config";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/demo.css";

// Separate from the real dashboard's storage key so demo edits (tab/layout
// customization on sample data) never read from or clobber a real user's
// saved layout — see useDashboardLayout's `storageKey` option.
const DEMO_STORAGE_KEY = "youinc.demo.layout.v3";

const DEMO_DESCRIPTION =
  "Explore the full YouInc dashboard on sample data — the same shell and widgets you get once your accounts are connected, with no sign-up and no bank connection.";

const DEMO_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "WebPage",
      name: "YouInc live demo",
      description: DEMO_DESCRIPTION,
      url: `${SITE_URL}/demo`,
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Live demo", path: "/demo" },
    ]),
  ]),
);

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live demo — YouInc" },
      { name: "description", content: DEMO_DESCRIPTION },
    ],
    scripts: [DEMO_JSON_LD],
  }),
  component: DemoPage,
});

function DemoPage() {
  useDarkTheme();
  const dashboard = SAMPLE_DASHBOARD;

  return (
    <>
      <RouteLoadDial label="Loading sample dashboard" tone="dark" />
      <header className="mk demo-banner">
        <span className="demo-banner__mode">
          Sample company data
        </span>
        <div className="demo-banner__copy">
          <strong>A working ledger.</strong> Move between views, then customize
          the workspace to see how it adapts.
        </div>
        <nav className="demo-banner__cta">
          <Link className="mk-btn mk-btn--ghost" to="/">
            ← Back
          </Link>
          <Link className="mk-btn mk-btn--primary" to="/signup">
            Start free
          </Link>
        </nav>
      </header>

      <main className="mk system-shell dashboard-canvas">
        <header className="system-header">
          <div className="system-header__title">
            <p>Executive ledger</p>
            <h1>Your position,<br /><em>made visible.</em></h1>
            <p className="system-header__lede">
              One decision surface for cash, runway, wealth and the books behind them.
            </p>
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
                <dt>Transactions</dt>
                <dd>
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
