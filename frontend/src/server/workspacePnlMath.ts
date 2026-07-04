// Pure P&L math for the /workspace dashboard — dependency-free (no Supabase,
// no `~/` aliases) so it can be unit-tested under the plugin-free vitest
// config, mirroring workspaceSummary.ts. The Postgres fetch lives in
// workspacePnl.ts and calls this.
import {
  computeIncomeStatementTotals,
  computeRunwayMonths,
  type IncomeStatementRow,
  type PnlRow,
} from "./ledgerAggregates";

export interface WorkspacePnlTotals {
  incomeCents: number;
  expensesCents: number;
  ebitdaCents: number;
  ebitdaMargin: number | null;
  averageMonthlyIncomeCents: number;
  monthlyOverheadCents: number;
  runwayMonths: number | null;
  /** Phase 2+3: the monthly income/expense/ebitda series. */
  pnl: PnlRow[];
}

/** Turns already-fetched rows into Phase-1+2+3 P&L totals + monthly series + runway. */
export function computeWorkspacePnlTotals(
  rows: readonly IncomeStatementRow[],
  assetsCents: number,
): WorkspacePnlTotals {
  const totals = computeIncomeStatementTotals(rows);
  return {
    incomeCents: totals.incomeCents,
    expensesCents: totals.expensesCents,
    ebitdaCents: totals.ebitdaCents,
    ebitdaMargin: totals.ebitdaMargin,
    averageMonthlyIncomeCents: totals.averageMonthlyIncomeCents,
    monthlyOverheadCents: totals.monthlyOverheadCents,
    runwayMonths: computeRunwayMonths(assetsCents, totals.monthlyOverheadCents),
    pnl: totals.pnl,
  };
}
