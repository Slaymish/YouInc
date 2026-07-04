import { PRODUCT } from "./config";
import { SAMPLE_DASHBOARD } from "./sampleDashboard";
import { shortMoney, formatMonths, formatPercent } from "../widgets/format";
import { WaitlistForm } from "./WaitlistForm";
import "./Hero.css";

// ── Live product-proof figures ─────────────────────────────────────────────
// Every number below is DERIVED from SAMPLE_DASHBOARD (the same dataset /demo
// renders) so the hero can never drift from the real product. Computed once at
// module scope — pure, no per-render work.
const T = SAMPLE_DASHBOARD.totals;
const TREND = SAMPLE_DASHBOARD.netWorthTrend;

const netWorthLabel = shortMoney(T.netWorthCents); // $142.4k
const runwayLabel = formatMonths(T.runwayMonths); // 18.0m
const cashflowLabel = `+${shortMoney(T.ebitdaCents)}`; // +$3.7k

const topExpense = SAMPLE_DASHBOARD.expenseBreakdown[0];
const expenseTotalCents = SAMPLE_DASHBOARD.expenseBreakdown.reduce(
  (sum, row) => sum + row.amountCents,
  0,
);
const topExpenseName = topExpense.account.split(":").pop() ?? topExpense.account;
const topExpenseLabel = shortMoney(topExpense.amountCents); // $24.0k
const topExpenseShare = formatPercent(topExpense.amountCents / expenseTotalCents);

// Month-over-month net-worth delta for the chart header.
const nwValues = TREND.map((point) => point.netWorthCents);
const prevNetWorth = nwValues[nwValues.length - 2] ?? nwValues[nwValues.length - 1];
const lastNetWorth = nwValues[nwValues.length - 1];
const netWorthDelta = formatPercent(
  prevNetWorth === 0 ? 0 : (lastNetWorth - prevNetWorth) / prevNetWorth,
); // ~2.4%

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
  const y = CHART_H - CHART_PAD_Y - ((value - nwMin) / nwSpan) * (CHART_H - CHART_PAD_Y * 2);
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
const axisMonths = [TREND[0], TREND[Math.floor(TREND.length / 2)], TREND[TREND.length - 1]];

export function Hero() {
  const headlineWords = PRODUCT.heroHeadline.split(" ");
  const headlineLead = headlineWords.slice(0, -1).join(" ");
  const headlineLastWord = headlineWords[headlineWords.length - 1];

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero__copy">
        <p className="hero__eyebrow">{PRODUCT.heroEyebrow}</p>
        <h1 id="hero-heading" className="hero__headline">
          {headlineLead} <em>{headlineLastWord}</em>
        </h1>
        <p className="hero__sub">{PRODUCT.heroSub}</p>
        <div className="hero__ctas">
          <WaitlistForm source="hero" />
          <a className="mk-btn mk-btn--ghost" href="/demo">
            Try the free demo →
          </a>
        </div>

        {/* Mobile-only static stat row: on narrow screens the floating visual
            is hidden, so surface the same three headline figures statically. */}
        <dl className="hero__statrow">
          <div className="hero__stat">
            <dt>Net worth</dt>
            <dd>{netWorthLabel}</dd>
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

      <div className="hero__visual" aria-hidden="true">
        <figure className="hero__chart">
          <figcaption className="hero__chart-head">
            <span className="live-tag">
              <span className="live-dot" />
              LIVE
            </span>
            <span className="hero__chart-lab">Net worth</span>
            <span className="hero__chart-val">{netWorthLabel}</span>
            <span className="hero__chart-delta">▲ {netWorthDelta} this month</span>
          </figcaption>

          <div className="hero__plot">
            <svg
              className="hero__chart-svg"
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              preserveAspectRatio="none"
              role="presentation"
            >
              <defs>
                <linearGradient id="heroAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop className="hero__grad-top" offset="0%" />
                  <stop className="hero__grad-bot" offset="100%" />
                </linearGradient>
              </defs>
              <path className="hero__area" d={areaPath} fill="url(#heroAreaGrad)" />
              <path
                className="hero__line"
                d={linePath}
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span
              className="hero__dot"
              style={{ left: `${lastPoint.x}%`, top: `${(lastPoint.y / CHART_H) * 100}%` }}
            />
          </div>

          <div className="hero__axis">
            {axisMonths.map((point) => (
              <span key={point.month}>{monthLabel(point.month)}</span>
            ))}
          </div>
        </figure>

        <div className="fw fw--runway">
          <span className="fw__lab">Runway</span>
          <span className="fw__big">{runwayLabel}</span>
          <svg className="fw__spark" viewBox="0 0 100 20" preserveAspectRatio="none">
            <polyline
              points={sparkPoints}
              fill="none"
              stroke="var(--mk-dv-1)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
        <div className="fw fw--cash">
          <span className="fw__lab">Cashflow</span>
          <span className="fw__big">{cashflowLabel}</span>
          <span className="fw__up">▲ this month</span>
        </div>
        <div className="fw fw--expense">
          <span className="fw__lab">Top expense</span>
          <span className="fw__big">{topExpenseLabel}</span>
          <span className="fw__down">
            {topExpenseName} · {topExpenseShare}
          </span>
        </div>
      </div>
    </section>
  );
}
