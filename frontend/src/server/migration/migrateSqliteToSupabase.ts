import { readFileSync } from "node:fs";
import Database from "better-sqlite3";
import yaml from "js-yaml";
import { Client } from "pg";

/**
 * One-shot backfill of the owner's single-user SQLite ledger into the
 * multi-tenant Supabase (Postgres) tenant schema (P2 migration). Idempotent:
 * re-running wipes the target tenant's rows and re-inserts, so it doubles as
 * fixture setup for the differential read-parity harness.
 *
 * SQLite → Postgres shape notes reproduced here:
 *  - Every ported table gains tenant_id; journal_entries also denormalizes it.
 *  - Surrogate INTEGER ids become uuids (generated here so entries can be
 *    linked to their journal without a round-trip).
 *  - journal_transactions.created_at is REWRITTEN to a synthetic timestamp that
 *    is strictly monotonic in the SQLite integer id order. The dashboard never
 *    surfaces journal created_at, but the read layer must tiebreak same-date
 *    rows by insertion order (SQLite did `ORDER BY jt.id DESC`); a random uuid
 *    PK has no such order, so created_at carries it. The read-DAL then orders
 *    `transaction_date DESC, created_at DESC` to reproduce SQLite exactly.
 *  - journal_entries need no surrogate: every journal is a 2-leg debit/credit
 *    pair, so the read layer orders postings by side (debit first).
 *  - config/rules.yaml is backfilled into three tables: tenant defaults
 *    (default_currency / suspense_account), account_mappings, nzfcc_mappings,
 *    and classification_rules. Rule declaration order is captured as `seq` so
 *    the (priority, seq) sort reproduces the Python/TS router's
 *    (priority, declaration-index) tiebreak exactly.
 *  - Waitlist leads are ported from the separate youinc-leads.sqlite3 when
 *    `leadsSqlitePath` is given. They are tenant-independent (email-unique),
 *    so they are upserted by email rather than wiped per tenant.
 *
 * Deliberately OUT of scope for this script (see docs/architecture/
 * migration-strategy.md steps 5 & 7) — they are operational, not an idempotent
 * data backfill:
 *  - Akahu tokens → Vault + akahu_connections (step 5): moves LIVE banking
 *    secrets, needs the Supabase Vault, and requires scrub+rotate of the raw
 *    tokens. Must be run as a one-off operational step, not from a harness that
 *    wipes/reinserts.
 *  - Owner link (step 7): profiles + owner membership + akahu_connections.user_id
 *    require a post-signup auth.users row, which does not exist until the owner
 *    re-enrolls via Supabase Auth. Runs after first sign-in, not here.
 */

export interface MigrateOptions {
  sqlitePath: string;
  rulesPath: string;
  pgUrl: string;
  tenant: { slug: string; name: string; tier: "self-serve" | "concierge" };
  /**
   * Optional path to the separate waitlist SQLite DB (`youinc-leads.sqlite3`).
   * Leads are tenant-independent (email-unique), so this is decoupled from the
   * per-tenant ledger backfill; when omitted, the leads step is skipped.
   */
  leadsSqlitePath?: string;
}

export interface MigrationSummary {
  tenantId: string;
  rawTransactions: number;
  journalTransactions: number;
  journalEntries: number;
  manualAccountBalances: number;
  syncState: number;
  manualClassifications: number;
  accountMappings: number;
  classificationRules: number;
  nzfccMappings: number;
  leads: number;
}

// Synthetic monotonic base for journal created_at (see file header). Fixed and
// far in the past so it never collides with, or is mistaken for, real data.
const JOURNAL_SEQ_EPOCH_MS = Date.UTC(2000, 0, 1);

interface RawTxnRow {
  akahu_transaction_id: string | null;
  idempotency_hash: string;
  account_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  transaction_date: string;
  settlement_date: string | null;
  description: string;
  merchant_name: string | null;
  nzfcc: string | null;
  raw_json: string;
  first_seen_at: string;
  last_seen_at: string;
  processed_at: string | null;
  skipped_reason: string | null;
}

interface JournalTxnRow {
  id: number;
  external_id: string;
  transaction_date: string;
  description: string;
  source_account_id: string;
  status: string;
  rule_id: string | null;
}

interface JournalEntryRow {
  journal_transaction_id: number;
  account: string;
  side: string;
  amount_cents: number;
  currency: string;
}

