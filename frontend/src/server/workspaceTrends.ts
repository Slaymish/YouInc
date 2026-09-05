// Server-only: derives the /workspace dashboard's net-worth trend (Phase 2+3
// of the DashboardGrid port — see workspaceDashboard.ts) from the shared
// workspace journal fetch (workspaceJournal.ts), reusing computeNetWorthTrend
// (ledgerAggregates.ts) VERBATIM so this matches the SQLite dashboard's math
// bit-for-bit — see ledgerPostgresParity.integration.test.ts.
import { computeNetWorthTrend, type NetWorthEntryRow, type NetWorthPoint } from "./ledgerAggregates";
import type { JournalEntryRow } from "./workspaceJournal";

/** Assets:/Liabilities: postings, mapped into the shared debit-positive shape. */
export function toNetWorthEntryRows(
  rows: readonly JournalEntryRow[],
): NetWorthEntryRow[] {
  return rows
    .filter(
      (row) => row.account.startsWith("Assets:") || row.account.startsWith("Liabilities:"),
    )
    .map((row) => ({
      month: row.transactionDate.slice(0, 7),
      account: row.account,
      amountCents: row.side === "debit" ? row.amountCents : -row.amountCents,
    }));
}

/** The workspace's net-worth trend from the full journal fetch. */
export function computeWorkspaceNetWorthTrend(
  rows: readonly JournalEntryRow[],
): NetWorthPoint[] {
  return computeNetWorthTrend(toNetWorthEntryRows(rows));
}
