import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardGrid } from "~/components/dashboard/DashboardGrid";
import { formatDateTime } from "~/components/widgets/format";
import { useLightTheme } from "~/components/marketing/useLightTheme";
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
const DEMO_STORAGE_KEY = "youinc.demo.layout.v1";

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
  useLightTheme();
  const dashboard = SAMPLE_DASHBOARD;

  return (
    <>
      <header className="mk demo-banner">
        <div>
          <strong>Live demo</strong> — sample data, same dashboard shell and
          widgets you get once your accounts are connected.
        </div>
        <nav className="demo-banner__cta">
          <Link className="mk-btn mk-btn--ghost" to="/">
            ← Back
          </Link>
          <a
            className="mk-btn mk-btn--primary"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
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
