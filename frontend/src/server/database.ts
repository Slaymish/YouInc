// One database per installation. No network service, users, or workspace tables.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { validateBalanced, type JournalTransaction } from './ledger-engine/journal';

export function databasePath(): string {
  return resolve(process.env.YOUINC_DB_PATH || resolve(homedir(), '.youinc', 'ledger.sqlite3'));
}
let connection: DatabaseSync | undefined;
let openedPath: string | undefined;
export function closeDatabase(): void {
  connection?.close(); connection = undefined; openedPath = undefined;
}
export function getDatabase(): DatabaseSync {
  if (process.env.YOUINC_DEMO === '1') throw new Error('Personal data is unavailable in demo mode.');
  const path = databasePath();
  if (connection && openedPath === path) return connection;
  closeDatabase();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const version = Number((db.prepare('PRAGMA user_version').get() as {user_version: number}).user_version);
  if (version > 1) { db.close(); throw new Error('This database needs a newer version of YouInc.'); }
  if (version === 0) {
    try {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
        INSERT INTO settings VALUES ('name','My money'), ('currency','NZD'), ('suspense','Expenses:Uncategorized:Suspense');
        CREATE TABLE manual_account_balances (
          account TEXT PRIMARY KEY, balance_cents INTEGER NOT NULL,
          as_of_date TEXT NOT NULL, updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE journal_transactions (
          id TEXT PRIMARY KEY, external_id TEXT NOT NULL UNIQUE,
          transaction_date TEXT NOT NULL, description TEXT NOT NULL,
          source_account_id TEXT NOT NULL, status TEXT NOT NULL, rule_id TEXT
        ) STRICT;
        CREATE TABLE journal_entries (
          id INTEGER PRIMARY KEY, journal_transaction_id TEXT NOT NULL REFERENCES journal_transactions(id),
          account TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('debit','credit')),
          amount_cents INTEGER NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 9007199254740991), currency TEXT NOT NULL
        ) STRICT;
        CREATE INDEX journal_entries_parent ON journal_entries(journal_transaction_id);
        CREATE TABLE raw_transactions (
          idempotency_hash TEXT PRIMARY KEY, transaction_date TEXT NOT NULL,
          raw_json TEXT NOT NULL, processed_at TEXT, skipped_reason TEXT
        ) STRICT;
        CREATE TABLE classification_rules (
          id TEXT PRIMARY KEY, rule_key TEXT NOT NULL UNIQUE, seq INTEGER NOT NULL UNIQUE,
          priority INTEGER NOT NULL, is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0,1)),
          match_description_regex TEXT, match_merchant_regex TEXT,
          match_amount_greater_than REAL, match_amount_abs_greater_than REAL,
          route_target_account TEXT NOT NULL, route_memo TEXT
        ) STRICT;
        CREATE TABLE account_mappings (
          id TEXT PRIMARY KEY, akahu_account_id TEXT NOT NULL UNIQUE, ledger_account TEXT NOT NULL,
          account_type TEXT NOT NULL CHECK(account_type IN ('asset','liability')),
          credit_limit_cents INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE akahu_sync_log (
          id TEXT PRIMARY KEY, akahu_account_id TEXT NOT NULL, started_at TEXT NOT NULL,
          finished_at TEXT, from_date TEXT, to_date TEXT, transactions_ingested INTEGER,
          status TEXT NOT NULL, error_message TEXT
        ) STRICT;
        PRAGMA user_version = 1;
        COMMIT;`);
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  connection = db; openedPath = path;
  return db;
}
export function rows<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return getDatabase().prepare(sql).all(...params) as T[];
}
export function execute(sql: string, ...params: SQLInputValue[]) {
  return getDatabase().prepare(sql).run(...params);
}
// Synchronous callbacks only: no request can interleave inside a transaction.
export function atomic<T>(work: () => T): T {
  const db = getDatabase();
  db.exec('SAVEPOINT ledger_write');
  try { const result = work(); db.exec('RELEASE ledger_write'); return result; }
  catch (error) { db.exec('ROLLBACK TO ledger_write; RELEASE ledger_write'); throw error; }
}
export function setting(key: string): string {
  return rows<{value: string}>('SELECT value FROM settings WHERE key = ?', key)[0]?.value ?? '';
}
export function setSetting(key: string, value: string): void {
  execute('INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
export function insertJournal(journal: JournalTransaction): boolean {
  validateBalanced(journal);
  for (const p of journal.postings) {
    if (!Number.isSafeInteger(p.amountCents) || p.amountCents <= 0 || !['debit','credit'].includes(p.side)) {
      throw new Error('Postings must contain positive whole cents and a valid side.');
    }
  }
  if (new Set(journal.postings.map(p => p.currency)).size !== 1) throw new Error('A journal must use one currency.');
  return atomic(() => {
    if (rows('SELECT id FROM journal_transactions WHERE external_id = ?', journal.externalId).length) return false;
    const id = randomUUID();
    execute('INSERT INTO journal_transactions VALUES (?,?,?,?,?,?,?)', id, journal.externalId, journal.transactionDate,
      journal.description, journal.sourceAccountId, journal.status, journal.ruleId);
    for (const p of journal.postings) execute(
      'INSERT INTO journal_entries (journal_transaction_id,account,side,amount_cents,currency) VALUES (?,?,?,?,?)',
      id, p.account, p.side, p.amountCents, p.currency);
    return true;
  });
}
// Internal column names only; values always use bound parameters.
export function writeRecord(table: 'classification_rules' | 'account_mappings', fields: Record<string, string | number | boolean | null>, id?: string): void {
  const keys = Object.keys(fields);
  if (!keys.every(k => /^[a-z_]+$/.test(k))) throw new Error('Invalid column');
  const values = Object.values(fields).map(v => typeof v === 'boolean' ? Number(v) : v);
  if (id) {
    const result = execute(`UPDATE ${table} SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, ...values, id);
    if (!result.changes) throw new Error('That item no longer exists.');
  } else {
    execute(`INSERT INTO ${table} (id,${keys.join(',')}) VALUES (?,${keys.map(() => '?').join(',')})`, randomUUID(), ...values);
  }
}
