// Server-only, tenant-scoped Postgres income/expense breakdown read for the
// self-service /workspace dashboard (Phase 2+3 of the DashboardGrid port —
// see workspaceDashboard.ts).
//
// Reuses `fetchIncomeStatementRows` from workspacePnl.ts (the exact same
// rows Phase 1's P&L totals are computed from — summing is associative, so
// re-aggregating the identical rows by account instead of by month is safe)
// and `computeAccountBreakdowns` (ledgerAggregates.ts) VERBATIM, so this
// matches the SQLite dashboard's breakdown math bit-for-bit — see
// ledgerPostgresParity.integration.test.ts.
import { fetchIncomeStatementRows } from "./workspacePnl";
import { computeAccountBreakdowns, type AccountTotal } from "./ledgerAggregates";

export interface WorkspaceAccountBreakdowns {
  incomeBreakdown: AccountTotal[];
  expenseBreakdown: AccountTotal[];
}

/** The caller's tenant income/expense breakdowns (Phase 2+3 fields only). */
export async function getWorkspaceAccountBreakdowns(
  tenantId: string,
): Promise<WorkspaceAccountBreakdowns> {
  const rows = await fetchIncomeStatementRows(tenantId);
  return computeAccountBreakdowns(rows);
}
