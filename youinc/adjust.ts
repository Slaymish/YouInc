import type { DatabaseSync } from 'node:sqlite';
import { execute, one, rows } from './database.ts';
import { insertJournal } from './journal-store.ts';
import { journalExists, postJournal } from './import.ts';
import { posting, type JournalTransaction } from './journal.ts';
import { getBasis } from './balances.ts';

/**
 * Reclassify a posted transaction without rewriting history.
 *
 * Double-entry correction, same as the dashboard's `reclassify.ts`: the
 * original journal stays exactly as posted, and a second balanced journal
 * moves the amount from the old target account to the new one. That way the
 * audit trail is complete and a correction can itself be corrected.
 */

export interface ReclassifyResult {
  correctionId: string;
  fromAccount: string;
  toAccount: string;
  amountCents: number;
}

export function reclassify(db: DatabaseSync, externalId: string, targetAccount: string): ReclassifyResult {
  const journal = one<{
    id: string;
    transaction_date: string;
    description: string;
    source_account_id: string;
  }>(db, 'SELECT id, transaction_date, description, source_account_id FROM journal_transactions WHERE external_id = ?', externalId);
  if (!journal) throw new Error(`No transaction with external id ${externalId}`);

  const entries = rows<{ account: string; side: string; amount_cents: number; currency: string }>(
    db,
    'SELECT account, side, amount_cents, currency FROM journal_entries WHERE journal_transaction_id = ? ORDER BY id',
    journal.id,
  );
  // The leg that is not a source asset/liability account is the classification.
  const mapping = one<{ ledger_account: string }>(
    db,
    'SELECT ledger_account FROM account_mappings WHERE akahu_account_id = ?',
    journal.source_account_id,
  );
  const current = entries.find((e) => e.account !== mapping?.ledger_account);
  if (!current) throw new Error('Could not identify the classified leg of this transaction');
  if (current.account === targetAccount) throw new Error(`Transaction is already classified as ${targetAccount}`);

  const amountCents = current.amount_cents;
  // Post the correction in the direction the original was booked.
  const originalWasCredit = current.side === 'credit';
  const postings = originalWasCredit
    ? [posting(current.account, 'debit', amountCents), posting(targetAccount, 'credit', amountCents)]
    : [posting(targetAccount, 'debit', amountCents), posting(current.account, 'credit', amountCents)];

  const correction: JournalTransaction = {
    externalId: `reclassify:${externalId}:${targetAccount}:${amountCents}`,
    transactionDate: journal.transaction_date,
    description: `Reclassify: ${journal.description}`,
    sourceAccountId: journal.source_account_id,
    status: 'CORRECTION',
    ruleId: 'manual:reclassify',
    postings,
  };

  if (!journalExists(db, correction.externalId)) postJournal(db, correction);
  return { correctionId: correction.externalId, fromAccount: current.account, toAccount: targetAccount, amountCents };
}

/**
 * Set a balance by hand (an account with no feed, or a correction the bank
 * cannot state). The statement is appended and becomes the anchor, so it wins
 * over postings exactly as a reported balance does — deliberately, and visibly.
 */
export function setManualBalance(
  db: DatabaseSync,
  akahuAccountId: string,
  balanceCents: number,
  asOf: string,
): void {
  const mapping = one<{ ledger_account: string }>(db, 'SELECT ledger_account FROM account_mappings WHERE akahu_account_id = ?', akahuAccountId);
  if (!mapping) throw new Error(`No mapped account ${akahuAccountId}; run \`youinc accounts\` to see mapped ids`);
  execute(
    db,
    `INSERT INTO account_balances
       (akahu_account_id, balance_cents, available_cents, credit_limit_cents, currency, overdrawn, akahu_refreshed_at, fetched_at, source)
     VALUES (?,?,NULL,NULL,'NZD',NULL,?,?, 'manual')`,
    akahuAccountId, balanceCents, asOf, new Date().toISOString(),
  );
  const balanceId = Number(one<{ id: number }>(db, 'SELECT MAX(id) AS id FROM account_balances WHERE akahu_account_id = ?', akahuAccountId)?.id ?? 0);
  execute(
    db,
    `INSERT INTO account_basis (akahu_account_id, anchor_cents, anchored_at, anchor_balance_id, reason, updated_at)
     VALUES (?,?,?,?, 'manual', ?)
     ON CONFLICT(akahu_account_id) DO UPDATE SET
       anchor_cents = excluded.anchor_cents, anchored_at = excluded.anchored_at,
       anchor_balance_id = excluded.anchor_balance_id, reason = excluded.reason,
       updated_at = excluded.updated_at`,
    akahuAccountId, balanceCents, asOf, balanceId, new Date().toISOString(),
  );
}

export function currentBasis(db: DatabaseSync, akahuAccountId: string) {
  return getBasis(db, akahuAccountId);
}

export { insertJournal };
