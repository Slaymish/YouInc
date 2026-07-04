// Server-only, tenant-scoped Postgres P&L read for the self-service /workspace
// dashboard (Phase 1 of the DashboardGrid port — see workspaceDashboard.ts).
//
// The Phase-1 math (computeWorkspacePnlTotals, which itself reuses
// computeIncomeStatementTotals / computeRunwayMonths from ledgerAggregates.ts
// VERBATIM) lives in the dependency-free workspacePnlMath.ts so it can be
// unit-tested without the Supabase client. This module's only job is
// fetching the tenant's journal rows and mapping them into the shared
// `IncomeStatementRow` shape (month + account + credit-positive/debit-negative
// amountCents) — the exact convention `server/ledger.ts`'s `incomeStatement`
// query uses.
//
// We deliberately do NOT pre-aggregate per (month, account) in SQL: summing is
// associative, so handing one row per matching journal entry into
// computeIncomeStatementTotals (which itself buckets by month) yields the
// identical totals as SQLite's GROUP BY, with far less query complexity. This
// is perf-fine at personal-ledger scale (the same assumption the SQLite path
// makes by reading the whole table).
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";
import type { IncomeStatementRow } from "./ledgerAggregates";
import {
  computeWorkspacePnlTotals,
  type WorkspacePnlTotals,
} from "./workspacePnlMath";

export type { WorkspacePnlTotals } from "./workspacePnlMath";

interface JournalTransactionDateRow {
  id: string;
  transaction_date: string;
}

interface JournalEntryPnlRow {
  journal_transaction_id: string;
  account: string;
  side: "debit" | "credit";
  amount_cents: number;
}

/**
 * Fetches the tenant's Income:/Expenses: journal entries and maps them into
 * the shared `IncomeStatementRow` shape: month (YYYY-MM, sliced from the
 * transaction date, matching SQLite's `substr(transaction_date, 1, 7)`) and a
 * signed amountCents where credit is positive and debit is negative.
 */
export async function fetchIncomeStatementRows(
  tenantId: string,
): Promise<IncomeStatementRow[]> {
  const supabase = getSupabaseServerClient();

  const [entriesRes, transactionsRes] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("journal_transaction_id, account, side, amount_cents")
      .eq("tenant_id", tenantId),
    supabase
      .from("journal_transactions")
      .select("id, transaction_date")
      .eq("tenant_id", tenantId),
  ]);
  if (entriesRes.error) {
    throwServerError(
      entriesRes.error.message || "Could not load your income statement.",
      400,
    );
  }
  if (transactionsRes.error) {
    throwServerError(
      transactionsRes.error.message || "Could not load your transactions.",
      400,
    );
  }

  const entries = (entriesRes.data ?? []) as JournalEntryPnlRow[];
  const transactionDates = new Map(
    (
      (transactionsRes.data as JournalTransactionDateRow[] | null) ?? []
    ).map((row) => [row.id, row.transaction_date]),
  );

  return entries
    .filter(
      (entry) =>
        entry.account.startsWith("Income:") ||
        entry.account.startsWith("Expenses:"),
    )
    .map((entry) => {
      const transactionDate = transactionDates.get(entry.journal_transaction_id);
      if (!transactionDate) return null;
      const signedAmountCents =
        entry.side === "credit"
          ? Number(entry.amount_cents)
          : -Number(entry.amount_cents);
      return {
        month: transactionDate.slice(0, 7),
        account: entry.account,
        amountCents: signedAmountCents,
      } satisfies IncomeStatementRow;
    })
    .filter((row): row is IncomeStatementRow => row !== null);
}

/** The caller's tenant P&L totals (Phase-1 fields only). */
export async function getWorkspacePnl(
  tenantId: string,
  assetsCents: number,
): Promise<WorkspacePnlTotals> {
  const rows = await fetchIncomeStatementRows(tenantId);
  return computeWorkspacePnlTotals(rows, assetsCents);
}
