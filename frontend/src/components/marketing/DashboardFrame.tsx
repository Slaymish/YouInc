import { Link } from "@tanstack/react-router";
import { renderWidgetContent } from "../dashboard/renderWidget";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { noop } from "./noop";
import type { WidgetId } from "../dashboard/widgets";

/**
 * A single honest artifact instead of a grid of warped cards: a framed
 * miniature of the real product (browser chrome → system header → tab row →
 * an asymmetric composition of REAL widgets), with editorial margin notes
 * pinned to it. The whole frame is decorative (aria-hidden) — the accessible
 * content is the heading and the "explore the demo" link around it.
 */

function Panel({
  id,
  title,
  area,
}: {
  id: WidgetId;
  title: string;
  area: string;
}) {
  return (
    <div className={`panel df-panel df-panel--${area}`}>
      <header>
        <h2>{title}</h2>
      </header>
      <div className="panel-body">
        {renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}
      </div>
    </div>
  );
}

function Metric({ id, area }: { id: WidgetId; area: string }) {
  return (
    <div className={`metric df-metric df-metric--${area}`}>
      {renderWidgetContent(id, SAMPLE_DASHBOARD, noop)}
    </div>
  );
}

export function DashboardFrame() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <p className="mk-eyebrow">The product</p>
      <h2 id="showcase-heading" className="section-heading">
        One live ledger, rendered as your executive dashboard.
      </h2>

      <div className="df-stage">
        {/* Margin notes — serif, hand-annotated, with thin connector lines */}
        <figure className="df-note df-note--a" aria-hidden="true">
          <span className="df-note__text">Every line posted straight from your bank</span>
          <span className="df-note__line" />
        </figure>
        <figure className="df-note df-note--b" aria-hidden="true">
          <span className="df-note__line" />
          <span className="df-note__text">Double-entry, so it always balances</span>
        </figure>
        <figure className="df-note df-note--c" aria-hidden="true">
          <span className="df-note__text">Drag anything anywhere</span>
          <span className="df-note__line" />
        </figure>

        <div className="df-frame" aria-hidden="true">
          {/* Browser chrome */}
          <div className="df-chrome">
            <span className="df-dots">
              <span className="df-dot" />
              <span className="df-dot" />
              <span className="df-dot" />
            </span>
            <span className="df-url">
              <svg viewBox="0 0 12 12" className="df-lock" width="10" height="10" aria-hidden="true">
                <rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="currentColor" />
                <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
              youinc.app/dashboard
            </span>
            <span className="df-chrome__spacer" />
          </div>

          {/* Scrollable canvas — the product screenshot */}
          <div className="df-scroll">
            <div className="df-canvas">
              {/* System header */}
              <div className="df-head">
                <div className="df-head__brand">
                  <p>YouInc</p>
                  <h3>Entity Control</h3>
                </div>
                <dl className="df-head__stats">
                  <div>
                    <dt>Ledger</dt>
                    <dd>ONLINE</dd>
                  </div>
                  <div>
                    <dt>Accounts</dt>
                    <dd>7</dd>
                  </div>
                  <div>
                    <dt>Raw / Posted</dt>
                    <dd>4,912 / 4,912</dd>
                  </div>
                </dl>
              </div>

              {/* Tab row */}
              <div className="df-tabs">
                <span className="df-tab df-tab--active">Overview</span>
                <span className="df-tab">Cashflow</span>
                <span className="df-tab">Balance sheet</span>
              </div>

              {/* Asymmetric widget composition — one hero, supporting parts */}
              <div className="df-grid">
                <Panel id="net-worth-trend" title="Net Worth Trend" area="hero" />
                <Metric id="metric-net-worth" area="m1" />
                <Metric id="metric-runway" area="m2" />
                <Panel id="expense-breakdown" title="Expense Breakdown" area="wide" />
                <Panel id="income-breakdown" title="Income Breakdown" area="side" />
                <Panel id="cashflow-waterfall" title="Cashflow Waterfall" area="foot" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link className="mk-btn mk-btn--primary df-cta" to="/demo">
        Explore the full live demo →
      </Link>
    </section>
  );
}
