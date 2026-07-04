// Server-only: seed a starter classification config for the caller's tenant and
// ingest a small sample Akahu batch, so a self-service user can see a real
// journal-derived ledger + balances before live bank sync (Akahu OAuth) ships.
//
// Everything runs under the caller's RLS context via the Supabase server client.
// Idempotent: config upserts on natural keys and ingestion dedupes on
// idempotency_hash / external_id, so re-running "Load sample data" converges.
import { getSupabaseServerClient, getServerUser } from "./supabaseServer";
import { ingestTenantPayloads, type IngestResult } from "./tenantIngestion";

const SAMPLE_SOURCE_ACCOUNT = "acc_youinc_sample";

// A tiny, self-contained Akahu-shaped batch (mirrors tests/fixtures but scoped
// to a sample account id we also map below). Salary in, a couple of expenses,
// one pending (skipped), one asset purchase.
const SAMPLE_PAYLOADS: ReadonlyArray<Record<string, unknown>> = [
  {
    _id: "sample_salary_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-01",
    settlement_date: "2026-06-01",
    amount: 5000.0,
    currency: "NZD",
    description: "ACME PAYROLL SALARY",
    merchant: { name: "ACME Payroll" },
    category: { nzfcc: "income" },
  },
  {
    _id: "sample_rent_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-02",
    settlement_date: "2026-06-02",
    amount: -1800.0,
    currency: "NZD",
    description: "CITY PROPERTY RENT",
    merchant: { name: "City Property" },
    category: { nzfcc: "rent" },
  },
  {
    _id: "sample_spark_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-03",
    settlement_date: "2026-06-04",
    amount: -89.99,
    currency: "NZD",
    description: "SPARK NZ LTD AUCKLAND NZ",
    merchant: { name: "Spark NZ" },
    category: { nzfcc: "software" },
  },
  {
    _id: "sample_pending_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "PENDING",
    date: "2026-06-05",
    amount: -12.5,
    currency: "NZD",
    description: "PENDING COFFEE TEST",
    merchant: { name: "Coffee Test" },
  },
  {
    _id: "sample_groceries_001",
    _account: SAMPLE_SOURCE_ACCOUNT,
    status: "SETTLED",
    date: "2026-06-06",
    settlement_date: "2026-06-06",
    amount: -152.4,
    currency: "NZD",
    description: "COUNTDOWN SUPERMARKET",
    merchant: { name: "Countdown" },
    category: { nzfcc: "groceries" },
  },
];

interface StarterRule {
  rule_key: string;
  seq: number;
  priority: number;
  match_description_regex?: string;
  route_target_account: string;
}

const STARTER_RULES: StarterRule[] = [
  {
    rule_key: "sample_salary",
    seq: 0,
    priority: 100,
    match_description_regex: "(?i)payroll|salary",
    route_target_account: "Income:Salary",
  },
  {
    rule_key: "sample_rent",
    seq: 1,
    priority: 100,
    match_description_regex: "(?i)rent",
    route_target_account: "Expenses:Housing:Rent",
  },
  {
    rule_key: "sample_software",
    seq: 2,
    priority: 100,
    match_description_regex: "(?i)spark|vodafone|internet",
    route_target_account: "Expenses:Software",
  },
  {
    rule_key: "sample_groceries",
    seq: 3,
    priority: 100,
    match_description_regex: "(?i)countdown|new world|pak.?n.?save|supermarket",
    route_target_account: "Expenses:Groceries",
  },
];

async function requireTenantId(): Promise<string> {
  const user = await getServerUser();
  if (!user) throw new Response("You must be signed in.", { status: 401 });
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Response(error.message, { status: 400 });
  const row = data?.[0] as { id: string } | undefined;
  if (!row) throw new Response("No workspace found. Finish onboarding first.", { status: 409 });
  return row.id;
}

/** Seed a starter account mapping + rules for the tenant (idempotent), then
 *  ingest the sample batch. Returns the ingestion counts. */
export async function loadSampleData(): Promise<IngestResult> {
  const tenantId = await requireTenantId();
  const supabase = getSupabaseServerClient();

  const mappingRes = await supabase.from("account_mappings").upsert(
    {
      tenant_id: tenantId,
      akahu_account_id: SAMPLE_SOURCE_ACCOUNT,
      ledger_account: "Assets:Bank:Everyday",
      account_type: "asset",
    },
    { onConflict: "tenant_id,akahu_account_id" },
  );
  if (mappingRes.error) throw new Response(mappingRes.error.message, { status: 400 });

  const rulesRes = await supabase.from("classification_rules").upsert(
    STARTER_RULES.map((r) => ({
      tenant_id: tenantId,
      rule_key: r.rule_key,
      seq: r.seq,
      priority: r.priority,
      is_enabled: true,
      match_description_regex: r.match_description_regex ?? null,
      route_target_account: r.route_target_account,
    })),
    { onConflict: "tenant_id,rule_key" },
  );
  if (rulesRes.error) throw new Response(rulesRes.error.message, { status: 400 });

  return ingestTenantPayloads(SAMPLE_PAYLOADS);
}
