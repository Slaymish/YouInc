// Server-only: derives the /workspace dashboard's category-monthly and
// daily-spend feeds (Phase 2+3 of the DashboardGrid port — see
// workspaceDashboard.ts) from the shared tenant journal fetch
// (workspaceJournal.ts), reusing computeCategoryMonthly / computeDailySpend
// (analytics.ts) VERBATIM so both match the SQLite dashboard exactly — see
// ledgerPostgresParity.integration.test.ts.
import {
  computeCategoryMonthly,
  computeDailySpend,
  type CategoryMonthlyEntryRow,
  type CategoryMonthPoint,
  type DailySpendEntryRow,
  type DailySpendPoint,
} from "./analytics";
import type { TenantJournalEntryRow } from "./workspaceJournal";

const MANUAL_SOURCE_ACCOUNT_ID = "manual";

/** Expenses:% postings, mapped into the shared (month, account) shape. */
export function toCategoryMonthlyEntryRows(
  rows: readonly TenantJournalEntryRow[],
): CategoryMonthlyEntryRow[] {
  return rows
    .filter((row) => row.account.startsWith("Expenses:"))
    .map((row) => ({
      month: row.transactionDate.slice(0, 7),
      account: row.account,
      side: row.side,
      amountCents: row.amountCents,
    }));
}

/**
 * ALL postings for non-manual-sourced transactions (not just Income:%/
 * Expenses:%) — the distinct-transaction count must see every transaction,
 * including pure transfers, to match the SQLite dashboard's
 * `COUNT(DISTINCT jt.id)` over the unfiltered join.
 */
export function toDailySpendEntryRows(
  rows: readonly TenantJournalEntryRow[],
): DailySpendEntryRow[] {
  return rows
    .filter((row) => row.sourceAccountId !== MANUAL_SOURCE_ACCOUNT_ID)
    .map((row) => ({
      date: row.transactionDate,
      transactionId: row.transactionId,
      account: row.account,
      side: row.side,
      amountCents: row.amountCents,
    }));
}

/** The tenant's category-monthly spend from the full journal fetch. */
export function computeWorkspaceCategoryMonthly(
  rows: readonly TenantJournalEntryRow[],
): CategoryMonthPoint[] {
  return computeCategoryMonthly(toCategoryMonthlyEntryRows(rows));
}

/** The tenant's daily spend/income from the full journal fetch. */
export function computeWorkspaceDailySpend(
  rows: readonly TenantJournalEntryRow[],
): DailySpendPoint[] {
  return computeDailySpend(toDailySpendEntryRows(rows));
}
