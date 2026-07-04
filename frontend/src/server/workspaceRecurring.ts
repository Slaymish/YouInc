// Server-only: derives the /workspace dashboard's recurring-payments feed
// (Phase 2+3 of the DashboardGrid port — see workspaceDashboard.ts) from the
// shared tenant journal fetch (workspaceJournal.ts), reusing
// computeRecurringPayments (analytics.ts, itself detectRecurring +
// computeRecurringGroups) VERBATIM so detection matches the SQLite dashboard
// exactly — see ledgerPostgresParity.integration.test.ts.
import { computeRecurringPayments, type RecurringEntryRow, type RecurringPayment } from "./analytics";
import type { TenantJournalEntryRow } from "./workspaceJournal";

const MANUAL_SOURCE_ACCOUNT_ID = "manual";

/** Expenses:%/debit postings for non-manual-sourced transactions. */
export function toRecurringEntryRows(
  rows: readonly TenantJournalEntryRow[],
): RecurringEntryRow[] {
  return rows
    .filter(
      (row) =>
        row.account.startsWith("Expenses:") &&
        row.side === "debit" &&
        row.sourceAccountId !== MANUAL_SOURCE_ACCOUNT_ID,
    )
    .map((row) => ({
      transactionId: row.transactionId,
      date: row.transactionDate,
      description: row.description,
      account: row.account,
      amountCents: row.amountCents,
    }));
}

/** The tenant's detected recurring payments from the full journal fetch. */
export function computeWorkspaceRecurringPayments(
  rows: readonly TenantJournalEntryRow[],
): RecurringPayment[] {
  return computeRecurringPayments(toRecurringEntryRows(rows));
}