interface ManualBalanceRow {
  account: string;
  balance_cents: number;
  as_of_date: string;
  updated_at: string;
}

interface SyncStateRow {
  key: string;
  value: string;
  updated_at: string;
}

interface ManualClassificationRow {
  external_id: string;
  target_account: string;
  memo: string | null;
}

interface AccountMappingConfig {
  ledger_account: string;
  account_type?: string;
  credit_limit_cents?: number | null;
}

interface LeadRow {
  email: string;
  name: string | null;
  interest: string | null;
  source: string | null;
  user_agent: string | null;
  created_at: number;
}

interface RuleMatchConfig {
  description_regex?: string | null;
  merchant_regex?: string | null;
  account_ids?: string[] | null;
  amount_greater_than?: number | null;
  amount_abs_greater_than?: number | null;
}

interface ClassificationRuleConfig {
  id: string;
  priority?: number;
  match?: RuleMatchConfig | null;
  route: { target_account: string; memo?: string | null };
}

interface RulesConfig {
  defaults: { currency: string; suspense_account: string };
  accountMappings: Map<string, AccountMappingConfig>;
  nzfccMappings: Map<string, string>;
  rules: ClassificationRuleConfig[];
}

// Schema-level defaults, mirrored here so a rules.yaml without a `defaults`
// block still produces the same tenant configuration the DDL would.
const DEFAULT_CURRENCY = "NZD";
const DEFAULT_SUSPENSE_ACCOUNT = "Expenses:Uncategorized:Suspense";
// Router default when a rule omits `priority` (see rules_router: lower wins,
// ties break on declaration order). Must match the classification_rules DDL.
const DEFAULT_RULE_PRIORITY = 1000;

/**
 * Insert rows as a single multi-row parameterized statement. Row counts here
 * are small (hundreds), so one statement per table stays well under Postgres's
 * 65535-parameter limit.
 */
async function insertRows(
  client: Client,
  table: string,
  columns: string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const values: unknown[] = [];
  const tuples = rows.map((row, r) => {
    const placeholders = columns.map((_, c) => `$${r * columns.length + c + 1}`);
    values.push(...row);
    return `(${placeholders.join(",")})`;
  });
  await client.query(
    `INSERT INTO public.${table} (${columns.join(",")}) VALUES ${tuples.join(",")}`,
    values,
  );
  return rows.length;
}

/**
 * Parse config/rules.yaml once into everything the backfill needs: tenant
 * defaults, source-account mappings, nzfcc fallbacks, and the classification
 * rules. Rule ORDER IS PRESERVED — the array index becomes each rule's `seq`,
 * which (paired with `priority`) reproduces the Python/TS router's
 * (priority, declaration-index) tiebreak exactly. js-yaml preserves mapping
 * insertion order, so Object.entries/array order here is YAML declaration order.
 */
function loadRulesConfig(rulesPath: string): RulesConfig {
  const config = yaml.load(readFileSync(rulesPath, "utf-8")) as {
    defaults?: { currency?: string; suspense_account?: string } | null;
    account_mappings?: Record<string, AccountMappingConfig> | null;
    nzfcc_mappings?: Record<string, { target_account?: string }> | null;
    rules?: ClassificationRuleConfig[] | null;
  } | null;

  const accountMappings = new Map<string, AccountMappingConfig>();
  for (const [accountId, raw] of Object.entries(config?.account_mappings ?? {})) {
    if (raw && typeof raw === "object") accountMappings.set(accountId, raw);
  }

  const nzfccMappings = new Map<string, string>();
  for (const [code, raw] of Object.entries(config?.nzfcc_mappings ?? {})) {
    if (raw && typeof raw === "object" && typeof raw.target_account === "string") {
      nzfccMappings.set(code, raw.target_account);
    }
  }

  return {
    defaults: {
      currency: config?.defaults?.currency ?? DEFAULT_CURRENCY,
      suspense_account: config?.defaults?.suspense_account ?? DEFAULT_SUSPENSE_ACCOUNT,
    },
    accountMappings,
    nzfccMappings,
    rules: config?.rules ?? [],
  };
}

