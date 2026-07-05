// frontend/src/components/marketing/Pricing.tsx
//
// Light teaser only — four tiers, test-pinned copy untouched, each capped to
// its two headline features. Full feature-by-feature detail lives on the
// dedicated /pricing route (see PricingTable.tsx + routes/pricing.tsx).
import { Link } from "@tanstack/react-router";
import { BOOKING_URL, PRICING } from "./config";
import { StartFreeCta } from "./StartFreeCta";
import "./Pricing.css";

const TEASER_FEATURE_COUNT = 2;

export function Pricing() {
  return (
    <section className="pricing" aria-labelledby="pricing-heading">
      <p className="mk-eyebrow">Pricing</p>
      <h2 id="pricing-heading" className="section-heading">
        Four ways to run on YouInc.
      </h2>
      <div className="pricing__grid">
        <article className="tier">
          <h3 className="tier__name">{PRICING.demo.name}</h3>
          <p className="tier__price">{PRICING.demo.price}</p>
          <ul className="tier__features">
            {PRICING.demo.features.slice(0, TEASER_FEATURE_COUNT).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a className="mk-btn mk-btn--ghost" href="/demo">
            Open the demo →
          </a>
        </article>

        <article className="tier">
          <h3 className="tier__name">{PRICING.free.name}</h3>
          <p className="tier__price">
            {PRICING.free.price}
            <span className="tier__cadence">{PRICING.free.cadence}</span>
          </p>
          <ul className="tier__features">
            {PRICING.free.features.slice(0, TEASER_FEATURE_COUNT).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Link className="mk-btn mk-btn--ghost" to="/signup">
            {PRICING.free.cta} →
          </Link>
        </article>

        <article className="tier tier--featured">
          <p className="tier__chip">Recommended</p>
          <h3 className="tier__name">{PRICING.selfServe.name}</h3>
          <p className="tier__price">
            {PRICING.selfServe.price}
            <span className="tier__cadence">{PRICING.selfServe.cadence}</span>
          </p>
          <ul className="tier__features">
            {PRICING.selfServe.features
              .slice(0, TEASER_FEATURE_COUNT)
              .map((f) => (
                <li key={f}>{f}</li>
              ))}
          </ul>
          <StartFreeCta source="pricing" />
        </article>

        <article className="tier">
          <h3 className="tier__name">{PRICING.concierge.name}</h3>
          <p className="tier__price">
            {PRICING.concierge.price}
            <span className="tier__cadence">{PRICING.concierge.cadence}</span>
          </p>
          <ul className="tier__features">
            {PRICING.concierge.features
              .slice(0, TEASER_FEATURE_COUNT)
              .map((f) => (
                <li key={f}>{f}</li>
              ))}
          </ul>
          <a
            className="mk-btn mk-btn--primary"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {PRICING.concierge.cta}
          </a>
        </article>
      </div>
      <p className="pricing__compare">
        <Link to="/pricing">Compare all plans, feature by feature →</Link>
      </p>
    </section>
  );
}
