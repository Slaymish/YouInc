// Server-only, tenant-scoped Postgres journal read shared by Phase 2+3 of the
// DashboardGrid port (see workspaceDashboard.ts). Several dashboard fields —
// net-worth trend, recurring payments, category/daily spend, recent
// transactions — all derive from the SAME full tenant journal (every posting
// on every non-manual-sourced transaction). Fetching it ONCE here and handing
// the rows to each field's pure transform (workspaceTrends.ts,
// workspaceRecurring.ts, workspaceSpending.ts, workspaceTransactions.ts)
// avoids four divergent re-fetches of the same data.
//
// Every read here goes through the caller's RLS-scoped Supabase client (never
// service_role), filtered to the caller's tenant_id.
import { getSupabaseServerClient } from "./supabaseServer";
import { throwServerError } from "./serverError";

/** One posting, joined with its parent transaction's header fields. */
export interface TenantJournalEntryRow {
  /** Groups postings into one transaction; stable per-transaction key. */
  transactionId: string;
  externalId: string;
  /** YYYY-MM-DD */
  transactionDate: string;
  description: string;
  ruleId: string | null;
  sourceAccountId: string;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
  currency: string;
}

interface JournalTransactionHeaderRow {
  id: string;
  external_id: string;
  transaction_date: string;
  description: string;
  rule_id: string | null;
  source_account_id: string;
}

interface JournalEntryPostingRow {
  journal_transaction_id: string;
  account: string;
  side: "debit" | "credit";
  amount_cents: number;
  currency: string;
}

/**
 * Fetches every posting for the tenant, joined with its transaction's header
 * fields. Unfiltered by account/source — callers filter/derive in JS (e.g.
 * excluding `source_account_id === "manual"`, or Assets:%/Expenses:%
 * prefixes), matching the "read the whole table, personal-ledger scale"
 * approach the rest of the workspace read path uses.
 */
export async function fetchTenantJournalEntries(
  tenantId: string,
): Promise<TenantJournalEntryRow[]> {
  const supabase = getSupabaseServerClient();

  const [entriesRes, transactionsRes] = await Promise.all([
    supabase
      .from("journal_entries")
      .select("journal_transaction_id, account, side, amount_cents, currency")
      .eq("tenant_id", tenantId),
    supabase
      .from("journal_transactions")
      .select("id, external_id, transaction_date, description, rule_id, source_account_id")
      .eq("tenant_id", tenantId),
  ]);
  if (entriesRes.error) {
    throwServerError(entriesRes.error.message || "Could not load your journal.", 400);
  }
  if (transactionsRes.error) {
    throwServerError(
      transactionsRes.error.message || "Could not load your transactions.",
      400,
    );
  }

  const entries = (entriesRes.data ?? []) as JournalEntryPostingRow[];
  const transactionsById = new Map(
    ((transactionsRes.data as JournalTransactionHeaderRow[] | null) ?? []).map(
      (row) => [row.id, row],
    ),
  );

  return entries
    .map((entry) => {
      const transaction = transactionsById.get(entry.journal_transaction_id);
      if (!transaction) return null;
      return {
        transactionId: transaction.id,
        externalId: transaction.external_id,
        transactionDate: transaction.transaction_date,
        description: transaction.description,
        ruleId: transaction.rule_id,
        sourceAccountId: transaction.source_account_id,
        account: entry.account,
        side: entry.side,
        amountCents: Number(entry.amount_cents),
        currency: entry.currency,
      } satisfies TenantJournalEntryRow;
    })
    .filter((row): row is TenantJournalEntryRow => row !== null);
}
