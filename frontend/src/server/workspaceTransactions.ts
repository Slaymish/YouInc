// Server-only: derives the /workspace dashboard's recent-transactions journal
// feed (Phase 2+3 of the DashboardGrid port — see workspaceDashboard.ts) from
// the shared tenant journal fetch (workspaceJournal.ts), reusing
// computeRecentTransactions (ledgerAggregates.ts) VERBATIM so grouping,
// sorting, and limiting match the SQLite dashboard exactly — see
// ledgerPostgresParity.integration.test.ts.
import {
  computeRecentTransactions,
  type JournalEntryDetailRow,
  type JournalTransactionRow,
} from "./ledgerAggregates";
import type { TenantJournalEntryRow } from "./workspaceJournal";

const RECENT_TRANSACTIONS_LIMIT = 12;

/** Every posting, mapped into the shared per-posting detail shape. */
export function toJournalEntryDetailRows(
  rows: readonly TenantJournalEntryRow[],
): JournalEntryDetailRow[] {
  return rows.map((row) => ({
    externalId: row.externalId,
    transactionDate: row.transactionDate,
    description: row.description,
    ruleId: row.ruleId,
    account: row.account,
    side: row.side,
    amountCents: row.amountCents,
    currency: row.currency,
  }));
}

/** The tenant's most recent reconstructed double-entry transactions. */
export function computeWorkspaceRecentTransactions(
  rows: readonly TenantJournalEntryRow[],
  limit = RECENT_TRANSACTIONS_LIMIT,
): JournalTransactionRow[] {
  return computeRecentTransactions(toJournalEntryDetailRows(rows), limit);
}
