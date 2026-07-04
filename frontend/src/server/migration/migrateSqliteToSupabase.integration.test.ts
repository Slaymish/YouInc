import path from "node:path";
import Database from "better-sqlite3";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateLedger, type MigrationSummary } from "./migrateSqliteToSupabase";

/**
 * Migration integration check against a live local Supabase. Gated on
 * SUPABASE_DB_URL so the default `pnpm test` (unit/golden suites) stays green
 * with no database. Run with:
 *   SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
 *     pnpm exec vitest run src/server/migration
 *
 * This is the migration's oracle check: the SQLite ledger is the source of
 * truth, and after backfill the Postgres tenant rows must match it row-for-row
 * (counts) and on the balances aggregate the dashboard is built from.
 */

const pgUrl = process.env.SUPABASE_DB_URL;
const sqlitePath = path.resolve(process.cwd(), "../data/youinc-ledger.sqlite3");
const rulesPath = path.resolve(process.cwd(), "../config/rules.yaml");

type BalanceMap = Record<string, number>;

function sqliteBalances(): BalanceMap {
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `SELECT account, SUM(CASE WHEN side='debit' THEN amount_cents ELSE -amount_cents END) AS bal
         FROM journal_entries GROUP BY account`,
      )
      .all() as { account: string; bal: number }[];
    return Object.fromEntries(rows.map((r) => [r.account, Number(r.bal)]));
  } finally {
    db.close();
  }
}

async function pgBalances(client: Client, tenantId: string): Promise<BalanceMap> {
  const { rows } = await client.query<{ account: string; bal: string }>(
    `SELECT account, SUM(CASE WHEN side='debit' THEN amount_cents ELSE -amount_cents END) AS bal
     FROM public.journal_entries WHERE tenant_id = $1 GROUP BY account`,
    [tenantId],
  );
  // Postgres SUM(bigint) returns a string; normalize to number for comparison.
  return Object.fromEntries(rows.map((r) => [r.account, Number(r.bal)]));
}

async function pgCount(client: Client, table: string, tenantId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*) AS count FROM public.${table} WHERE tenant_id = $1`,
    [tenantId],
  );
  return Number(rows[0].count);
}

function sqliteCount(table: string): number {
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    return (db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c;
  } finally {
    db.close();
  }
}

describe.skipIf(!pgUrl)("migrateLedger — SQLite → Supabase backfill parity", () => {
  let summary: MigrationSummary;
  let client: Client;

  beforeAll(async () => {
    summary = await migrateLedger({
      sqlitePath,
      rulesPath,
      pgUrl: pgUrl!,
      tenant: { slug: "owner", name: "You Inc.", tier: "concierge" },
    });
    client = new Client({ connectionString: pgUrl });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("backfills every ported table with the SQLite row counts", async () => {
    expect(summary.rawTransactions).toBe(sqliteCount("raw_transactions"));
    expect(summary.journalTransactions).toBe(sqliteCount("journal_transactions"));
    expect(summary.journalEntries).toBe(sqliteCount("journal_entries"));
    expect(summary.manualAccountBalances).toBe(sqliteCount("manual_account_balances"));
    expect(summary.syncState).toBe(sqliteCount("sync_state"));
    expect(summary.manualClassifications).toBe(sqliteCount("manual_classifications"));

    // And those rows are actually present in Postgres for the tenant.
    expect(await pgCount(client, "raw_transactions", summary.tenantId)).toBe(
      summary.rawTransactions,
    );
    expect(await pgCount(client, "journal_entries", summary.tenantId)).toBe(
      summary.journalEntries,
    );
  });

  it("preserves the account balances aggregate the dashboard is built on", async () => {
    const expected = sqliteBalances();
    const actual = await pgBalances(client, summary.tenantId);
    expect(actual).toEqual(expected);
  });

  it("is idempotent — a second run yields identical counts", async () => {
    const second = await migrateLedger({
      sqlitePath,
      rulesPath,
      pgUrl: pgUrl!,
      tenant: { slug: "owner", name: "You Inc.", tier: "concierge" },
    });
    expect(second.rawTransactions).toBe(summary.rawTransactions);
    expect(second.journalTransactions).toBe(summary.journalTransactions);
    expect(second.journalEntries).toBe(summary.journalEntries);
    expect(await pgCount(client, "journal_transactions", second.tenantId)).toBe(
      summary.journalTransactions,
    );
  });
});
