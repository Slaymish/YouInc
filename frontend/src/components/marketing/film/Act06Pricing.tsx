import { Link } from "@tanstack/react-router";
import { PRICING, BOOKING_URL } from "../config";
import { PRICING_COPY } from "./filmCopy";
import "./act06-pricing.css";

type Tier = (typeof PRICING)[keyof typeof PRICING];

interface TierRow {
  readonly key: string;
  readonly tier: Tier;
  readonly featured?: boolean;
  readonly cta: { readonly kind: "link"; readonly to: string } | { readonly kind: "external"; readonly href: string };
}

const ROWS: readonly TierRow[] = [
  { key: "demo", tier: PRICING.demo, cta: { kind: "link", to: "/demo" } },
  { key: "free", tier: PRICING.free, cta: { kind: "link", to: "/signup" } },
  {
    key: "selfServe",
    tier: PRICING.selfServe,
    featured: true,
    cta: { kind: "link", to: "/signup" },
  },
  {
    key: "concierge",
    tier: PRICING.concierge,
    cta: { kind: "external", href: BOOKING_URL },
  },
];

function hasCadence(tier: Tier): tier is Tier & { cadence: string } {
  return "cadence" in tier;
}

export function Act06Pricing() {
  return (
    <section className="act-pricing" id="pricing" aria-labelledby="pricing-heading">
      <div className="act-pricing__inner">
        <header className="act-pricing__head">
          <p className="mk-eyebrow">
            <span className="mk-eyebrow__index">{PRICING_COPY.eyebrow.index}</span>
            <span className="mk-eyebrow__sep" aria-hidden="true">
              /
            </span>
            <span className="mk-eyebrow__label">{PRICING_COPY.eyebrow.label}</span>
          </p>
          <h2 id="pricing-heading" className="act-pricing__headline mk-display">
            {PRICING_COPY.headline}
          </h2>
          <Link className="act-pricing__compare" to="/pricing">
            Full comparison →
          </Link>
        </header>

        <div className="act-pricing__ledger">
          {ROWS.map(({ key, tier, featured, cta }) => (
            <article
              className={`act-pricing__row${featured ? " act-pricing__row--featured" : ""}`}
              key={key}
            >
              {featured ? (
                <span className="act-pricing__flag">MOST POPULAR</span>
              ) : null}
              <div className="act-pricing__name">
                <h3>{tier.name}</h3>
              </div>
              <div className="act-pricing__price">
                <span className="act-pricing__amount">{tier.price}</span>
                {hasCadence(tier) ? (
                  <span className="act-pricing__cadence">{tier.cadence}</span>
                ) : null}
              </div>
              <ul className="act-pricing__features">
                {tier.features.map((f) => (
                  <li key={f}>
                    <span className="act-pricing__tick" aria-hidden="true">
                      +
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="act-pricing__action">
                {cta.kind === "link" ? (
                  <Link
                    className={`mk-btn ${featured ? "mk-btn--primary" : "mk-btn--ghost"}`}
                    to={cta.to}
                  >
                    <span className="mk-btn__label">{tier.cta}</span>
                  </Link>
                ) : (
                  <a
                    className="mk-btn mk-btn--ghost"
                    href={cta.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="mk-btn__label">{tier.cta}</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
