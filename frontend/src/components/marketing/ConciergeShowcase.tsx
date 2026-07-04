import { BOOKING_URL } from "./config";

/**
 * Illustrations of bespoke Concierge work — an email brief, an AI anomaly
 * flag, a plain-English answer. These are designed mock artifacts, not shipped
 * features; the eyebrow and footnote frame them as examples of what gets built
 * for Concierge clients.
 */
export function ConciergeShowcase() {
  return (
    <section className="concierge" aria-labelledby="concierge-heading">
      <p className="mk-eyebrow">Concierge examples · built to order</p>
      <h2 id="concierge-heading" className="section-heading">
        What I build for Concierge clients.
      </h2>
      <p className="concierge__lede">
        A few illustrations of bespoke work — an AI agent that reads your board,
        anomaly detection, plain-English answers from your own ledger. Mock-ups,
        not stock features: this is the kind of thing I build for you.
      </p>

      <div className="concierge__grid">
        {/* The Monday Brief — email digest */}
        <article className="artifact artifact--brief">
          <header className="brief-mail__head">
            <span className="brief-mail__from">
              From <strong>YouInc</strong> · Monday 6:00 AM
            </span>
            <span className="brief-mail__tag">AI agent</span>
          </header>
          <p className="brief-mail__subject">
            Your week: runway holding at 18 months
          </p>
          <div className="brief-mail__body">
            <p>
              Net worth closed the week at{" "}
              <span className="num">$142,380</span>, up{" "}
              <span className="num pos">4.2%</span> on the month — assets rising
              faster than your one liability is falling.
            </p>
            <p>
              Cashflow ran <span className="num pos">+$3,240</span> for the
              period. At the current burn you have{" "}
              <span className="num">18 months</span> of runway before liquidity
              gets tight.
            </p>
            <p>
              One thing to watch: subscriptions crept up{" "}
              <span className="num neg">$6</span>. Details in the flag below.
            </p>
          </div>
          <footer className="brief-mail__foot">
            Sent every Monday, 6:00 AM · reply to ask a follow-up
          </footer>
        </article>

        {/* Anomaly flag */}
        <article className="artifact artifact--anomaly">
          <header className="anomaly__head">
            <span className="anomaly__tag">Flagged by AI</span>
            <time className="anomaly__date">28 Jun</time>
          </header>
          <p className="anomaly__title">Spotify Family jumped 35%</p>
          <div className="anomaly__bars" role="img" aria-label="Spotify charge rose from $16.90 to $22.90">
            <div className="anomaly__bar">
              <span className="anomaly__was" style={{ width: "53%" }} />
              <span className="anomaly__amt">$16.90</span>
            </div>
            <div className="anomaly__bar">
              <span className="anomaly__now" style={{ width: "72%" }} />
              <span className="anomaly__amt anomaly__amt--now">$22.90</span>
            </div>
          </div>
          <p className="anomaly__note">
            <span className="num neg">+$6.00 / mo</span> — that's{" "}
            <span className="num">$72</span> a year, quietly.
          </p>
        </article>

        {/* Plain-English Q&A */}
        <article className="artifact artifact--ask">
          <p className="ask__q">
            <span className="ask__who">You</span>
            Could I afford 3 months off next year?
          </p>
          <p className="ask__a">
            <span className="ask__who ask__who--ai">YouInc</span>
            Yes — with 18 months of runway and{" "}
            <span className="num pos">+$3,240</span> monthly surplus, a
            three-month gap leaves roughly <span className="num">14 months</span>{" "}
            of cover. Bank the surplus from now and you barely feel it.
          </p>
        </article>
      </div>

      <p className="concierge__foot">
        Every one of these was scoped from a single sentence a client said.{" "}
        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
          Tell me yours →
        </a>
      </p>
    </section>
  );
}
