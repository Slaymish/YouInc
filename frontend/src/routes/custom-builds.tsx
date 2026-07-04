import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKING_URL, PRICING } from "~/components/marketing/config";
import { useLightTheme } from "~/components/marketing/useLightTheme";
import { MarketingHeader } from "~/components/marketing/MarketingHeader";
import { MarketingFooter } from "~/components/marketing/MarketingFooter";
import { ConciergeShowcase } from "~/components/marketing/ConciergeShowcase";
import "~/components/marketing/marketing.css";

export const Route = createFileRoute("/custom-builds")({
  head: () => ({
    meta: [
      { title: "Custom builds — YouInc" },
      {
        name: "description",
        content:
          "Bespoke widgets, integrations, and AI infrastructure built on your live YouInc ledger by the person who built the product.",
      },
    ],
  }),
  component: CustomBuildsPage,
});

const BUILD_AREAS = [
  {
    title: "Custom widgets",
    body: "Your dashboard is a grid of live widgets over a double-entry ledger — net worth, runway, cashflow, thirty-plus more. If the view you want doesn't exist — a mortgage payoff curve, a per-project P&L, a savings race against a date — I design it, build it, and it appears on your board.",
  },
  {
    title: "Integrations",
    body: "Every NZ bank already flows in live through Akahu. I wire in what banks can't see: KiwiSaver, portfolio balances, a spreadsheet you refuse to give up — anything with an export or an API, posted into your ledger as proper journal entries so it all still balances.",
  },
  {
    title: "AI infrastructure",
    body: "Agents that read your board, not your inbox. A Monday-morning brief in plain English, anomaly detection that catches the subscription that quietly doubled, questions answered straight from your own ledger. If you can describe it, it can run on your numbers.",
  },
];

const ENGAGEMENT_STEPS = [
  {
    n: "01",
    title: "We talk",
    body: "A short call. You tell me how you actually think about your money and what's missing — one sentence is usually enough to scope from.",
  },
  {
    n: "02",
    title: "I scope it",
    body: "You get a fixed quote for a defined build — a widget, an integration, an agent. No open-ended hourly meter.",
  },
  {
    n: "03",
    title: "I build on your live board",
    body: "The work happens against your real ledger, not a mock-up. You watch the widget land on your dashboard with your numbers in it.",
  },
  {
    n: "04",
    title: "We iterate",
    body: "You live with it for a while, then we adjust. Concierge clients keep a direct line for tweaks, new builds, and new ideas.",
  },
];

function CustomBuildsPage() {
  useLightTheme();
  return (
    <div className="mk">
      <MarketingHeader />
      <main>
        <section className="cb-hero" aria-labelledby="cb-heading">
          <p className="mk-eyebrow">Concierge · bespoke work on your live ledger</p>
          <h1 id="cb-heading" className="cb-hero__headline">
            Get your own <em>finance engineer.</em>
          </h1>
          <p className="cb-hero__sub">
            I built YouInc — the ledger, the widgets, the AI. Concierge means I build the next
            piece for you: the widget that doesn't exist yet, the integration your bank can't do,
            the agent that watches your numbers so you don't have to.
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
                <span className="cb-figure__cadence">{PRICING.concierge.cadence}</span>
              </p>
              <p className="cb-figure__note">
                Everything in Self-serve, plus ongoing bespoke work and a direct line.
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
            The call costs nothing and scoping is free — you'll leave with a number either way.
          </p>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
