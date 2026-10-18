import type { DatabaseSync } from 'node:sqlite';

/**
 * Read models. Everything here is a pure query over the ledger file, so the
 * same numbers are available to the CLI, to me via `sqlite3`, and to the tests.
 */

export interface AccountMappingRow {
  akahuAccountId: string;
  name: string;
  ledgerAccount: string;
  accountType: 'asset' | 'liability';
  hasFeed: boolean;
  connection: string | null;
  connectionId: string | null;
  formattedAccount: string | null;
  creditLimitCents: number | null;
}

export function accountMappings(db: DatabaseSync): AccountMappingRow[] {
  return db.prepare(
    `SELECT akahu_account_id AS akahuAccountId, name, ledger_account AS ledgerAccount,
            account_type AS accountType, has_feed AS hasFeed, connection, connection_id AS connectionId,
            formatted_account AS formattedAccount, credit_limit_cents AS creditLimitCents
       FROM account_mappings ORDER BY ledger_account`,
  ).all().map((r) => {
    const row = r as Record<string, unknown>;
    return {
      akahuAccountId: String(row.akahuAccountId),
      name: String(row.name),
      ledgerAccount: String(row.ledgerAccount),
      accountType: row.accountType === 'liability' ? 'liability' : 'asset',
      hasFeed: Boolean(row.hasFeed),
      connection: row.connection === null ? null : String(row.connection),
      connectionId: row.connectionId === null ? null : String(row.connectionId),
      formattedAccount: row.formattedAccount === null ? null : String(row.formattedAccount),
      creditLimitCents: row.creditLimitCents === null ? null : Number(row.creditLimitCents),
    } satisfies AccountMappingRow;
  });
}

export interface SpendRow {
  group: string;
  cents: number;
  count: number;
}

/**
 * Spending by account prefix for a date range.
 *
 * Debit on an `Expenses:*` account is spend. Transfers never reach an expense
 * account once paired, and unpaired ones land in `Expenses:Uncategorized:Suspense`
 * (visible, not silently absorbed into a category).
 */
export function spendByAccount(
  db: DatabaseSync,
  from: string,
  to: string,
  groupBy: 'account' | 'top' | 'month' = 'top',
): SpendRow[] {
  const key =
    groupBy === 'top'
      // Two levels: `Expenses:Groceries` is already top-level and must not
      // collapse to `Expenses:` just because it has no third segment.
      ? "CASE WHEN instr(substr(e.account, 10), ':') = 0 THEN e.account ELSE substr(e.account, 1, instr(substr(e.account, 10), ':') + 8) END"
      : groupBy === 'month'
        ? 'substr(j.transaction_date, 1, 7)'
        : 'e.account';
  const rows = db.prepare(
    // Net, not debits-only. A refund, a reimbursement or a reclassification
    // contra posts a CREDIT to an expense account; summing debits alone counts
    // the original spend and ignores the money coming back, which overstates
    // every category that ever had one.
    `SELECT ${key} AS grp,
            SUM(CASE e.side WHEN 'debit' THEN e.amount_cents ELSE -e.amount_cents END) AS cents,
            COUNT(*) AS n
       FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account LIKE 'Expenses:%'
        AND j.transaction_date BETWEEN ? AND ?
      GROUP BY grp HAVING cents != 0 ORDER BY cents DESC`,
  ).all(from, to) as Array<{ grp: string; cents: number; n: number }>;
  return rows.map((r) => ({ group: String(r.grp), cents: Number(r.cents), count: Number(r.n) }));
}

export interface IncomeRow {
  group: string;
  cents: number;
  count: number;
}

export function incomeByAccount(db: DatabaseSync, from: string, to: string): IncomeRow[] {
  const rows = db.prepare(
    `SELECT e.account AS grp, SUM(e.amount_cents) AS cents, COUNT(*) AS n
       FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account LIKE 'Income:%' AND e.side = 'credit'
        AND j.transaction_date BETWEEN ? AND ?
      GROUP BY grp ORDER BY cents DESC`,
  ).all(from, to) as Array<{ grp: string; cents: number; n: number }>;
  return rows.map((r) => ({ group: String(r.grp), cents: Number(r.cents), count: Number(r.n) }));
}

