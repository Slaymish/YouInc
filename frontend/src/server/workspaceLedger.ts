// Server-only, tenant-scoped Postgres ledger DAL for the self-service workspace
// (Phase 2, first slice).
//
// Why this exists / what it deliberately does NOT do:
//   The full local dashboard (`server/ledger.ts`) reads the owner's SQLite file
//   and is single-tenant. Porting the *entire* dashboard to Postgres is a large
//   effort tracked as the rest of P2. This module ships the honest self-service
//   loop that needs no Akahu: a signed-in user's own manual account balances,
//   read and written through Supabase under their RLS context (never
//   service_role), and summarized into net worth / assets / liabilities using
//   the SAME conventions as the SQLite dashboard:
//     * account "type" = the first ":"-segment of the ledger account path;
//     * assets are stored/summed as positive, liabilities as negative;
//       liabilities are surfaced as a positive magnitude and net worth =
//       assets - liabilities.
//
// Journal-derived balances (Akahu ingestion) are the next P2 slice and are not
// read here yet — a fresh self-serve tenant has none until sync lands.
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { accountType } from "./accountType";
import { throwServerError } from "./serverError";
import {
  combineBalances,
  type AccountBalance,
  type LedgerTotals,
} from "./workspaceSummary";

export { accountType };
export type { AccountBalance, LedgerTotals };

export interface WorkspaceManualBalance {
  account: string;
  accountType: string;
  balanceCents: number;
  asOfDate: string;
  updatedAt: string;
}

export interface WorkspaceLedgerSummary {
  tenantId: string;
  currency: string;
  /** Editable manual balances (the accounts a user maintains by hand). */
  manualBalances: WorkspaceManualBalance[];
  /** Combined per-account balances: journal-derived + manual (manual wins). */
  balances: AccountBalance[];
  /** Whether any journal-derived (synced) balances contribute to the total. */
  hasJournalBalances: boolean;
  totals: LedgerTotals;
}

interface ManualBalanceDbRow {
  account: string;
  balance_cents: number;
  as_of_date: string;
  updated_at: string;
}

interface JournalEntryDbRow {
  account: string;
  side: "debit" | "credit";
  amount_cents: number;
}

interface TenantContext {
  tenantId: string;
  currency: string;
}

/** Resolve the caller's primary tenant (id + default currency), or throw 401. */
async function requireTenant(): Promise<TenantContext> {
  const user = await getServerUser();
  if (!user) {
    throwServerError("You must be signed in.", 401);
  }
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, default_currency")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) {
    throwServerError(error.message || "Could not load your workspace.", 400);
  }
  const row = data?.[0] as { id: string; default_currency: string } | undefined;
  if (!row) {
    // Signed in but no tenant yet — onboarding not finished.
    throwServerError("No workspace found. Finish onboarding first.", 409);
  }
  return { tenantId: row.id, currency: row.default_currency };
}

/** Aggregate journal entries into per-account balances: debit +, credit −. */
function aggregateJournalBalances(
  rows: JournalEntryDbRow[],
): { account: string; balanceCents: number }[] {
  const totals = new Map<string, number>();
  for (const r of rows) {
    const signed =
      r.side === "debit" ? Number(r.amount_cents) : -Number(r.amount_cents);
    totals.set(r.account, (totals.get(r.account) ?? 0) + signed);
  }
  return [...totals.entries()].map(([account, balanceCents]) => ({
    account,
    balanceCents,
  }));
}

function summarize(
  tenant: TenantContext,
  manualRows: ManualBalanceDbRow[],
  journalRows: JournalEntryDbRow[],
): WorkspaceLedgerSummary {
  const manualBalances: WorkspaceManualBalance[] = manualRows
    .map((r) => ({
      account: r.account,
      accountType: accountType(r.account),
      balanceCents: Number(r.balance_cents),
      asOfDate: r.as_of_date,
      updatedAt: r.updated_at,
    }))
    .sort((a, b) => a.account.localeCompare(b.account));

  const journalBalances = aggregateJournalBalances(journalRows);
  const { balances, totals } = combineBalances(
    journalBalances,
    manualBalances.map((m) => ({
      account: m.account,
      balanceCents: m.balanceCents,
    })),
  );

  return {
    tenantId: tenant.tenantId,
    currency: tenant.currency,
    manualBalances,
    balances,
    hasJournalBalances: journalBalances.length > 0,
    totals,
  };
}

/** The caller's tenant ledger summary: journal-derived + manual balances. */
export async function getWorkspaceLedger(): Promise<WorkspaceLedgerSummary> {
  const tenant = await requireTenant();
  const supabase = getSupabaseServerClient();

  const [manualRes, journalRes] = await Promise.all([
    supabase
      .from("manual_account_balances")
      .select("account, balance_cents, as_of_date, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .order("account", { ascending: true }),
    supabase
      .from("journal_entries")
      .select("account, side, amount_cents")
      .eq("tenant_id", tenant.tenantId),
  ]);
  if (manualRes.error) {
    throwServerError(manualRes.error.message || "Could not load balances.", 400);
  }
  if (journalRes.error) {
    throwServerError(journalRes.error.message || "Could not load ledger.", 400);
  }
  return summarize(
    tenant,
    (manualRes.data ?? []) as ManualBalanceDbRow[],
    (journalRes.data ?? []) as JournalEntryDbRow[],
  );
}

export interface UpsertWorkspaceBalanceInput {
  account: string;
  balanceCents: number;
  asOfDate?: string;
}

/**
 * Insert or update one manual account balance for the caller's tenant, then
 * return the refreshed summary. RLS confines the write to the caller's tenant;
 * we also set tenant_id explicitly (required by the NOT NULL column + policy
 * WITH CHECK). Account paths must be namespaced (contain a ":") so accountType()
 * can classify them as Assets/Liabilities/etc.
 */
export async function upsertWorkspaceBalance(
  input: UpsertWorkspaceBalanceInput,
): Promise<WorkspaceLedgerSummary> {
  const tenant = await requireTenant();

  const account = input.account.trim();
  if (!account.includes(":")) {
    throwServerError(
      "Use a namespaced account, e.g. Assets:Bank:Everyday or Liabilities:Card.",
      400,
    );
  }
  if (!Number.isFinite(input.balanceCents)) {
    throwServerError("Enter a valid balance.", 400);
  }
  const balanceCents = Math.round(input.balanceCents);
  const asOfDate = input.asOfDate ?? new Date().toISOString().slice(0, 10);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("manual_account_balances").upsert(
    {
      tenant_id: tenant.tenantId,
      account,
      balance_cents: balanceCents,
      as_of_date: asOfDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,account" },
  );
  if (error) {
    throwServerError(error.message || "Could not save the balance.", 400);
  }
  return getWorkspaceLedger();
}

/** Remove a manual account balance from the caller's tenant. */
export async function deleteWorkspaceBalance(
  account: string,
): Promise<WorkspaceLedgerSummary> {
  const tenant = await requireTenant();
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("manual_account_balances")
    .delete()
    .eq("tenant_id", tenant.tenantId)
    .eq("account", account.trim());
  if (error) {
    throwServerError(error.message || "Could not remove the account.", 400);
  }
  return getWorkspaceLedger();
}
