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
      ? "substr(e.account, 1, instr(substr(e.account, 10), ':') + 9)"
      : groupBy === 'month'
        ? 'substr(j.transaction_date, 1, 7)'
        : 'e.account';
  const rows = db.prepare(
    `SELECT ${key} AS grp, SUM(e.amount_cents) AS cents, COUNT(*) AS n
       FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account LIKE 'Expenses:%' AND e.side = 'debit'
        AND j.transaction_date BETWEEN ? AND ?
      GROUP BY grp ORDER BY cents DESC`,
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

/** Suspense backlog: what is waiting for a rule or a decision. */
export function suspenseQueue(db: DatabaseSync, limit = 50): UncategorisedRow[] {
  const rows = db.prepare(
    `SELECT j.external_id AS externalId, j.transaction_date AS transactionDate, j.description,
            e.amount_cents AS cents, e.account
       FROM journal_entries e JOIN journal_transactions j ON j.id = e.journal_transaction_id
      WHERE e.account = 'Expenses:Uncategorized:Suspense' AND e.side = 'debit'
      ORDER BY j.transaction_date DESC LIMIT ?`,
  ).all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    externalId: String(r.externalId),
    transactionDate: String(r.transactionDate),
    description: String(r.description),
    cents: Number(r.cents),
    account: String(r.account),
  }));
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
