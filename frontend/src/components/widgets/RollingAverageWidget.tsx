import type { LedgerDashboardData } from "~/server/ledger";
import { shortMoney } from "./format";
import { NoData } from "./NoData";
import { rollingAverages } from "./derive";

const W = 520;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 32, left: 60 };

export function RollingAverageWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const rows = rollingAverages(dashboard.pnl);
  if (rows.length < 2) return <NoData message="NEED 2+ MONTHS FOR TREND" />;

  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxCents = Math.max(1, ...rows.flatMap((r) => [r.incomeCents, r.expensesCents]));
  const toY = (cents: number) => PAD.top + cH - Math.max(0, cents / maxCents) * cH;
  const toX = (i: number) => PAD.left + (cW / (rows.length - 1)) * i;
  const yTicks = [0, 0.5, 1].map((f) => Math.round(f * maxCents));

  const incomeLine = rows.map((r, i) => `${toX(i)},${toY(r.incomeCents)}`).join(" ");
  const burnLine = rows.map((r, i) => `${toX(i)},${toY(r.expensesCents)}`).join(" ");

  return (
    <div className="pnl-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="burn-svg" aria-label="3-month rolling income and burn">
        {yTicks.map((c) => (
          <g key={c}>
            <line x1={PAD.left} y1={toY(c)} x2={W - PAD.right} y2={toY(c)} className="chart-grid" />
            <text x={PAD.left - 6} y={toY(c)} textAnchor="end" dominantBaseline="middle" className="chart-label">
              {shortMoney(c)}
            </text>
          </g>
        ))}
        <polyline points={burnLine} className="trend-burn-line" fill="none" strokeWidth="2" />
        <polyline points={incomeLine} className="trend-income-line" fill="none" strokeWidth="2" />
        {rows.map((r, i) => (
          <circle key={`i-${r.month}`} cx={toX(i)} cy={toY(r.incomeCents)} r="2.5" className="chart-rev-dot" />
        ))}
        {rows.map((r, i) =>
          i % Math.ceil(rows.length / 6) === 0 ? (
            <text key={`x-${r.month}`} x={toX(i)} y={H - 6} textAnchor="middle" className="chart-label">
              {r.month.slice(2)}
            </text>
          ) : null,
        )}
      </svg>
      <div className="chart-legend">
        <span className="trend-legend-income">Income (3mo avg)</span>
        <span className="trend-legend-burn">Burn (3mo avg)</span>
      </div>
    </div>
  );
}
