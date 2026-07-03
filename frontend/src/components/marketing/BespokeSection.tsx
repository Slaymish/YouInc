import { BOOKING_URL } from "./config";

export function BespokeSection() {
  return (
    <section className="bespoke" aria-labelledby="bespoke-heading">
      <p className="hero__eyebrow">What nobody else offers</p>
      <h2 id="bespoke-heading" className="section-heading">
        Missing a widget? A custom integration? <em>I build it for you.</em>
      </h2>
      <p className="bespoke__body">
        Most tools hand you a rigid template and wish you luck. YouInc is the opposite: tell me
        how you actually think about your money, and I build the widget, report, or integration
        to match. You get a dashboard that fits you, not the other way around.
      </p>
      <p className="bespoke__body">
        That includes AI. I build AI infrastructure for a living — an agent that reads your
        board and emails you a Monday-morning brief, anomaly detection that catches the
        subscription that quietly doubled, plain-English questions answered from your own
        ledger. If you can describe it, it can run on your numbers.
      </p>
      <a className="mk-btn mk-btn--primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
        Book a call →
      </a>
    </section>
  );
}
