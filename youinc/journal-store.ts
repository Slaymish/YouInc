import type { DatabaseSync } from 'node:sqlite';
import { atomic, execute, one, rows } from './database.ts';
import { validateBalanced, type JournalTransaction } from './journal.ts';

/** Persist a balanced journal. Returns false when the external id already exists. */
export function insertJournal(db: DatabaseSync, journal: JournalTransaction): boolean {
  validateBalanced(journal);
  for (const posting of journal.postings) {
    if (!Number.isSafeInteger(posting.amountCents) || posting.amountCents <= 0) {
      throw new Error('Postings must contain positive whole cents.');
    }
    if (posting.side !== 'debit' && posting.side !== 'credit') {
      throw new Error(`Invalid posting side: ${String(posting.side)}`);
    }
  }
  if (new Set(journal.postings.map((p) => p.currency)).size !== 1) {
    throw new Error('A journal must use one currency.');
  }
  return atomic(db, () => {
    if (rows(db, 'SELECT 1 FROM journal_transactions WHERE external_id = ?', journal.externalId).length) return false;
    const id = journal.externalId;
    execute(
      db,
      `INSERT INTO journal_transactions
         (id, external_id, transaction_date, description, source_account_id, status, rule_id)
       VALUES (?,?,?,?,?,?,?)`,
      id, journal.externalId, journal.transactionDate, journal.description,
      journal.sourceAccountId, journal.status, journal.ruleId,
    );
    for (const posting of journal.postings) {
      execute(
        db,
        `INSERT INTO journal_entries (journal_transaction_id, account, side, amount_cents, currency)
         VALUES (?,?,?,?,?)`,
        id, posting.account, posting.side, posting.amountCents, posting.currency,
      );
    }
    return true;
  });
}

/** Whole-ledger invariant: every journal balances. Used by `doctor`. */
export function unbalancedJournals(db: DatabaseSync): Array<{ externalId: string; debit: number; credit: number }> {
  return rows(
    db,
    `SELECT j.external_id AS externalId,
            SUM(CASE WHEN e.side = 'debit' THEN e.amount_cents ELSE 0 END) AS debit,
            SUM(CASE WHEN e.side = 'credit' THEN e.amount_cents ELSE 0 END) AS credit
       FROM journal_transactions j JOIN journal_entries e ON e.journal_transaction_id = j.id
      GROUP BY j.id HAVING debit != credit`,
  );
}

/** Signed balance of one ledger account straight from postings, from zero.
 *  Only meaningful once history is complete; reconciliation uses anchors. */
export function accountBalanceFromZero(db: DatabaseSync, ledgerAccount: string): number {
  const row = one<{ debits: number | null; credits: number | null }>(
    db,
    `SELECT SUM(CASE WHEN side='debit' THEN amount_cents ELSE 0 END) AS debits,
            SUM(CASE WHEN side='credit' THEN amount_cents ELSE 0 END) AS credits
       FROM journal_entries WHERE account = ?`,
    ledgerAccount,
  );
  return Number(row?.debits ?? 0) - Number(row?.credits ?? 0);
}
