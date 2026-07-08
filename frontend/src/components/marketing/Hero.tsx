import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PRODUCT } from "./config";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { shortMoney, formatMonths, formatPercent } from "../widgets/format";
import { StartFreeCta } from "./StartFreeCta";
import "./Hero.css";

// ── Live product-proof figures ─────────────────────────────────────────────
// Every number below is DERIVED from SAMPLE_DASHBOARD (the same dataset /demo
// renders) so the hero can never drift from the real product. Computed once at
// module scope — pure, no per-render work.
const T = SAMPLE_DASHBOARD.totals;
const TREND = SAMPLE_DASHBOARD.netWorthTrend;

const netWorthCents = T.netWorthCents;
const runwayLabel = formatMonths(T.runwayMonths); // 18.0m
const cashflowLabel = `+${shortMoney(T.ebitdaCents)}`; // +$3.7k

const topExpense = SAMPLE_DASHBOARD.expenseBreakdown[0];
const expenseTotalCents = SAMPLE_DASHBOARD.expenseBreakdown.reduce(
  (sum, row) => sum + row.amountCents,
  0,
);
const topExpenseName =
  topExpense.account.split(":").pop() ?? topExpense.account;
const topExpenseLabel = shortMoney(topExpense.amountCents); // $24.0k
const topExpenseShare = formatPercent(
  topExpense.amountCents / expenseTotalCents,
);

// Month-over-month net-worth delta for the chart header.
const nwValues = TREND.map((point) => point.netWorthCents);
const prevNetWorth =
  nwValues[nwValues.length - 2] ?? nwValues[nwValues.length - 1];
const lastNetWorth = nwValues[nwValues.length - 1];
const netWorthDelta = formatPercent(
  prevNetWorth === 0 ? 0 : (lastNetWorth - prevNetWorth) / prevNetWorth,
); // ~2.4%

// The surplus the product tells you to act on — its actual differentiator is
// "the one thing to do next", so we surface it as an insight, not just a stat.
const surplusLabel = `+${shortMoney(T.ebitdaCents)}`;

// ── Net-worth line-chart geometry (viewBox units; stretched with a
// non-scaling stroke so the line stays crisp at any width). ─────────────────
const CHART_W = 100;
const CHART_H = 42;
const CHART_PAD_Y = 4;
const nwMin = Math.min(...nwValues);
const nwMax = Math.max(...nwValues);
const nwSpan = nwMax - nwMin || 1;
const points = nwValues.map((value, index) => {
  const x = TREND.length === 1 ? 0 : (index / (TREND.length - 1)) * CHART_W;
  const y =
    CHART_H -
    CHART_PAD_Y -
    ((value - nwMin) / nwSpan) * (CHART_H - CHART_PAD_Y * 2);
  return { x, y };
});
const linePath = points
  .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
  .join(" ");
const areaPath = `${linePath} L${CHART_W} ${CHART_H} L0 ${CHART_H} Z`;
const lastPoint = points[points.length - 1];

// Runway sparkline — derived from the monthly P&L EBITDA series.
const ebitdaSeries = SAMPLE_DASHBOARD.pnl.map((row) => row.ebitdaCents);
const sparkMin = Math.min(...ebitdaSeries);
const sparkSpan = Math.max(...ebitdaSeries) - sparkMin || 1;
const sparkPoints = ebitdaSeries
  .map((value, index) => {
    const x = (index / (ebitdaSeries.length - 1)) * 100;
    const y = 17 - ((value - sparkMin) / sparkSpan) * 14;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  })
  .join(" ");

const monthLabel = (month: string): string => {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return new Intl.DateTimeFormat("en-NZ", { month: "short" }).format(date);
};
const axisMonths = [
  TREND[0],
  TREND[Math.floor(TREND.length / 2)],
  TREND[TREND.length - 1],
];

// SSR-safe layout effect: real layout effect on the client, no-op on server.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** True when the visitor has asked the OS to reduce motion. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * Count a number up to `target` on mount. SSR + the first client render show
 * the final value (so the number is correct without JS and hydration matches);
 * the layout effect resets to 0 before paint and eases up, so there's no flash.
 * Skipped entirely under reduced-motion.
 */
function useCountUp(target: number, enabled: boolean, durationMs = 1100): number {
  const [value, setValue] = useState(target);
  useIsoLayoutEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    let raf = 0;
    setValue(0);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, durationMs]);
  return value;
}

