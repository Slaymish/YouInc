// Server-only, tenant-scoped Akahu ingestion into Postgres (Phase 2, second
// slice). This is the WRITE half of the multi-tenant ledger: it turns Akahu
// payloads into per-tenant raw_transactions + double-entry journals using the
// SAME ported engine the golden tests pin (LedgerPipeline / RulesRouter), then
// persists the result under the caller's Row-Level-Security context.
//
// Design note — sync engine, async DB:
//   LedgerPipeline is synchronous (store methods return booleans), matching the
//   Python engine's SQLite calls. Supabase's client is async. Rather than
//   rewrite the proven pipeline, we (1) pre-load the tenant's existing raw
//   hashes + journal external_ids into a capturing in-memory store, (2) run the
//   pure pipeline in memory to compute exactly which raw txns and journals are
//   NEW, then (3) bulk-persist those deltas to Postgres. The idempotency_hash /
//   external_id dedup is identical to the SQLite path, so re-running converges.
import { fromAkahuPayload, type RawTransaction } from "./ledger-engine/rawTransaction";
import { validateBalanced, type JournalTransaction } from "./ledger-engine/journal";
import type { LedgerStore } from "./ledger-engine/pipeline";
import { LedgerPipeline, type PipelineResult } from "./ledger-engine/pipeline";
import { RulesRouter, type RulesConfig } from "./ledger-engine/rulesRouter";
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { throwServerError } from "./serverError";

interface TenantContext {
  tenantId: string;
}

async function requireTenant(): Promise<TenantContext> {
  const user = await getServerUser();
  if (!user) throwServerError("You must be signed in.", 401);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throwServerError(error.message, 400);
  const row = data?.[0] as { id: string } | undefined;
  if (!row) throwServerError("No workspace found. Finish onboarding first.", 409);
  return { tenantId: row.id };
}

// ── Per-tenant rules config loader ───────────────────────────────────────────
// Rebuilds the RulesConfig object the RulesRouter expects from the tenant's
// classification_rules / account_mappings / nzfcc_mappings rows (the DB form of
// the old rules.yaml). Ordering by (priority, seq) preserves the router's
// declaration-order tiebreak. A fresh tenant with no rules yields an empty
// config — every txn then routes to the suspense account, which is correct.
interface RuleRow {
  rule_key: string;
  priority: number;
  match_description_regex: string | null;
  match_merchant_regex: string | null;
  match_account_ids: string[] | null;
  match_amount_greater_than: string | number | null;
  match_amount_abs_greater_than: string | number | null;
  route_target_account: string;
  route_memo: string | null;
}
interface AccountMappingRow {
  akahu_account_id: string;
  ledger_account: string;
  account_type: string;
  credit_limit_cents: number | null;
}
interface NzfccRow {
  nzfcc_code: string;
  target_account: string;
}

async function loadTenantRules(tenantId: string): Promise<RulesConfig> {
  const supabase = getSupabaseServerClient();

  const [rulesRes, mappingsRes, nzfccRes, tenantRes] = await Promise.all([
    supabase
      .from("classification_rules")
      .select(
        "rule_key, priority, seq, is_enabled, match_description_regex, match_merchant_regex, match_account_ids, match_amount_greater_than, match_amount_abs_greater_than, route_target_account, route_memo",
      )
      .eq("tenant_id", tenantId)
      .eq("is_enabled", true)
      .order("priority", { ascending: true })
      .order("seq", { ascending: true }),
    supabase
      .from("account_mappings")
      .select("akahu_account_id, ledger_account, account_type, credit_limit_cents")
      .eq("tenant_id", tenantId),
    supabase
      .from("nzfcc_mappings")
      .select("nzfcc_code, target_account")
      .eq("tenant_id", tenantId),
    supabase
      .from("tenants")
      .select("default_currency, suspense_account")
      .eq("id", tenantId)
      .limit(1),
  ]);

  for (const res of [rulesRes, mappingsRes, nzfccRes, tenantRes]) {
    if (res.error) throwServerError(res.error.message, 400);
  }

  const rules = ((rulesRes.data ?? []) as RuleRow[]).map((r) => {
    const match: Record<string, unknown> = {};
    if (r.match_description_regex) match.description_regex = r.match_description_regex;
    if (r.match_merchant_regex) match.merchant_regex = r.match_merchant_regex;
    if (r.match_account_ids && r.match_account_ids.length > 0) match.account_ids = r.match_account_ids;
    if (r.match_amount_greater_than != null) match.amount_greater_than = r.match_amount_greater_than;
    if (r.match_amount_abs_greater_than != null)
      match.amount_abs_greater_than = r.match_amount_abs_greater_than;
    return {
      id: r.rule_key,
      priority: r.priority,
      match,
      route: { target_account: r.route_target_account, memo: r.route_memo ?? undefined },
    };
  });

  const account_mappings: Record<string, unknown> = {};
  for (const m of (mappingsRes.data ?? []) as AccountMappingRow[]) {
    account_mappings[m.akahu_account_id] = {
      ledger_account: m.ledger_account,
      account_type: m.account_type,
      credit_limit_cents: m.credit_limit_cents ?? undefined,
    };
  }

  const nzfcc_mappings: Record<string, unknown> = {};
  for (const n of (nzfccRes.data ?? []) as NzfccRow[]) {
    nzfcc_mappings[n.nzfcc_code] = n.target_account;
  }

  const tenantRow = (tenantRes.data?.[0] ?? {}) as {
    default_currency?: string;
    suspense_account?: string;
  };

  return {
    defaults: {
      currency: tenantRow.default_currency ?? "NZD",
      suspense_account: tenantRow.suspense_account ?? "Expenses:Uncategorized:Suspense",
    },
    rules,
    nzfcc_mappings,
    account_mappings,
  };
}

