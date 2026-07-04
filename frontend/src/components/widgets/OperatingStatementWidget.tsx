import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";

function shortMoney(cents: number): string {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${Math.round(d)}`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD" }).format(cents / 100);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("en-NZ", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function NoData({ message }: { message: string }) {
  return <p className="no-data">{message}</p>;
}

function PnlChart({ rows }: { rows: LedgerDashboardData["pnl"] }) {
  const W = 520;
  const H = 180;
  const PAD = { top: 16, right: 16, bottom: 32, left: 60 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;

  const maxCents = Math.max(1, ...rows.flatMap((r) => [r.incomeCents, r.expensesCents]));
  const toY = (cents: number) => PAD.top + cH - Math.max(0, cents / maxCents) * cH;
  const slotW = rows.length ? cW / rows.length : cW;
  const barW = Math.max(8, slotW * 0.45);
  const toX = (i: number) => PAD.left + slotW * i + slotW / 2;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxCents));
  const revPoints = rows.map((r, i) => `${toX(i)},${toY(r.incomeCents)}`).join(" ");

  return (
    <div className="pnl-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="burn-svg" aria-label="Burn and revenue over time">
        {yTicks.map((c) => (
          <g key={c}>
            <line x1={PAD.left} y1={toY(c)} x2={W - PAD.right} y2={toY(c)} className="chart-grid" />
            <text x={PAD.left - 6} y={toY(c)} textAnchor="end" dominantBaseline="middle" className="chart-label">
              {shortMoney(c)}
            </text>
          </g>
        ))}
        {rows.map((row, i) => (
          <rect
            key={row.month}
            x={toX(i) - barW / 2}
            y={toY(row.expensesCents)}
            width={barW}
            height={cH - (toY(row.expensesCents) - PAD.top)}
            className="chart-burn-bar"
          />
        ))}
        {rows.length > 1 && (
          <polyline points={revPoints} className="chart-rev-line" fill="none" strokeWidth="1.5" />
        )}
        {rows.map((row, i) => (
          <circle key={row.month} cx={toX(i)} cy={toY(row.incomeCents)} r="3" className="chart-rev-dot" />
        ))}
        {rows.map((row, i) => (
          <text key={row.month} x={toX(i)} y={H - 6} textAnchor="middle" className="chart-label">
            {row.month.slice(2)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="chart-legend-burn">Burn</span>
        <span className="chart-legend-rev">Revenue</span>
      </div>
      <div className="pnl-summary">
        <div className="pnl-summary-row pnl-summary-header">
          <span />
          <span>Revenue</span>
          <span>Burn</span>
          <span>Margin</span>
        </div>
        {rows.map((row) => (
          <div key={row.month} className="pnl-summary-row">
            <span className="pnl-summary-month">{row.month}</span>
            <span>{formatMoney(row.incomeCents)}</span>
            <span>{formatMoney(row.expensesCents)}</span>
            <span>{formatPercent(row.ebitdaMargin)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OperatingStatementWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  return dashboard.pnl.length ? (
    <PnlChart rows={dashboard.pnl} />
  ) : (
    <NoData message="NO INCOME / EXPENSE POSTINGS" />
  );
}
