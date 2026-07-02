import { BOOKING_URL } from "./config";

export function BespokeSection() {
  return (
    <section className="bespoke" aria-labelledby="bespoke-heading">
      <p className="hero__eyebrow">What nobody else offers</p>
      <h2 id="bespoke-heading" className="section-heading">
        Missing a widget? A custom integration? <em>I build it for you.</em>
      </h2>
      <p className="bespoke__body">
        Most tools hand you a rigid template and wish you luck. YouInc is different: tell me how
        you actually think about your money, and I'll build the widget, report, or integration to
        match — fast. You get a dashboard that fits you, not the other way around.
      </p>
      <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
        Book a call →
      </a>
    </section>
  );
}
