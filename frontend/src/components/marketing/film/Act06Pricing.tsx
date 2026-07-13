import { Link } from "@tanstack/react-router";
import { PRICING_COPY } from "./filmCopy";
import { PricingLedger } from "./PricingLedger";
import "./act06-pricing.css";

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

        <PricingLedger />
      </div>
    </section>
  );
}