export function Hero() {
  const reduced = usePrefersReducedMotion();
  const animatedNetWorth = useCountUp(netWorthCents, !reduced);
  const panelRef = useRef<HTMLDivElement>(null);

  // Subtle pointer-driven tilt — makes the product panel feel physical without
  // a library. Disabled for reduced-motion and coarse (touch) pointers.
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== "mouse") return;
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--tilt-y", `${(px * 7).toFixed(2)}deg`);
    el.style.setProperty("--tilt-x", `${(-py * 5).toFixed(2)}deg`);
  };
  const resetTilt = () => {
    const el = panelRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-y", "0deg");
    el.style.setProperty("--tilt-x", "0deg");
  };

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__copy">
        <p className="hero__eyebrow">
          <span className="live-dot" aria-hidden="true" />
          {PRODUCT.heroEyebrow}
        </p>
        <h1 id="hero-heading" className="hero__headline">
          Run yourself{" "}
          <span className="hero__mark">
            like a company<span className="hero__mark-dot">.</span>
          </span>
        </h1>
        <p className="hero__sub">{PRODUCT.heroSub}</p>
        <div className="hero__ctas">
          <StartFreeCta source="hero" withDemo />
        </div>
        <p className="hero__reassure">{PRODUCT.heroReassurance}</p>

        {/* Mobile-only static stat row: on narrow screens the visual is
            hidden, so surface the same three headline figures statically. */}
        <dl className="hero__statrow">
          <div className="hero__stat">
            <dt>Net worth</dt>
            <dd>{shortMoney(netWorthCents)}</dd>
          </div>
          <div className="hero__stat">
            <dt>Runway</dt>
            <dd>{runwayLabel}</dd>
          </div>
          <div className="hero__stat">
            <dt>Cashflow</dt>
            <dd className="hero__stat--pos">{cashflowLabel}</dd>
          </div>
        </dl>
      </div>

      {/* One coherent "live dashboard" device — the outcome the product
          delivers — instead of scattered floating cards. Entirely decorative;
          the copy + mobile stat row carry the accessible content. */}
      <div className="hero__visual" aria-hidden="true">
        <div
          className="hero__device"
          ref={panelRef}
          onPointerMove={handlePointerMove}
          onPointerLeave={resetTilt}
        >
          <div className="hero__chrome">
            <span className="hero__dots">
              <i />
              <i />
              <i />
            </span>
            <span className="hero__url">youinc.com/dashboard</span>
            <span className="hero__live">
              <span className="live-dot" />
              LIVE · synced 2m ago
            </span>
          </div>

          <div className="hero__screen">
            <div className="hero__headrow">
              <div className="hero__metric">
                <span className="hero__metric-lab">Net worth</span>
                <span className="hero__metric-val">
                  {shortMoney(animatedNetWorth)}
                </span>
              </div>
              <span className="hero__delta">▲ {netWorthDelta} this month</span>
            </div>

            <figure className="hero__plotwrap">
              <div className="hero__plot">
                <svg
                  className="hero__chart-svg"
                  viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                  preserveAspectRatio="none"
                  role="presentation"
                >
                  <defs>
                    <linearGradient
                      id="heroAreaGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop className="hero__grad-top" offset="0%" />
                      <stop className="hero__grad-bot" offset="100%" />
                    </linearGradient>
                  </defs>
                  <path
                    className="hero__area"
                    d={areaPath}
                    fill="url(#heroAreaGrad)"
                  />
                  <path
                    className="hero__line"
                    d={linePath}
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span
                  className="hero__dot"
                  style={{
                    left: `${lastPoint.x}%`,
                    top: `${(lastPoint.y / CHART_H) * 100}%`,
                  }}
                />
              </div>
              <figcaption className="hero__axis">
                {axisMonths.map((point) => (
                  <span key={point.month}>{monthLabel(point.month)}</span>
                ))}
              </figcaption>
            </figure>

            <div className="hero__kpis">
              <div className="hero__kpi">
                <span className="hero__kpi-lab">Runway</span>
                <span className="hero__kpi-val">{runwayLabel}</span>
                <svg
                  className="hero__kpi-spark"
                  viewBox="0 0 100 20"
                  preserveAspectRatio="none"
                >
                  <polyline
                    points={sparkPoints}
                    fill="none"
                    stroke="var(--mk-dv-1)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              </div>
              <div className="hero__kpi">
                <span className="hero__kpi-lab">Cashflow</span>
                <span className="hero__kpi-val">{cashflowLabel}</span>
                <span className="hero__kpi-note hero__kpi-note--pos">
                  ▲ this month
                </span>
              </div>
              <div className="hero__kpi">
                <span className="hero__kpi-lab">Top expense</span>
                <span className="hero__kpi-val">{topExpenseLabel}</span>
                <span className="hero__kpi-note">
                  {topExpenseName} · {topExpenseShare}
                </span>
              </div>
            </div>

            <div className="hero__insight">
              <span className="hero__insight-tag">Do next</span>
              <span className="hero__insight-body">
                Allocate <strong>{surplusLabel}</strong> surplus toward runway.
              </span>
              <span className="hero__insight-go" aria-hidden="true">
                →
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
