import { Link } from "@tanstack/react-router";
import "./DashboardFrame.css";

/**
 * A single honest artifact instead of a grid of warped cards: a framed
 * miniature of the real product (browser chrome → system header → tab row →
 * an asymmetric composition of REAL widgets), with editorial margin notes
 * pinned to it. The whole frame is decorative (aria-hidden) — the accessible
 * content is the heading and the "explore the demo" link around it.
 *
 * The canvas itself is a real dashboard render (see
 * `public/marketing/dashboard-overview*.svg`) rather than a re-rendered
 * widget grid, so it reads as an actual screenshot. Desktop and mobile
 * renders have fixed, known dimensions, so both are reserved via
 * `aspect-ratio` (kept in sync with the `width`/`height` attributes below)
 * for zero layout shift regardless of which one the browser picks.
 */

const DESKTOP_SRC = "/marketing/dashboard-overview.svg";
const DESKTOP_WIDTH = 1140;
const DESKTOP_HEIGHT = 720;

const MOBILE_SRC = "/marketing/dashboard-overview-mobile.svg";
const MOBILE_WIDTH = 780;
const MOBILE_HEIGHT = 1200;

const MOBILE_BREAKPOINT = "(max-width: 600px)";

export function DashboardFrame() {
  return (
    <section className="showcase" aria-labelledby="showcase-heading">
      <p className="mk-eyebrow">The product</p>
      <h2 id="showcase-heading" className="section-heading">
        One live ledger, rendered as your executive dashboard.
      </h2>

      <div className="df-stage">
        <div className="df-frame" aria-hidden="true">
          {/* Browser chrome */}
          <div className="df-chrome">
            <span className="df-dots">
              <span className="df-dot" />
              <span className="df-dot" />
              <span className="df-dot" />
            </span>
            <span className="df-url">
              <svg
                viewBox="0 0 12 12"
                className="df-lock"
                width="10"
                height="10"
                aria-hidden="true"
              >
                <rect
                  x="2.5"
                  y="5.5"
                  width="7"
                  height="5"
                  rx="1"
                  fill="currentColor"
                />
                <path
                  d="M4 5.5V4a2 2 0 0 1 4 0v1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
              youinc.com/dashboard
            </span>
            <span className="df-chrome__spacer" />
          </div>

          {/* Scrollable canvas fallback — the real product render. `picture`
              swaps to the portrait mobile render below the breakpoint; both
              sources carry their true dimensions so CSS can reserve the
              right aspect ratio before either file loads. */}
          <div className="df-scroll">
            <picture>
              <source media={MOBILE_BREAKPOINT} srcSet={MOBILE_SRC} />
              <img
                className="df-canvas-image"
                src={DESKTOP_SRC}
                width={DESKTOP_WIDTH}
                height={DESKTOP_HEIGHT}
                alt="YouInc executive dashboard showing net worth trend, cashflow waterfall, and expense and income breakdowns rendered live from the ledger."
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </div>

      <Link className="mk-btn mk-btn--primary df-cta" to="/demo">
        Explore the full live demo →
      </Link>
    </section>
  );
}
