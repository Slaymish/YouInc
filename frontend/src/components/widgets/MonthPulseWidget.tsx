import type { LedgerDashboardData } from "~/server/ledger";
import { formatMoney, formatPercent } from "./format";
import { NoData } from "./NoData";
import { monthPulse } from "./derive";

function DeltaTag({ delta, invert }: { delta: number | null; invert?: boolean }) {
  if (delta === null) return <span className="delta delta--flat">n/a</span>;
  const isUp = delta >= 0;
  // For income, up is good; for expenses, up is bad (invert tone).
  const good = invert ? !isUp : isUp;
  const tone = Math.abs(delta) < 0.005 ? "flat" : good ? "good" : "bad";
  const arrow = Math.abs(delta) < 0.005 ? "→" : isUp ? "▲" : "▼";
  return (
    <span className={`delta delta--${tone}`}>
      {arrow} {formatPercent(Math.abs(delta))}
    </span>
  );
}

export function MonthPulseWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const pulse = monthPulse(dashboard.pnl);
  if (!pulse) return <NoData message="NO MONTHLY DATA" />;

  return (
    <div className="pulse">
      <div className="pulse-head">
        <span>This month</span>
        <strong>{pulse.month}</strong>
      </div>
      <dl className="pulse-grid">
        <div>
          <dt>Income</dt>
          <dd>{formatMoney(pulse.incomeCents)}</dd>
          <DeltaTag delta={pulse.incomeDelta} />
        </div>
        <div>
          <dt>Burn</dt>
          <dd>{formatMoney(pulse.expensesCents)}</dd>
          <DeltaTag delta={pulse.expenseDelta} invert />
        </div>
        <div>
          <dt>Net</dt>
          <dd className={pulse.netCents >= 0 ? "pos" : "neg"}>
            {formatMoney(pulse.netCents)}
          </dd>
          <span className="delta delta--flat">vs avg</span>
        </div>
      </dl>
      <p className="pulse-foot">
        Avg income {formatMoney(pulse.avgIncomeCents)} · avg burn{" "}
        {formatMoney(pulse.avgExpensesCents)}
      </p>
    </div>
  );
}
