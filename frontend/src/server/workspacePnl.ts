import { fetchJournalEntries } from "./workspaceJournal";
import type { IncomeStatementRow } from "./ledgerAggregates";
import {
  computeWorkspacePnlTotals,
  type WorkspacePnlTotals,
} from "./workspacePnlMath";

export type { WorkspacePnlTotals } from "./workspacePnlMath";

export async function fetchIncomeStatementRows(workspaceId: string): Promise<IncomeStatementRow[]> {
  return (await fetchJournalEntries(workspaceId))
    .filter(e => e.account.startsWith('Income:') || e.account.startsWith('Expenses:'))
    .map(e => ({month: e.transactionDate.slice(0,7), account: e.account,
      amountCents: e.side === 'credit' ? e.amountCents : -e.amountCents}));
}
/** The caller's workspace P&L totals (Phase-1 fields only). */
export async function getWorkspacePnl(
  workspaceId: string,
  assetsCents: number,
): Promise<WorkspacePnlTotals> {
  const rows = await fetchIncomeStatementRows(workspaceId);
  return computeWorkspacePnlTotals(rows, assetsCents);
}
