import { BOOKING_URL } from "./config";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import "./ConciergeShowcase.css";

/**
 * Illustrations of bespoke Concierge work, one per "shape" the work can take:
 * a weekly email brief, an opportunity flag (KiwiSaver top-up), an AI anomaly
 * flag, a plain-English answer, a time-sensitive flag (mortgage rate roll-off),
 * and a live goal tracker. These are designed mock artifacts, not shipped
 * features; the eyebrow and footnote frame them as examples of what gets built
 * for Concierge clients.
 *
 * The headline figures (net worth, cashflow, runway) bind to
 * `SAMPLE_DASHBOARD.totals` so those artifacts never drift from `/demo`; the
 * KiwiSaver/mortgage/goal figures are illustrative and hand-set.
 */
function formatWholeDollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(cents) / 100).toLocaleString("en-NZ")}`;
}

const { totals } = SAMPLE_DASHBOARD;
const runwayMonths = totals.runwayMonths ?? 0;
const netWorthDisplay = formatWholeDollars(totals.netWorthCents);
const cashflowDisplay = `+${formatWholeDollars(totals.ebitdaCents)}`;
const runwayDisplay = `${runwayMonths} months`;

export function ConciergeShowcase() {
  return (
    <section className="concierge" aria-labelledby="concierge-heading">
      <p className="mk-eyebrow">Concierge examples · built to order</p>
      <h2 id="concierge-heading" className="section-heading">
        What I build for Concierge clients.
      </h2>
      <p className="concierge__lede">
        Examples of the shape bespoke work can take — a weekly brief, a flag on
        your bank feed, a plain-English answer, or a live tracker for the goal
        you're chasing. Each is scoped around the decision you want to make, not
        sold as a generic add-on.
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
            Your week: runway holding at {runwayDisplay}
          </p>
          <div className="brief-mail__body">
            <p>
              Net worth closed the week at{" "}
              <span className="num">{netWorthDisplay}</span>, up{" "}
              <span className="num pos">4.2%</span> on the month — assets rising
              faster than your one liability is falling.
            </p>
            <p>
              Cashflow ran <span className="num pos">{cashflowDisplay}</span>{" "}
              for the period. At the current burn you have{" "}
              <span className="num">{runwayDisplay}</span> of runway before
              liquidity gets tight.
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

        {/* KiwiSaver government top-up — an opportunity flag (free money, deadline) */}
        <article className="artifact artifact--opty">
          <header className="opty__head">
            <span className="opty__tag">Spotted for you</span>
            <time className="opty__date">12 Jun</time>
          </header>
          <p className="opty__title">KiwiSaver: claim the government top-up</p>
          <p className="opty__body">
            You've put in <span className="num">$703</span> this year —{" "}
            <span className="num">$340</span> short of the{" "}
            <span className="num">$1,043</span> that unlocks the full{" "}
            <span className="num pos">$261</span> government contribution.
          </p>
          <p className="opty__deadline">
            <span className="opty__pill">18 days left</span> Top up before 30
            June or it's gone for the year.
          </p>
        </article>

        {/* Anomaly flag */}
        <article className="artifact artifact--anomaly">
          <header className="anomaly__head">
            <span className="anomaly__tag">Flagged by AI</span>
            <time className="anomaly__date">28 Jun</time>
          </header>
          <p className="anomaly__title">Spotify Family jumped 35%</p>
          <div
            className="anomaly__bars"
            role="img"
            aria-label="Spotify charge rose from $16.90 to $22.90"
          >
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
            Yes — with {runwayDisplay} of runway and{" "}
            <span className="num pos">{cashflowDisplay}</span> monthly surplus,
            a three-month gap leaves roughly{" "}
            <span className="num">{runwayMonths - 3} months</span> of cover.
            Bank the surplus from now and you barely feel it.
          </p>
        </article>

        {/* Mortgage rate roll-off — a time-sensitive flag with a cost of inaction */}
        <article className="artifact artifact--rate">
          <header className="rate__head">
            <span className="rate__tag">Heads-up · time-sensitive</span>
            <time className="rate__date">3 Jul</time>
          </header>
          <p className="rate__title">
            Your fixed rate ends in <span className="num">58 days</span>
          </p>
          <dl className="rate__compare">
            <div className="rate__row rate__row--bad">
              <dt>Do nothing → rolls to floating</dt>
              <dd>
                <span className="num">7.89%</span>
                <span className="num neg">+$180/wk</span>
              </dd>
            </div>
            <div className="rate__row rate__row--good">
              <dt>Refix 2-year today</dt>
              <dd>
                <span className="num">5.79%</span>
                <span className="num pos">locked in</span>
              </dd>
            </div>
          </dl>
          <p className="rate__note">
            Start the reprice now — banks take weeks to confirm.
          </p>
        </article>

        {/* Goal race — a live widget tracking savings against a target date */}
        <article className="artifact artifact--goal">
          <header className="goal__head">
            <span className="goal__tag">Live widget · goal tracker</span>
            <span className="goal__eta">On pace · ETA Dec 2027, 3 mo ahead</span>
          </header>
          <p className="goal__title">
            House deposit — <span className="num">$90,000</span> by Mar 2028
          </p>
          <div
            className="goal__track"
            role="img"
            aria-label="House deposit: $58,000 saved of $90,000, 64% of the way there"
          >
            <span className="goal__fill" style={{ width: "64%" }} />
            <span className="goal__marker" style={{ left: "64%" }} />
          </div>
          <div className="goal__legend">
            <span>
              <span className="num pos">$58,000</span> saved
            </span>
            <span className="goal__muted">
              64% · <span className="num">$32,000</span> to go
            </span>
            <span className="goal__muted">
              Saving <span className="num">$1,850</span>/mo
            </span>
          </div>
        </article>
      </div>

      <p className="concierge__foot">
        Bring the question you keep asking yourself.{" "}
        <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">
          Tell me yours →
        </a>
      </p>
    </section>
  );
}