// ── Capturing store: preloaded dedup state + records the NEW rows ────────────
class CapturingLedgerStore implements LedgerStore {
  readonly newRaw: RawTransaction[] = [];
  readonly newJournals: JournalTransaction[] = [];

  constructor(
    private readonly existingRawHashes: Set<string>,
    private readonly existingJournalIds: Set<string>,
    private readonly manual: Map<string, [string, string | null]>,
  ) {}

  upsertRawTransaction(transaction: RawTransaction): boolean {
    if (this.existingRawHashes.has(transaction.idempotencyHash)) return false;
    this.existingRawHashes.add(transaction.idempotencyHash);
    this.newRaw.push(transaction);
    return true;
  }

  markRawSkipped(): void {
    // skipped_reason is captured at persist time from status/amount, not tracked here.
  }

  journalExists(externalId: string): boolean {
    return this.existingJournalIds.has(externalId);
  }

  insertJournalTransaction(transaction: JournalTransaction): boolean {
    validateBalanced(transaction);
    if (this.existingJournalIds.has(transaction.externalId)) return false;
    this.existingJournalIds.add(transaction.externalId);
    this.newJournals.push(transaction);
    return true;
  }

  getManualClassification(externalId: string): [string, string | null] | null {
    return this.manual.get(externalId) ?? null;
  }
}

export interface IngestResult extends PipelineResult {
  tenantId: string;
}

/**
 * Ingest a batch of Akahu-shaped payloads into the caller's tenant. Idempotent:
 * already-seen raw hashes / journal external_ids are skipped, so re-running the
 * same batch converges without duplicating rows. Returns the pipeline counts.
 */
export async function ingestTenantPayloads(
  payloads: ReadonlyArray<Record<string, unknown>>,
): Promise<IngestResult> {
  const tenant = await requireTenant();
  const supabase = getSupabaseServerClient();

  // Preload dedup state + manual classifications for this tenant.
  const [rawRes, journalRes, manualRes, config] = await Promise.all([
    supabase.from("raw_transactions").select("idempotency_hash").eq("tenant_id", tenant.tenantId),
    supabase.from("journal_transactions").select("external_id").eq("tenant_id", tenant.tenantId),
    supabase
      .from("manual_classifications")
      .select("external_id, target_account, memo")
      .eq("tenant_id", tenant.tenantId),
    loadTenantRules(tenant.tenantId),
  ]);
  for (const res of [rawRes, journalRes, manualRes]) {
    if (res.error) throwServerError(res.error.message, 400);
  }

  const existingRawHashes = new Set(
    ((rawRes.data ?? []) as { idempotency_hash: string }[]).map((r) => r.idempotency_hash),
  );
  const existingJournalIds = new Set(
    ((journalRes.data ?? []) as { external_id: string }[]).map((r) => r.external_id),
  );
  const manual = new Map<string, [string, string | null]>();
  for (const m of (manualRes.data ?? []) as {
    external_id: string;
    target_account: string;
    memo: string | null;
  }[]) {
    manual.set(m.external_id, [m.target_account, m.memo]);
  }

  const store = new CapturingLedgerStore(existingRawHashes, existingJournalIds, manual);
  const router = new RulesRouter(config);
  const pipeline = new LedgerPipeline(store, router);
  const result = pipeline.processPayloads(payloads);

  await persistDeltas(tenant.tenantId, store.newRaw, store.newJournals);

  return { ...result, tenantId: tenant.tenantId };
}

async function persistDeltas(
  tenantId: string,
  newRaw: RawTransaction[],
  newJournals: JournalTransaction[],
): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (newRaw.length > 0) {
    const rows = newRaw.map((t) => ({
      tenant_id: tenantId,
      akahu_transaction_id: t.akahuTransactionId,
      idempotency_hash: t.idempotencyHash,
      account_id: t.accountId,
      status: t.status,
      amount_cents: t.amountCents,
      currency: t.currency,
      transaction_date: t.transactionDate,
      settlement_date: t.settlementDate,
      description: t.description,
      merchant_name: t.merchantName,
      nzfcc: t.nzfcc,
      raw_json: JSON.parse(t.rawJson),
      processed_at: t.isPending || t.amountCents === 0 ? null : new Date().toISOString(),
      skipped_reason: t.isPending ? "pending" : t.amountCents === 0 ? "zero_amount" : null,
    }));
    const { error } = await supabase
      .from("raw_transactions")
      .upsert(rows, { onConflict: "tenant_id,idempotency_hash" });
    if (error) throwServerError(error.message, 400);
  }

  // Insert journal headers, then their entries (composite FK pins entries to
  // the parent's tenant). We need each header's generated uuid to link entries.
  for (const jt of newJournals) {
    const { data, error } = await supabase
      .from("journal_transactions")
      .upsert(
        {
          tenant_id: tenantId,
          external_id: jt.externalId,
          transaction_date: jt.transactionDate,
          description: jt.description,
          source_account_id: jt.sourceAccountId,
          status: jt.status,
          rule_id: jt.ruleId,
        },
        { onConflict: "tenant_id,external_id" },
      )
      .select("id")
      .limit(1);
    if (error) throwServerError(error.message, 400);
    const journalId = (data?.[0] as { id: string } | undefined)?.id;
    if (!journalId) continue;

    const entryRows = jt.postings.map((p) => ({
      tenant_id: tenantId,
      journal_transaction_id: journalId,
      account: p.account,
      side: p.side,
      amount_cents: p.amountCents,
      currency: p.currency,
    }));
    const { error: entryError } = await supabase.from("journal_entries").insert(entryRows);
    if (entryError) throwServerError(entryError.message, 400);
  }
}
