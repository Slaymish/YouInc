import { createFileRoute } from "@tanstack/react-router";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { Atmosphere } from "~/components/marketing/system/Atmosphere";
import { MarketingHeader } from "~/components/marketing/shell/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/shell/MarketingFooter";
import { PricingTable } from "~/components/marketing/PricingTable";
import { PRICING } from "~/components/marketing/config";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/system/base.css";
import "~/components/marketing/system/primitives.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/PricingTable.css";
import "~/components/marketing/pricing-page.css";

// Pulls the numeric NZD amount out of the display strings already pinned by
// config.test.ts ("NZD $15", "From NZD $149", "Free") — never restates the
// price itself, just extracts it for the Offer schema below.
function parseNzdAmount(price: string): number {
  const match = /([\d,.]+)/.exec(price);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

const PRICING_URL = `${SITE_URL}/pricing`;

const PRICING_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "Product",
      name: "YouInc",
      description:
        "Personal finance ledger and executive dashboard with live bank sync via Akahu, manual accounts, and plain-text ledger exports.",
      url: PRICING_URL,
      offers: [PRICING.demo, PRICING.selfServe, PRICING.concierge].map((tier) => ({
        "@type": "Offer",
        name: tier.name,
        price: parseNzdAmount(tier.price),
        priceCurrency: "NZD",
        url: PRICING_URL,
        description: tier.features.join("; "),
      })),
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Pricing", path: "/pricing" },
    ]),
  ]),
);

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — YouInc" },
      {
        name: "description",
        content:
          "Compare YouInc's Demo, Self-serve, and Concierge plans feature by feature, including live sync, exports, support, and bespoke work.",
      },
    ],
    scripts: [PRICING_JSON_LD],
  }),
  component: PricingPage,
});

function PricingPage() {
  useDarkTheme();
  return (
    <div className="mk">
      <Atmosphere />
      <MarketingHeader />
      <main className="mk-content mk-page">
        <section
          className="pricing-page__intro"
          aria-labelledby="pricing-page-heading"
        >
          <p className="mk-eyebrow">Pricing</p>
          <h1 id="pricing-page-heading" className="pricing-page__headline">
            Every plan, every detail.
          </h1>
          <p className="pricing-page__sub">
            Start with sample data, move to your own live ledger for a flat
            monthly fee, or bring in bespoke work when you need something built.
            Exports are included, and the differences are clear before you sign
            up.
          </p>
        </section>

        <section
          className="pricing-page__table"
          aria-labelledby="pricing-page-table-heading"
        >
          <h2 id="pricing-page-table-heading" className="visually-hidden">
            Plan comparison
          </h2>
          <PricingTable />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