export async function migrateLedger(options: MigrateOptions): Promise<MigrationSummary> {
  const sqlite = new Database(options.sqlitePath, { readonly: true, fileMustExist: true });
  const leadsDb = options.leadsSqlitePath
    ? new Database(options.leadsSqlitePath, { readonly: true, fileMustExist: true })
    : null;
  const client = new Client({ connectionString: options.pgUrl });

  try {
    const rawTxns = sqlite.prepare("SELECT * FROM raw_transactions").all() as RawTxnRow[];
    const journals = sqlite
      .prepare("SELECT * FROM journal_transactions ORDER BY id")
      .all() as JournalTxnRow[];
    const entries = sqlite
      .prepare("SELECT * FROM journal_entries ORDER BY journal_transaction_id, id")
      .all() as JournalEntryRow[];
    const manualBalances = sqlite
      .prepare("SELECT * FROM manual_account_balances")
      .all() as ManualBalanceRow[];
    const syncState = sqlite.prepare("SELECT * FROM sync_state").all() as SyncStateRow[];
    const manualClassifications = sqlite
      .prepare("SELECT * FROM manual_classifications")
      .all() as ManualClassificationRow[];
    const rulesConfig = loadRulesConfig(options.rulesPath);
    const leads = leadsDb ? (leadsDb.prepare("SELECT * FROM leads").all() as LeadRow[]) : [];

    // Map each SQLite journal integer id to a generated uuid so entries link
    // without round-trips, and to a synthetic monotonic created_at.
    const journalUuidById = new Map<number, string>();

    await client.connect();
    try {
      await client.query("BEGIN");

      const tenant = await client.query<{ id: string }>(
        `INSERT INTO public.tenants (name, slug, tier, default_currency, suspense_account)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET
           name = excluded.name,
           tier = excluded.tier,
           default_currency = excluded.default_currency,
           suspense_account = excluded.suspense_account,
           updated_at = now()
         RETURNING id`,
        [
          options.tenant.name,
          options.tenant.slug,
          options.tenant.tier,
          rulesConfig.defaults.currency,
          rulesConfig.defaults.suspense_account,
        ],
      );
      const tenantId = tenant.rows[0].id;

      // Wipe this tenant's ported rows (children first) so the backfill is
      // idempotent / re-runnable.
      for (const table of [
        "journal_entries",
        "journal_transactions",
        "raw_transactions",
        "classification_rules",
        "nzfcc_mappings",
        "manual_account_balances",
        "sync_state",
        "manual_classifications",
        "account_mappings",
      ]) {
        await client.query(`DELETE FROM public.${table} WHERE tenant_id = $1`, [tenantId]);
      }

      const rawCount = await insertRows(
        client,
        "raw_transactions",
        [
          "tenant_id",
          "akahu_transaction_id",
          "idempotency_hash",
          "account_id",
          "status",
          "amount_cents",
          "currency",
          "transaction_date",
          "settlement_date",
          "description",
          "merchant_name",
          "nzfcc",
          "raw_json",
          "first_seen_at",
          "last_seen_at",
          "processed_at",
          "skipped_reason",
        ],
        rawTxns.map((t) => [
          tenantId,
          t.akahu_transaction_id,
          t.idempotency_hash,
          t.account_id,
          t.status,
          t.amount_cents,
          t.currency,
          t.transaction_date,
          t.settlement_date,
          t.description,
          t.merchant_name,
          t.nzfcc,
          t.raw_json,
          t.first_seen_at,
          t.last_seen_at,
          t.processed_at,
          t.skipped_reason,
        ]),
      );

      const journalCount = await insertRows(
        client,
        "journal_transactions",
        [
          "id",
          "tenant_id",
          "external_id",
          "transaction_date",
          "description",
          "source_account_id",
          "status",
          "rule_id",
          "created_at",
        ],
        journals.map((j) => {
          const uuid = crypto.randomUUID();
          journalUuidById.set(j.id, uuid);
          // Strictly monotonic in SQLite id order — preserves the insertion-order
          // tiebreak the dashboard relies on (see file header).
          const createdAt = new Date(JOURNAL_SEQ_EPOCH_MS + j.id * 1000).toISOString();
          return [
            uuid,
            tenantId,
            j.external_id,
            j.transaction_date,
            j.description,
            j.source_account_id,
            j.status,
            j.rule_id,
            createdAt,
          ];
        }),
      );

      const entryCount = await insertRows(
        client,
        "journal_entries",
        ["tenant_id", "journal_transaction_id", "account", "side", "amount_cents", "currency"],
        entries.map((e) => {
          const journalUuid = journalUuidById.get(e.journal_transaction_id);
          if (!journalUuid) {
            throw new Error(
              `journal_entry references unknown journal_transaction_id ${e.journal_transaction_id}`,
            );
          }
          return [tenantId, journalUuid, e.account, e.side, e.amount_cents, e.currency];
        }),
      );

      const manualBalanceCount = await insertRows(
        client,
        "manual_account_balances",
        ["tenant_id", "account", "balance_cents", "as_of_date", "updated_at"],
        manualBalances.map((m) => [
          tenantId,
          m.account,
          m.balance_cents,
          m.as_of_date,
          m.updated_at,
        ]),
      );

      const syncStateCount = await insertRows(
        client,
        "sync_state",
        ["tenant_id", "key", "value", "updated_at"],
        syncState.map((s) => [tenantId, s.key, s.value, s.updated_at]),
      );

      const manualClassificationCount = await insertRows(
        client,
        "manual_classifications",
        ["tenant_id", "external_id", "target_account", "memo"],
        manualClassifications.map((m) => [tenantId, m.external_id, m.target_account, m.memo]),
      );

      const accountMappingCount = await insertRows(
        client,
        "account_mappings",
        ["tenant_id", "akahu_account_id", "ledger_account", "account_type", "credit_limit_cents"],
        [...rulesConfig.accountMappings.entries()].map(([accountId, mapping]) => [
          tenantId,
          accountId,
          mapping.ledger_account,
          (mapping.account_type ?? "asset").toLowerCase(),
          mapping.credit_limit_cents ?? null,
        ]),
      );

      // Classification rules. The array index is the `seq` — pairing it with
      // `priority` reproduces the router's (priority, declaration-index)
      // tiebreak. match_account_ids is a Postgres text[]; node-pg maps a JS
      // string[] parameter to it directly (null when the rule omits it).
      const classificationRuleCount = await insertRows(
        client,
        "classification_rules",
        [
          "tenant_id",
          "rule_key",
          "seq",
          "priority",
          "match_description_regex",
          "match_merchant_regex",
          "match_account_ids",
          "match_amount_greater_than",
          "match_amount_abs_greater_than",
          "route_target_account",
          "route_memo",
        ],
        rulesConfig.rules.map((rule, seq) => [
          tenantId,
          rule.id,
          seq,
          rule.priority ?? DEFAULT_RULE_PRIORITY,
          rule.match?.description_regex ?? null,
          rule.match?.merchant_regex ?? null,
          rule.match?.account_ids ?? null,
          rule.match?.amount_greater_than ?? null,
          rule.match?.amount_abs_greater_than ?? null,
          rule.route.target_account,
          rule.route.memo ?? null,
        ]),
      );

      const nzfccMappingCount = await insertRows(
        client,
        "nzfcc_mappings",
        ["tenant_id", "nzfcc_code", "target_account"],
        [...rulesConfig.nzfccMappings.entries()].map(([code, targetAccount]) => [
          tenantId,
          code,
          targetAccount,
        ]),
      );

      // Waitlist leads are tenant-independent (email is globally unique), so
      // they are NOT part of the per-tenant wipe above; upsert by email so a
      // re-run converges without duplicating. Source created_at is an integer
      // epoch in MILLISECONDS → timestamptz.
      let leadCount = 0;
      for (const lead of leads) {
        await client.query(
          `INSERT INTO public.leads (email, name, interest, source, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (email) DO UPDATE SET
             name = excluded.name,
             interest = excluded.interest,
             source = excluded.source,
             user_agent = excluded.user_agent,
             created_at = excluded.created_at`,
          [
            lead.email,
            lead.name,
            lead.interest,
            lead.source,
            lead.user_agent,
            new Date(lead.created_at).toISOString(),
          ],
        );
        leadCount += 1;
      }

      await client.query("COMMIT");

      return {
        tenantId,
        rawTransactions: rawCount,
        journalTransactions: journalCount,
        journalEntries: entryCount,
        manualAccountBalances: manualBalanceCount,
        syncState: syncStateCount,
        manualClassifications: manualClassificationCount,
        accountMappings: accountMappingCount,
        classificationRules: classificationRuleCount,
        nzfccMappings: nzfccMappingCount,
        leads: leadCount,
      };
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
    sqlite.close();
    leadsDb?.close();
  }
}
