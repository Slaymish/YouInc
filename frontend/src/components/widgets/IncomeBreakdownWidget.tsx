import type { LedgerDashboardData } from "~/server/ledger";
import { formatPercent, leafAccount } from "./format";
import { NoData } from "./NoData";
import { BreakdownList } from "./ExpenseBreakdownWidget";

export function IncomeBreakdownWidget({ dashboard }: { dashboard: LedgerDashboardData }) {
  const rows = dashboard.incomeBreakdown;
  if (!rows.length) return <NoData message="NO INCOME POSTINGS" />;

  const total = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const top = rows[0];
  const concentration = total ? top.amountCents / total : null;
  const concentrated = concentration !== null && concentration >= 0.5;

  return (
    <div className="stack">
      <div className={`concentration${concentrated ? " concentration--warn" : ""}`}>
        <strong>{formatPercent(concentration)}</strong>
        <span>
          from {leafAccount(top.account)}
          {concentrated ? " · concentration risk" : ""}
        </span>
      </div>
      <BreakdownList rows={rows} barClass="income" />
    </div>
  );
}