export interface UncategorisedRow {
  externalId: string;
  transactionDate: string;
  description: string;
  cents: number;
  account: string;
}

/**
 * Suspense is a **net** figure, not a count of entries.
 *
 * A reclassify does not rewrite the original journal — it posts a second one
 * with the external id `reclassify:<original>:<target>:<amount>` and the
 * opposite side on the suspense account. So a cleared item still leaves its
 * original suspense debit behind, offset by an equal credit in the correction.
 * Counting raw debits therefore keeps reporting money that Hamish has already
 * classified (the $67 groceries, the WOW ticket, the pizza) and inflates the
 * unclassified total — the doctor said 30 pending when four of them were done.
 *
 * Grouping each correction back to its original transaction and netting the two
 * legs leaves only the residue that genuinely has no decision behind it.
 */
export const SUSPENSE_NET_SQL = `
  WITH legs AS (
    SELECT
      CASE WHEN COALESCE(j.rule_id, '') = 'manual:reclassify'
           THEN CASE WHEN instr(substr(j.external_id, 12), ':') > 0
                     THEN substr(substr(j.external_id, 12), 1, instr(substr(j.external_id, 12), ':') - 1)
                     ELSE substr(j.external_id, 12) END
           ELSE j.external_id END AS root_id,
      j.transaction_date AS transaction_date,
      j.description AS description,
      COALESCE(j.rule_id, '') AS rule_id,
      e.account AS account,
      e.side AS side,
      e.amount_cents AS amount_cents
    FROM journal_entries e
    JOIN journal_transactions j ON j.id = e.journal_transaction_id
  ),
  net AS (
    SELECT root_id,
           MAX(transaction_date) AS transaction_date,
           MIN(CASE WHEN rule_id <> 'manual:reclassify' THEN description END) AS description,
           SUM(CASE WHEN account = 'Expenses:Uncategorized:Suspense'
                    THEN (CASE side WHEN 'debit' THEN amount_cents ELSE -amount_cents END) ELSE 0 END) AS suspense_cents,
           SUM(CASE WHEN account = 'Income:Unidentified'
                    THEN (CASE side WHEN 'credit' THEN amount_cents ELSE -amount_cents END) ELSE 0 END) AS unidentified_cents
    FROM legs GROUP BY root_id
  )`;

/** Suspense backlog: what is waiting for a rule or a decision. */
export function suspenseQueue(db: DatabaseSync, limit = 50): UncategorisedRow[] {
  const rows = db.prepare(
    `${SUSPENSE_NET_SQL}
     SELECT root_id AS externalId, transaction_date AS transactionDate, description,
            suspense_cents AS suspenseCents, unidentified_cents AS unidentifiedCents
       FROM net
      WHERE suspense_cents > 0 OR unidentified_cents > 0
      ORDER BY transaction_date DESC LIMIT ?`,
  ).all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => {
    const suspense = Number(r.suspenseCents);
    const unidentified = Number(r.unidentifiedCents);
    return {
      externalId: String(r.externalId),
      transactionDate: String(r.transactionDate),
      description: r.description === null ? '' : String(r.description),
      cents: suspense > 0 ? suspense : unidentified,
      account: suspense > 0 ? 'Expenses:Uncategorized:Suspense' : 'Income:Unidentified',
    } satisfies UncategorisedRow;
  });
}

/** Monthly cash flow: income, spend (excluding suspense), and net. */
export function monthlyCashflow(db: DatabaseSync, from: string, to: string) {
  const rows = db.prepare(
    `SELECT substr(j.transaction_date, 1, 7) AS month,
            SUM(CASE WHEN e.account LIKE 'Income:%' AND e.side = 'credit' THEN e.amount_cents ELSE 0 END) AS income,
            SUM(CASE WHEN e.account LIKE 'Expenses:%' AND e.side = 'debit' THEN e.amount_cents ELSE 0 END) AS spend
       FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE j.transaction_date BETWEEN ? AND ?
      GROUP BY month ORDER BY month`,
  ).all(from, to) as Array<{ month: string; income: number; spend: number }>;
  return rows.map((r) => ({ month: String(r.month), incomeCents: Number(r.income), spendCents: Number(r.spend), netCents: Number(r.income) - Number(r.spend) }));
}
