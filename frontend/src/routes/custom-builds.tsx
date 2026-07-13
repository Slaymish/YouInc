import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKING_URL, PRICING } from "~/components/marketing/config";
import { useDarkTheme } from "~/components/marketing/system/useDarkTheme";
import { Atmosphere } from "~/components/marketing/system/Atmosphere";
import { MarketingHeader } from "~/components/marketing/shell/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/shell/MarketingFooter";
import { ConciergeShowcase } from "~/components/marketing/ConciergeShowcase";
import { breadcrumbList, jsonLdGraph, jsonLdScript } from "~/lib/seo";
import { SITE_URL } from "~/lib/sitemap";
import "~/components/marketing/marketing-tokens.css";
import "~/components/marketing/system/base.css";
import "~/components/marketing/system/primitives.css";
import "~/components/marketing/marketing-shared.css";
import "~/components/marketing/custom-builds.css";

const CUSTOM_BUILDS_JSON_LD = jsonLdScript(
  jsonLdGraph([
    {
      "@type": "Product",
      name: "YouInc Concierge custom builds",
      description:
        "Bespoke widgets, integrations, and AI agents built on your live YouInc ledger by the person who built the product.",
      url: `${SITE_URL}/custom-builds`,
      offers: [
        {
          "@type": "Offer",
          name: "Scoped one-off build",
          price: 1500,
          priceCurrency: "NZD",
          url: `${SITE_URL}/custom-builds`,
          description: "A defined widget, integration, or agent — fixed quote up front.",
        },
        {
          "@type": "Offer",
          name: PRICING.concierge.name,
          price: 149,
          priceCurrency: "NZD",
          url: `${SITE_URL}/custom-builds`,
          description: PRICING.concierge.features.join("; "),
        },
      ],
    },
    breadcrumbList(SITE_URL, [
      { name: "Home", path: "/" },
      { name: "Custom builds", path: "/custom-builds" },
    ]),
  ]),
);

export const Route = createFileRoute("/custom-builds")({
  head: () => ({
    meta: [
      { title: "Custom builds — YouInc" },
      {
        name: "description",
        content:
          "Bespoke widgets, integrations, and AI agents built on your live YouInc ledger by the person who built the product.",
      },
    ],
    scripts: [CUSTOM_BUILDS_JSON_LD],
  }),
  component: CustomBuildsPage,
});

const BUILD_AREAS = [
  {
    title: "Custom widgets",
    body: "Your dashboard is a grid of live widgets over a double-entry ledger. If the view you want doesn't exist — a mortgage payoff curve, a per-project P&L, a savings race against a date — I design it, build it, and add it to your board.",
  },
  {
    title: "Integrations",
    body: "NZ bank feeds come through Akahu. I wire in what banks can't see: KiwiSaver, portfolio balances, or a spreadsheet you still rely on — anything with an export or an API, posted as journal entries so it still balances.",
  },
  {
    title: "AI infrastructure",
    body: "Agents that read your ledger, not your inbox. A Monday brief, anomaly detection, or plain-English answers from your own numbers — scoped to a real decision, not a chatbot bolted on top.",
  },
];

const ENGAGEMENT_STEPS = [
  {
    n: "01",
    title: "We talk",
    body: "A short call. You tell me how you think about your money and what the current product is missing.",
  },
  {
    n: "02",
    title: "I scope it",
    body: "You get a fixed quote for a defined build — a widget, an integration, an agent. No open-ended hourly meter.",
  },
  {
    n: "03",
    title: "I build on your live board",
    body: "The work happens against your real ledger, not a mock-up. You see the widget or integration land with your numbers in it.",
  },
  {
    n: "04",
    title: "We iterate",
    body: "You live with it for a while, then we adjust. Concierge clients keep a direct line for tweaks, new builds, and new ideas.",
  },
];

function CustomBuildsPage() {
  useDarkTheme();
  return (
    <div className="mk">
      <Atmosphere />
      <MarketingHeader />
      <main className="mk-content mk-page">
        <section className="cb-hero" aria-labelledby="cb-heading">
          <p className="mk-eyebrow">
            Concierge · bespoke work on your live ledger
          </p>
          <h1 id="cb-heading" className="cb-hero__headline">
            Get your own <em>finance engineer.</em>
          </h1>
          <p className="cb-hero__sub">
            I built YouInc — the ledger, the widgets, the AI layer. Concierge
            means I build the next piece for you: the widget that doesn't exist
            yet, the integration your bank can't do, or the agent that watches
            the numbers you care about.
          </p>
          <div className="cb-hero__ctas">
            <a
              className="mk-btn mk-btn--primary"
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a call →
            </a>
            <Link className="mk-btn mk-btn--ghost" to="/demo">
              Try the demo first
            </Link>
          </div>
        </section>

        <section className="cb-what" aria-labelledby="cb-what-heading">
          <p className="mk-eyebrow">What I build</p>
          <h2 id="cb-what-heading" className="section-heading">
            Three kinds of work, one ledger underneath.
          </h2>
          <div className="cb-what__grid">
            {BUILD_AREAS.map((area) => (
              <article className="cb-card" key={area.title}>
                <h3 className="cb-card__title">{area.title}</h3>
                <p className="cb-card__body">{area.body}</p>
              </article>
            ))}
          </div>
        </section>

        <ConciergeShowcase />

        <section className="cb-steps" aria-labelledby="cb-steps-heading">
          <h2 id="cb-steps-heading" className="section-heading">
            How an engagement works
          </h2>
          <ol className="steps__list">
            {ENGAGEMENT_STEPS.map((s) => (
              <li className="step" key={s.n}>
                <span className="step__n">{s.n}</span>
                <h3 className="step__title">{s.title}</h3>
                <p className="step__body">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cb-pricing" aria-labelledby="cb-pricing-heading">
          <h2 id="cb-pricing-heading" className="section-heading">
            What it costs
          </h2>
          <div className="cb-pricing__figures">
            <div className="cb-figure">
              <p className="cb-figure__label">Scoped one-off builds</p>
              <p className="cb-figure__price">
                from <span className="num">NZD $1,500</span>
              </p>
              <p className="cb-figure__note">
                A defined widget, integration, or agent — fixed quote up front.
              </p>
            </div>
            <div className="cb-figure">
              <p className="cb-figure__label">{PRICING.concierge.name}</p>
              <p className="cb-figure__price">
                <span className="num">{PRICING.concierge.price}</span>
                <span className="cb-figure__cadence">
                  {PRICING.concierge.cadence}
                </span>
              </p>
              <p className="cb-figure__note">
                Everything in Self-serve, plus ongoing bespoke work and a direct
                line for questions.
              </p>
            </div>
          </div>
          <a
            className="mk-btn mk-btn--primary"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a call →
          </a>
          <p className="cb-pricing__foot">
            The call costs nothing. If there is a fit, you leave with a clear
            next step and a number.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
