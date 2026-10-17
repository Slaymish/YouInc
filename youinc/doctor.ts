import type { DatabaseSync } from 'node:sqlite';
import { execute, one, rows } from './database.ts';
import { reconcile, type AccountReconciliation, type Gap } from './balances.ts';
import { unbalancedJournals } from './journal-store.ts';

/**
 * `doctor`: the checks that decide whether the ledger can be trusted.
 *
 * A reconciliation gap is a fact about the bank feed; an unbalanced journal is
 * a bug in this program. They are reported separately on purpose — mixing them
 * is how a real defect gets dismissed as "the bank's timing".
 */

export interface DoctorReport {
  ok: boolean;
  schemaVersion: number;
  ledgerPath: string;
  accounts: AccountReconciliation[];
  unbalancedJournals: Array<{ externalId: string; debit: number; credit: number }>;
  duplicateJournals: number;
  unmappedAccounts: string[];
  missingAnchors: string[];
  suspenseCount: number;
  lastSync: Array<{ account: string; status: string; finishedAt: string | null }>;
  problems: string[];
}

export function doctor(db: DatabaseSync, ledgerPath: string, now = new Date()): DoctorReport {
  const problems: string[] = [];
  const schemaVersion = Number((one<{ user_version: number }>(db, 'PRAGMA user_version') as { user_version: number }).user_version);
  const accounts = reconcile(db, { now });
  const unbalanced = unbalancedJournals(db);

  const duplicateJournals = Number(
    one<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM (
         SELECT external_id FROM journal_transactions GROUP BY external_id HAVING COUNT(*) > 1
       )`,
    )?.n ?? 0,
  );

  const unmappedAccounts = rows<{ account: string }>(
    db,
    `SELECT DISTINCT e.account FROM journal_entries e WHERE e.account LIKE 'Assets:Unmapped:%'`,
  ).map((r) => r.account);

  const missingAnchors = accounts.filter((a) => a.hasFeed && a.ledgerCents === null).map((a) => a.akahuAccountId);

  const suspenseCount = Number(
    one<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM journal_entries
        WHERE account = 'Expenses:Uncategorized:Suspense' AND side = 'debit'`,
    )?.n ?? 0,
  );

  const lastSync = rows<{ account: string; status: string; finishedAt: string | null }>(
    db,
    `SELECT akahu_account_id AS account, status, finished_at AS finishedAt
       FROM akahu_sync_log ORDER BY started_at DESC LIMIT 20`,
  );

  if (unbalanced.length) problems.push(`${unbalanced.length} journal(s) do not balance — a defect in this program, not the bank.`);
  if (duplicateJournals) problems.push(`${duplicateJournals} duplicate external_id group(s).`);
  if (unmappedAccounts.length) problems.push(`${unmappedAccounts.length} unmapped account(s) posting to Assets:Unmapped.`);
  if (missingAnchors.length) problems.push(`${missingAnchors.length} feed account(s) have no balance anchor.`);
  for (const account of accounts) {
    for (const gap of account.gap) {
      if (gap.class === 'unknown') problems.push(`${account.ledgerAccount}: unexplained ${formatGap(gap)} (balance still taken from the bank).`);
    }
  }

  return {
    ok: unbalanced.length === 0 && duplicateJournals === 0,
    schemaVersion,
    ledgerPath,
    accounts,
    unbalancedJournals: unbalanced,
    duplicateJournals,
    unmappedAccounts,
    missingAnchors,
    suspenseCount,
    lastSync,
    problems,
  };
}

export function formatGap(gap: Gap): string {
  const sign = gap.cents > 0 ? '+' : '';
  return `${sign}${gap.cents} cents — ${gap.explanation}`;
}

/** Record the outcome of one account sync attempt. */
export function logSync(
  db: DatabaseSync,
  entry: {
    id: string;
    account: string;
    startedAt: string;
    fromDate?: string | null;
    toDate?: string | null;
  },
): void {
  execute(
    db,
    `INSERT INTO akahu_sync_log (id, akahu_account_id, started_at, from_date, to_date, status)
     VALUES (?,?,?,?,?,'running')`,
    entry.id, entry.account, entry.startedAt, entry.fromDate ?? null, entry.toDate ?? null,
  );
}

export function finishSync(
  db: DatabaseSync,
  id: string,
  status: 'success' | 'error',
  ingested: number | null,
  errorMessage?: string,
): void {
  execute(
    db,
    `UPDATE akahu_sync_log SET status = ?, finished_at = ?, transactions_ingested = ?, error_message = ?
      WHERE id = ?`,
    status, new Date().toISOString(), ingested, errorMessage ?? null, id,
  );
}
