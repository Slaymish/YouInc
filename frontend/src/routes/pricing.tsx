import { createFileRoute } from "@tanstack/react-router";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { MarketingHeader } from "~/components/marketing/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/MarketingFooter";
import { PricingTable } from "~/components/marketing/PricingTable";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/PricingTable.css";
import "~/components/marketing/pricing-page.css";

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
  }),
  component: PricingPage,
});

function PricingPage() {
  useLightTheme();
  return (
    <div className="mk">
      <MarketingHeader />
      <main>
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
