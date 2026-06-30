import type { LedgerDashboardData } from "~/server/ledger";
import { formatMoney, shortMoney, leafAccount } from "./format";
import { NoData } from "./NoData";
import { cashflowWaterfall, type WaterfallStep } from "./derive";

const W = 520;
const H = 210;
const PAD = { top: 18, right: 12, bottom: 44, left: 52 };
const BAR_FRACTION = 0.62;

function stepClass(kind: WaterfallStep["kind"]): string {
  return `waterfall-bar waterfall-bar--${kind}`;
}

function shortLabel(step: WaterfallStep): string {
  if (step.kind !== "expense" || !step.account) return step.label;
  const leaf = leafAccount(step.account).split(":").pop() ?? step.label;
  return leaf.length > 9 ? `${leaf.slice(0, 8)}…` : leaf;
}

export function CashflowWaterfallWidget({
  dashboard,
}: {
  dashboard: LedgerDashboardData;
}) {
  const waterfall = cashflowWaterfall(dashboard.pnl, dashboard.categoryMonthly);
  if (!waterfall) return <NoData message="NO MONTHLY CASHFLOW" />;

  const { steps, month, incomeCents, expensesCents, netCents, maxCents } = waterfall;

  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const slot = cW / steps.length;
  const barW = slot * BAR_FRACTION;
  const toY = (cents: number) => PAD.top + cH - (cents / maxCents) * cH;
  const yTicks = [0, 0.5, 1].map((f) => Math.round(f * maxCents));

  return (
    <div className="pnl-chart-wrap">
      <div className="waterfall-head">
        <strong className={netCents >= 0 ? "pos" : "neg"}>
          {formatMoney(netCents)}
        </strong>
        <span>
          net in {month} · {formatMoney(incomeCents)} in ·{" "}
          {formatMoney(expensesCents)} out
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="burn-svg"
        aria-label={`Cashflow waterfall for ${month}`}
      >
        {yTicks.map((cents) => (
          <g key={cents}>
            <line
              x1={PAD.left}
              y1={toY(cents)}
              x2={W - PAD.right}
              y2={toY(cents)}
              className="chart-grid"
            />
            <text
              x={PAD.left - 6}
              y={toY(cents)}
              textAnchor="end"
              dominantBaseline="middle"
              className="chart-label"
            >
              {shortMoney(cents)}
            </text>
          </g>
        ))}
        {steps.map((step, index) => {
          const x = PAD.left + slot * index + (slot - barW) / 2;
          const top = toY(Math.max(step.startCents, step.endCents));
          const bottom = toY(Math.min(step.startCents, step.endCents));
          const height = Math.max(1, bottom - top);
          const next = steps[index + 1];
          const connectorY = toY(step.endCents);
          return (
            <g key={step.label}>
              <rect
                x={x}
                y={top}
                width={barW}
                height={height}
                className={stepClass(step.kind)}
              />
              <text
                x={x + barW / 2}
                y={top - 4}
                textAnchor="middle"
                className="waterfall-delta"
              >
                {shortMoney(Math.abs(step.deltaCents))}
              </text>
              <text
                x={x + barW / 2}
                y={H - PAD.bottom + 14}
                textAnchor="middle"
                className="chart-label waterfall-axis"
              >
                {shortLabel(step)}
              </text>
              {next && step.kind !== "net" && next.kind !== "net" ? (
                <line
                  x1={x + barW}
                  y1={connectorY}
                  x2={PAD.left + slot * (index + 1) + (slot - barW) / 2}
                  y2={connectorY}
                  className="waterfall-connector"
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <p className="form-hint">
        Latest month: income consumed by each expense category down to net.
      </p>
    </div>
  );
}
