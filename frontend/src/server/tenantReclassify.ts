// Server-only, tenant-scoped reclassification of ONE suspense-queued
// transaction (see workspaceSuspenseMath.ts for the read-side math this
// mutates the inputs of). All access runs under the caller's RLS context via
// the Supabase server client — never service_role.
//
// A transaction lands in suspense when RulesRouter.route() falls through to
// the tenant's suspense account (tenantIngestion.ts / ledger-engine/
// rulesRouter.ts). Reclassifying it does NOT mutate the original
// journal_transactions/journal_entries rows (immutability + audit trail) —
// instead it posts a new, small correction transaction that:
//   1. reverses the original suspense-account leg (opposite side, same
//      amount), and
//   2. posts that same amount, on the SAME side the suspense leg originally
//      had, to the caller's chosen target account.
// That correction is balanced on its own (debit total == credit total), and
// nets the ORIGINAL transaction's suspense postings to zero — which is
// exactly the signal computeSuspenseQueue() uses to drop it from the open
// queue. See ledger-engine/journal.ts's validateBalanced, reused here as a
// defense-in-depth check before persisting.
import crypto from "node:crypto";
import { validateBalanced, type JournalTransaction, type Posting } from "./ledger-engine/journal";
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { fetchTenantJournalEntries, type TenantJournalEntryRow } from "./workspaceJournal";
import {
  RECLASSIFY_RULE_ID,
  computeSuspenseQueue,
  isSuspenseAccount,
  reclassifyExternalId,
  type SuspenseItem,
} from "./workspaceSuspenseMath";
import { throwServerError } from "./serverError";

interface TenantContext {
  tenantId: string;
  suspenseAccount: string;
}

async function requireTenant(): Promise<TenantContext> {
  const user = await getServerUser();
  if (!user) throwServerError("You must be signed in.", 401);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, suspense_account")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throwServerError(error.message, 400);
  const row = data?.[0] as { id: string; suspense_account: string } | undefined;
  if (!row) throwServerError("No workspace found. Finish onboarding first.", 409);
  return { tenantId: row.id, suspenseAccount: row.suspense_account };
}

export interface ReclassifySuspenseItemInput {
  /** The queued item's externalId (see SuspenseItem.externalId). */
  externalId: string;
  /** The real account to route this transaction to instead of suspense. */
  targetAccount: string;
}

function findOriginalSuspenseEntry(
  entries: readonly TenantJournalEntryRow[],
  externalId: string,
  suspenseAccount: string,
): TenantJournalEntryRow | undefined {
  return entries.find(
    (e) => e.externalId === externalId && isSuspenseAccount(e.account, suspenseAccount),
  );
}

/**
 * Reclassify one queued suspense transaction to a real target account by
 * posting a balanced correction transaction (see module docs). Returns the
 * caller's refreshed suspense queue so the widget can drop the resolved item
 * without a full page reload.
 */
export async function reclassifySuspenseItem(
  input: ReclassifySuspenseItemInput,
): Promise<SuspenseItem[]> {
  const tenant = await requireTenant();
  const targetAccount = input.targetAccount.trim();

  if (!targetAccount.includes(":")) {
    throwServerError("Use a namespaced account, e.g. Expenses:Groceries.", 400);
  }
  if (isSuspenseAccount(targetAccount, tenant.suspenseAccount)) {
    throwServerError("Choose an account other than the suspense account.", 400);
  }

  const entries = await fetchTenantJournalEntries(tenant.tenantId);

  const stillOpen = computeSuspenseQueue(entries, tenant.suspenseAccount).some(
    (item) => item.externalId === input.externalId,
  );
  if (!stillOpen) {
    throwServerError("That suspense item was not found (it may already be resolved).", 404);
  }

  const originalEntry = findOriginalSuspenseEntry(entries, input.externalId, tenant.suspenseAccount);
  if (!originalEntry) {
    throwServerError("That suspense item was not found (it may already be resolved).", 404);
  }

  const reversedSide: "debit" | "credit" = originalEntry.side === "debit" ? "credit" : "debit";
  const correctionExternalId = reclassifyExternalId(input.externalId, crypto.randomUUID());

  const postings: [Posting, Posting] = [
    { account: tenant.suspenseAccount, side: reversedSide, amountCents: originalEntry.amountCents, currency: originalEntry.currency },
    { account: targetAccount, side: originalEntry.side, amountCents: originalEntry.amountCents, currency: originalEntry.currency },
  ];
  const correction: JournalTransaction = {
    externalId: correctionExternalId,
    transactionDate: new Date().toISOString().slice(0, 10),
    description: `Reclassified: ${originalEntry.description}`,
    sourceAccountId: originalEntry.sourceAccountId,
    status: "posted",
    ruleId: RECLASSIFY_RULE_ID,
    postings,
  };
  validateBalanced(correction);

  const supabase = getSupabaseServerClient();
  const { data: journalRows, error: journalError } = await supabase
    .from("journal_transactions")
    .insert({
      tenant_id: tenant.tenantId,
      external_id: correction.externalId,
      transaction_date: correction.transactionDate,
      description: correction.description,
      source_account_id: correction.sourceAccountId,
      status: correction.status,
      rule_id: correction.ruleId,
    })
    .select("id")
    .limit(1);
  if (journalError) {
    throwServerError(journalError.message || "Could not reclassify that transaction.", 400);
  }
  const journalId = (journalRows?.[0] as { id: string } | undefined)?.id;
  if (!journalId) {
    throwServerError("Could not reclassify that transaction.", 400);
  }

  const entryRows = correction.postings.map((posting) => ({
    tenant_id: tenant.tenantId,
    journal_transaction_id: journalId,
    account: posting.account,
    side: posting.side,
    amount_cents: posting.amountCents,
    currency: posting.currency,
  }));
  const { error: entryError } = await supabase.from("journal_entries").insert(entryRows);
  if (entryError) {
    throwServerError(entryError.message || "Could not reclassify that transaction.", 400);
  }

  const refreshedEntries = await fetchTenantJournalEntries(tenant.tenantId);
  return computeSuspenseQueue(refreshedEntries, tenant.suspenseAccount);
}
