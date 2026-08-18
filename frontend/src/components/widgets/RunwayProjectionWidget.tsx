import type { LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { formatMoney, formatMonths, shortMoney } from "./format";
import { NoData } from "./NoData";
import { depletionDate, runwayProjection } from "./derive";

const W = 520;
const H = 150;
const PAD = { top: 14, right: 16, bottom: 28, left: 60 };

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" }).format(date);
}

export function RunwayProjectionWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const cashCents = dashboard.balances
    .filter((row) => row.accountType === "Assets" && row.liquidityTier === "cash")
    .reduce((sum, row) => sum + row.balanceCents, 0);
  const monthlyBurnCents = dashboard.totals.monthlyOverheadCents;

  if (!monthlyBurnCents) return <NoData
        message="No spending on record to project from."
        hint="Once there is a month of spending, this shows how long your money lasts."
      />;

  const { months, points } = runwayProjection(cashCents, monthlyBurnCents);
  const low = months !== null && months < 3;

  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxCash = Math.max(1, ...points.map((p) => p.cashCents));
  const lastIndex = points.length - 1 || 1;
  const toX = (i: number) => PAD.left + (cW / lastIndex) * i;
  const toY = (cents: number) => PAD.top + cH - (cents / maxCash) * cH;
  const area = `${toX(0)},${toY(0)} ${points
    .map((p) => `${toX(p.monthIndex)},${toY(p.cashCents)}`)
    .join(" ")} ${toX(points[points.length - 1].monthIndex)},${toY(0)}`;

  return (
    <div className="stack">
      <div className={`runway-head${low ? " runway-head--warn" : ""}`}>
        <strong>{formatMonths(months)}</strong>
        <span>
          cash runway · depletes {formatDate(depletionDate(months))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="burn-svg" aria-label="Projected cash burn-down">
        <line x1={PAD.left} y1={toY(0)} x2={W - PAD.right} y2={toY(0)} className="chart-grid" />
        <text x={PAD.left - 6} y={toY(maxCash)} textAnchor="end" dominantBaseline="middle" className="chart-label">
          {shortMoney(maxCash)}
        </text>
        <polygon points={area} className={`runway-area${low ? " runway-area--warn" : ""}`} />
        <polyline
          points={points.map((p) => `${toX(p.monthIndex)},${toY(p.cashCents)}`).join(" ")}
          className={`runway-line${low ? " runway-line--warn" : ""}`}
          fill="none"
          strokeWidth="2"
        />
        {points.map((p) =>
          p.monthIndex % Math.ceil(points.length / 6 || 1) === 0 ? (
            <text key={p.monthIndex} x={toX(p.monthIndex)} y={H - 6} textAnchor="middle" className="chart-label">
              +{p.monthIndex}
            </text>
          ) : null,
        )}
      </svg>
      <p className="form-hint">
        Cash {formatMoney(cashCents)} at {formatMoney(monthlyBurnCents)}/mo burn.
      </p>
    </div>
  );
}
