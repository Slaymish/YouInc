import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "~/components/app/AppShell";
import { everydayNav } from "~/components/app/nav";
import { RouteLoadDial } from "~/components/dashboard/RouteLoadDial";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";
import "~/styles/auth.css";
import "~/styles/workspace.css";
import "~/components/dashboard/dashboard.css";
import "~/components/marketing/marketing-tokens.css";

// The demo is the application, not a picture of it: the same shell, the same
// pages, the same interactions — running on a seeded ledger instead of your
// accounts. Settings and the Workshop are left out; the accounts screen carries
// the install prompt instead of a bank connection.
const DEMO_DESCRIPTION =
  "The YouInc application running on sample transactions — every screen, no sign-up, nothing to install.";

const DEMO_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "WebPage",
      name: "YouInc demo",
      description: DEMO_DESCRIPTION,
      url: `${SITE_URL}/demo`,
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Demo", path: "/demo" },
    ]),
  ]),
);

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo — YouInc" },
      { name: "description", content: DEMO_DESCRIPTION },
    ],
    scripts: [DEMO_JSON_LD],
  }),
  component: DemoLayout,
});

const DEMO_NAV = everydayNav("/demo");

function DemoLayout() {
  return (
    <AppShell
      homeTo="/demo"
      subtitle="Sample data"
      everyday={DEMO_NAV}
      secondary={[]}
      foot={
        <>
          <p className="app-sidebar__email">Nothing here is your money.</p>
          <Link className="app-chip" to="/docs">
            Run your own copy
          </Link>
        </>
      }
    >
      <RouteLoadDial label="Loading the demo" />
      <Outlet />
    </AppShell>
  );
}
