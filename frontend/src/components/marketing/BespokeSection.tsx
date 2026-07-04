import { BOOKING_URL } from "./config";
import "./BespokeSection.css";

export function BespokeSection() {
  return (
    <section className="bespoke" aria-labelledby="bespoke-heading">
      <p className="mk-eyebrow">Built around how you think</p>
      <h2 id="bespoke-heading" className="section-heading">
        Missing a widget? A custom integration? <em>I build it for you.</em>
      </h2>
      <div className="bespoke__panel">
        <p className="bespoke__body">
          Most tools hand you a template and ask you to adapt. YouInc goes the
          other way: tell me how you think about your money, and I build the
          widget, report, or integration to match.
        </p>
        <p className="bespoke__body">
          For Concierge clients, that can include AI agents, anomaly checks,
          custom integrations, or a one-off view that answers the question you
          keep coming back to.
        </p>
      </div>
      <a
        className="mk-btn mk-btn--primary"
        href={BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Book a call →
      </a>
    </section>
  );
}
