import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { migrate } from './schema.ts';

/** One ledger file per installation. Default `~/.youinc/ledger.sqlite3`. */
export function ledgerPath(override?: string): string {
  const configured = override ?? process.env.YOUINC_DB_PATH;
  return resolve(configured && configured.trim() ? configured : resolve(homedir(), '.youinc', 'ledger.sqlite3'));
}

export interface Ledger {
  db: DatabaseSync;
  path: string;
  close(): void;
}

const POOL = new Map<string, Ledger>();

/**
 * Open (creating and migrating if absent) the ledger. Cached per path so a
 * long-lived CLI process reuses one connection, matching how the dashboard's
 * database.ts behaved.
 */
export function openLedger(path?: string): Ledger {
  const target = ledgerPath(path);
  const cached = POOL.get(target);
  if (cached) return cached;
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(target);
  chmodSync(target, 0o600);
  // WAL lets a read-only observer (me, via sqlite3) read while a sync writes.
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  migrate(db);
  const ledger: Ledger = {
    db,
    path: target,
    close() { POOL.delete(target); db.close(); },
  };
  POOL.set(target, ledger);
  return ledger;
}

export function rows<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function one<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function execute(db: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

/**
 * Run `work` inside one write transaction. Synchronous only: node:sqlite is
 * synchronous, so no other statement can interleave. Rolls back on throw so a
 * half-applied sync can never leave the ledger inconsistent.
 */
export function atomic<T>(db: DatabaseSync, work: () => T): T {
  db.exec('SAVEPOINT youinc_write');
  try {
    const result = work();
    db.exec('RELEASE youinc_write');
    return result;
  } catch (error) {
    db.exec('ROLLBACK TO youinc_write; RELEASE youinc_write');
    throw error;
  }
}

export function setting(db: DatabaseSync, key: string): string {
  return one<{ value: string }>(db, 'SELECT value FROM settings WHERE key = ?', key)?.value ?? '';
}

export function setSetting(db: DatabaseSync, key: string, value: string): void {
  execute(db, 'INSERT INTO settings VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
