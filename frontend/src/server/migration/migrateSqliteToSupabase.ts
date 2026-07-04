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
 *  - account_mappings is backfilled from config/rules.yaml (the same file the
 *    SQLite dashboard reads for credit facilities / source-account mapping).
 */

export interface MigrateOptions {
  sqlitePath: string;
  rulesPath: string;
  pgUrl: string;
  tenant: { slug: string; name: string; tier: "self-serve" | "concierge" };
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

function parseAccountMappings(rulesPath: string): Map<string, AccountMappingConfig> {
  const config = yaml.load(readFileSync(rulesPath, "utf-8")) as {
    account_mappings?: Record<string, AccountMappingConfig> | null;
  } | null;
  const mappings = new Map<string, AccountMappingConfig>();
  for (const [accountId, raw] of Object.entries(config?.account_mappings ?? {})) {
    if (raw && typeof raw === "object") mappings.set(accountId, raw);
  }
  return mappings;
}

export async function migrateLedger(options: MigrateOptions): Promise<MigrationSummary> {
  const sqlite = new Database(options.sqlitePath, { readonly: true, fileMustExist: true });
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
    const accountMappings = parseAccountMappings(options.rulesPath);

    // Map each SQLite journal integer id to a generated uuid so entries link
    // without round-trips, and to a synthetic monotonic created_at.
    const journalUuidById = new Map<number, string>();

    await client.connect();
    try {
      await client.query("BEGIN");

      const tenant = await client.query<{ id: string }>(
        `INSERT INTO public.tenants (name, slug, tier)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = excluded.name, tier = excluded.tier, updated_at = now()
         RETURNING id`,
        [options.tenant.name, options.tenant.slug, options.tenant.tier],
      );
      const tenantId = tenant.rows[0].id;

      // Wipe this tenant's ported rows (children first) so the backfill is
      // idempotent / re-runnable.
      for (const table of [
        "journal_entries",
        "journal_transactions",
        "raw_transactions",
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
        [...accountMappings.entries()].map(([accountId, mapping]) => [
          tenantId,
          accountId,
          mapping.ledger_account,
          (mapping.account_type ?? "asset").toLowerCase(),
          mapping.credit_limit_cents ?? null,
        ]),
      );

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
      };
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.end();
    sqlite.close();
  }
}
