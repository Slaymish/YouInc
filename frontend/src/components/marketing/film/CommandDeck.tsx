import { SAMPLE_DASHBOARD } from "../sampleDashboard";
import { formatMoney, shortMoney } from "../../widgets/format";
import "./command-deck.css";

// Dark-themed marketing replica of the real CFO dashboard, fed from the same
// sample data as /demo. A designed object (like the old DashboardFrame), not a
// live widget mount — so it can be composed for the film with full control.

const D = SAMPLE_DASHBOARD;
const NET_WORTH = D.totals.netWorthCents;
const TREND = D.netWorthTrend;
const FIRST_NW = TREND[0].netWorthCents;
const LAST_NW = TREND[TREND.length - 1].netWorthCents;
const NW_DELTA_PCT = ((LAST_NW - FIRST_NW) / FIRST_NW) * 100;

// ── Net worth trend — an SVG area+line built from the 12 trend points ──────
function TrendChart() {
  const w = 460;
  const h = 130;
  const values = TREND.map((p) => p.netWorthCents);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * (h - 16) - 8;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      className="cd-trend__svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Net worth trend, up ${NW_DELTA_PCT.toFixed(0)} percent over 12 months`}
    >
      <defs>
        <linearGradient id="cd-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mk-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--mk-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="cd-trend__area" d={area} fill="url(#cd-trend-fill)" />
      <path className="cd-trend__line" d={line} />
      <circle className="cd-trend__dot" cx={lastX} cy={lastY} r="3.2" />
    </svg>
  );
}

// ── Cashflow — income vs expense bars per month from the P&L rows ──────────
function CashflowBars() {
  const rows = D.pnl;
  const max = Math.max(...rows.map((r) => Math.max(r.incomeCents, r.expensesCents)));
  return (
    <div className="cd-bars" role="img" aria-label="Monthly income versus expenses">
      {rows.map((r) => (
        <div className="cd-bars__col" key={r.month}>
          <div className="cd-bars__pair">
            <span
              className="cd-bars__bar cd-bars__bar--in"
              style={{ height: `${(r.incomeCents / max) * 100}%` }}
            />
            <span
              className="cd-bars__bar cd-bars__bar--out"
              style={{ height: `${(r.expensesCents / max) * 100}%` }}
            />
          </div>
          <span className="cd-bars__label">{r.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Balance sheet — top asset/liability lines with proportion bars ─────────
function BalanceRows() {
  const rows = [...D.balances]
    .sort((a, b) => Math.abs(b.balanceCents) - Math.abs(a.balanceCents))
    .slice(0, 5);
  const max = Math.max(...rows.map((r) => Math.abs(r.balanceCents)));
  return (
    <ul className="cd-balance">
      {rows.map((r) => {
        const isAsset = r.accountType === "Assets";
        const leaf = r.account.split(":").slice(-2).join(" · ");
        return (
          <li className="cd-balance__row" key={r.account}>
            <span className="cd-balance__name">{leaf}</span>
            <span className="cd-balance__track">
              <span
                className={`cd-balance__fill${isAsset ? "" : " cd-balance__fill--neg"}`}
                style={{ width: `${(Math.abs(r.balanceCents) / max) * 100}%` }}
              />
            </span>
            <span
              className={`cd-balance__amt${isAsset ? "" : " cd-balance__amt--neg"}`}
            >
              {shortMoney(r.balanceCents)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function CommandDeck() {
  return (
    <div className="cd" aria-label="YouInc CFO dashboard, sample data">
      <div className="cd__chrome">
        <span className="cd__title">ENTITY CONTROL</span>
        <span className="cd__meta">
          <span className="cd__dot" aria-hidden="true" />
          LIVE · SAMPLE DATA
        </span>
      </div>

      <div className="cd__grid">
        <div className="cd__tile cd__tile--hero">
          <span className="cd__k">Net worth</span>
          <span className="cd__v cd__v--xl" data-countup={NET_WORTH}>
            {formatMoney(NET_WORTH)}
          </span>
          <span className="cd__delta cd__delta--pos">
            ▲ {NW_DELTA_PCT.toFixed(1)}% · 12 mo
          </span>
        </div>

        <div className="cd__tile cd__tile--metric">
          <span className="cd__k">Runway</span>
          <span className="cd__v" data-countup={D.totals.runwayMonths} data-unit="mo">
            {D.totals.runwayMonths} mo
          </span>
          <span className="cd__sub">at current overhead</span>
        </div>

        <div className="cd__tile cd__tile--trend">
          <div className="cd__tile-head">
            <span className="cd__k">Net worth trend</span>
            <span className="cd__k cd__k--val">{shortMoney(LAST_NW)}</span>
          </div>
          <TrendChart />
        </div>

        <div className="cd__tile cd__tile--metric cd__tile--liquidity">
          <span className="cd__k">Liquidity</span>
          <span className="cd__v">{shortMoney(D.totals.availableLiquidityCents)}</span>
          <span className="cd__sub">cash + headroom</span>
        </div>

        <div className="cd__tile cd__tile--cashflow">
          <div className="cd__tile-head">
            <span className="cd__k">Cashflow</span>
            <span className="cd__legend">
              <span className="cd__legend-in">income</span>
              <span className="cd__legend-out">expenses</span>
            </span>
          </div>
          <CashflowBars />
        </div>

        <div className="cd__tile cd__tile--balance">
          <span className="cd__k">Balance sheet</span>
          <BalanceRows />
        </div>
      </div>
    </div>
  );
}
