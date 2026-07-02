// frontend/src/components/marketing/Pricing.tsx
import { BOOKING_URL, PRICING } from "./config";
import { WaitlistForm } from "./WaitlistForm";

export function Pricing() {
  return (
    <section className="pricing" aria-labelledby="pricing-heading">
      <h2 id="pricing-heading" className="section-heading">Pricing</h2>
      <div className="pricing__grid">
        <article className="tier">
          <h3 className="tier__name">{PRICING.demo.name}</h3>
          <p className="tier__price">{PRICING.demo.price}</p>
          <ul className="tier__features">
            {PRICING.demo.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <a className="mk-btn mk-btn--ghost" href="/demo">Open the demo →</a>
        </article>

        <article className="tier tier--featured">
          <h3 className="tier__name">{PRICING.selfServe.name}</h3>
          <p className="tier__price">{PRICING.selfServe.price}<span className="tier__cadence">{PRICING.selfServe.cadence}</span></p>
          <ul className="tier__features">
            {PRICING.selfServe.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <WaitlistForm source="pricing" />
        </article>

        <article className="tier">
          <h3 className="tier__name">{PRICING.concierge.name}</h3>
          <p className="tier__price">{PRICING.concierge.price}<span className="tier__cadence">{PRICING.concierge.cadence}</span></p>
          <ul className="tier__features">
            {PRICING.concierge.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
            {PRICING.concierge.cta}
          </a>
        </article>
      </div>
    </section>
  );
}
