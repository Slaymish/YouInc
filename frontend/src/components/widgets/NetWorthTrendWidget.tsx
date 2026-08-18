import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, shortMoney } from "./format";
import { NoData } from "./NoData";

const W = 520;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 32, left: 64 };

export function NetWorthTrendWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const rows = dashboard.netWorthTrend;
  if (rows.length < 2) return <NoData
        message="Two months of history needed to draw a line."
        hint="Until then there is only one point to plot."
      />;

  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const values = rows.flatMap((r) => [r.netWorthCents, r.assetsCents, r.liabilitiesCents]);
  const maxCents = Math.max(1, ...values);
  const minCents = Math.min(0, ...values);
  const span = maxCents - minCents || 1;
  const toY = (cents: number) => PAD.top + cH - ((cents - minCents) / span) * cH;
  const toX = (i: number) => PAD.left + (cW / (rows.length - 1)) * i;
  const yTicks = [0, 0.5, 1].map((f) => Math.round(minCents + f * span));

  const line = (key: "netWorthCents" | "assetsCents" | "liabilitiesCents") =>
    rows.map((r, i) => `${toX(i)},${toY(r[key])}`).join(" ");

  const latest = rows[rows.length - 1];

  return (
    <div className="pnl-chart-wrap">
      <div className="trend-headline">
        <strong>{formatMoney(latest.netWorthCents)}</strong>
        <span>ledger-posted net worth</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="burn-svg" aria-label="Net worth, assets and liabilities over time">
        {yTicks.map((c, idx) => (
          <g key={`${c}-${idx}`}>
            <line x1={PAD.left} y1={toY(c)} x2={W - PAD.right} y2={toY(c)} className="chart-grid" />
            <text x={PAD.left - 6} y={toY(c)} textAnchor="end" dominantBaseline="middle" className="chart-label">
              {shortMoney(c)}
            </text>
          </g>
        ))}
        <polyline points={line("assetsCents")} className="trend-assets-line" fill="none" strokeWidth="1.5" />
        <polyline points={line("liabilitiesCents")} className="trend-liabilities-line" fill="none" strokeWidth="1.5" />
        <polyline points={line("netWorthCents")} className="trend-networth-line" fill="none" strokeWidth="2.5" />
        {rows.map((r, i) =>
          i % Math.ceil(rows.length / 6) === 0 ? (
            <text key={r.month} x={toX(i)} y={H - 6} textAnchor="middle" className="chart-label">
              {r.month.slice(2)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        <span className="trend-legend-networth">Net worth</span>
        <span className="trend-legend-assets">Assets</span>
        <span className="trend-legend-liabilities">Liabilities</span>
      </div>
      <p className="form-hint">
        Journal-derived. Manual balances (snapshots without history) are excluded, so
        the latest point may differ from the headline figure.
      </p>
    </div>
  );
}
