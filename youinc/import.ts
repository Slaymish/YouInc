import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { atomic, rows, execute } from './database.ts';
import type { RawTransaction } from './rawTransaction.ts';
import type { JournalTransaction, Posting } from './journal.ts';
import { posting, validateBalanced } from './journal.ts';
import { accountMappingFor, buildJournal, type RoutingConfig } from './routing.ts';
import { insertJournal } from './journal-store.ts';
import { recordAndAnchor, type ParsedAkahuAccount } from './balances.ts';

/**
 * Import: Akahu transactions → balanced journals, idempotent on the raw hash.
 *
 * Every payload is stored in raw_transactions first (the dedup ledger), then
 * posted. Pending transactions are stored but not posted; a later settled
 * version has a different hash, so it posts then and the pending row stays as
 * history rather than being overwritten.
 */

export type SkipReason = 'pending' | 'zero_amount' | 'transfer_counterpart' | 'duplicate';

export interface ImportResult {
  seen: number;
  rawInserted: number;
  posted: number;
  skipped: Record<SkipReason, number>;
  transfers: number;
  errors: string[];
}

export function consumeRaw(db: DatabaseSync, hash: string): void {
  execute(db, 'UPDATE raw_transactions SET processed_at = ?, skipped_reason = NULL WHERE idempotency_hash = ?', new Date().toISOString(), hash);
}

export function markSkipped(db: DatabaseSync, hash: string, reason: SkipReason | string): void {
  execute(db, 'UPDATE raw_transactions SET skipped_reason = ? WHERE idempotency_hash = ?', reason, hash);
}

export function journalExists(db: DatabaseSync, hash: string): boolean {
  return rows(db, 'SELECT 1 FROM journal_transactions WHERE external_id = ?', hash).length > 0;
}

export function insertRaw(db: DatabaseSync, transaction: RawTransaction): boolean {
  const result = execute(
    db,
    `INSERT INTO raw_transactions (idempotency_hash, transaction_date, raw_json, processed_at, skipped_reason)
     VALUES (?,?,?,NULL,NULL) ON CONFLICT(idempotency_hash) DO NOTHING`,
    transaction.idempotencyHash, transaction.transactionDate, transaction.rawJson,
  );
  return Boolean(result.changes);
}

/** Store a journal and mark its raw row consumed, in one transaction. */
export function postJournal(db: DatabaseSync, journal: JournalTransaction): boolean {
  return atomic(db, () => {
    const inserted = insertJournal(db, journal);
    if (inserted) consumeRaw(db, journal.externalId);
    return inserted;
  });
}

export interface TransferLeg {
  transaction: RawTransaction;
  mapping: { ledgerAccount: string; accountType: 'asset' | 'liability' };
}

/**
 * Journal for a matched transfer between two of his own accounts.
 *
 * Debit the receiving account, credit the sending one — the only postings
 * that leave both balances correct and spend reports clean. Both raw hashes
 * are consumed by the same journal so neither leg can post again.
 */
export function transferJournal(from: TransferLeg, to: TransferLeg, pairId: string): JournalTransaction {
  const amountCents = Math.abs(from.transaction.amountCents);
  const postings: Posting[] = [
    posting(to.mapping.ledgerAccount, 'debit', amountCents),
    posting(from.mapping.ledgerAccount, 'credit', amountCents),
  ];
  const journal: JournalTransaction = {
    externalId: `transfer:${pairId}`,
    transactionDate: (from.transaction.settlementDate ?? from.transaction.transactionDate).slice(0, 10),
    description: `Transfer: ${from.transaction.description}`,
    sourceAccountId: from.transaction.accountId,
    status: 'SETTLED',
    ruleId: 'transfer:pair',
    postings,
  };
  validateBalanced(journal);
  return journal;
}

export function recordTransferPair(
  db: DatabaseSync,
  pair: {
    fromAkahuAccountId: string;
    toAkahuAccountId: string;
    amountCents: number;
    transferDate: string;
    fromHash: string;
    toHash: string;
    journalId: string;
  },
): string {
  const id = randomUUID();
  execute(
    db,
    `INSERT INTO transfer_pairs
       (id, from_akahu_account_id, to_akahu_account_id, amount_cents, transfer_date, from_hash, to_hash, journal_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, pair.fromAkahuAccountId, pair.toAkahuAccountId, pair.amountCents, pair.transferDate,
    pair.fromHash, pair.toHash, pair.journalId, new Date().toISOString(),
  );
  return id;
}

export interface ImportOptions {
  /** True discards pending transactions (the dashboard's behaviour). */
  discardPending?: boolean;
  /** Manual per-hash overrides of target account: exit ramp for one-off fixes. */
  overrides?: Map<string, { targetAccount: string; memo?: string | null }>;
}

/**
 * Import transactions and anchor a freshly reported balance.
 *
 * Order matters: anchor BEFORE posting so both the stated balance and its
 * `refreshed.balance` timestamp reflect the moment before these postings.
 * Posting first would put the new transactions on both sides of the anchor and
 * double-count them.
 *
 * An account with no prior anchor (first ever sync) is anchored at the
 * reported figure with `reason = 'reported'`: history before today was never
 * captured, and pretending otherwise is what made the dashboard drift.
 */
export function importAccount(
  db: DatabaseSync,
  config: RoutingConfig,
  account: ParsedAkahuAccount,
  payloads: ReadonlyArray<Record<string, unknown>>,
  options: ImportOptions = {},
): ImportResult {
  const discardPending = options.discardPending ?? true;
  const result: ImportResult = { seen: 0, rawInserted: 0, posted: 0, skipped: { pending: 0, zero_amount: 0, transfer_counterpart: 0, duplicate: 0 }, transfers: 0, errors: [] };

  atomic(db, () => {
    if (account.balanceCents !== null) {
      recordAndAnchor(db, {
        akahuAccountId: account.akahuAccountId,
        balanceCents: account.balanceCents,
        availableCents: account.availableCents,
        creditLimitCents: account.creditLimitCents,
        currency: account.currency,
        overdrawn: account.overdrawn,
        akahuRefreshedAt: account.akahuRefreshedAt,
        source: 'akahu',
      });
    }
    for (const payload of payloads) {
      result.seen += 1;
      try {
        const transaction = fromPayload(payload);
        if (insertRaw(db, transaction)) result.rawInserted += 1;
        if (transaction.isPending && discardPending) { markSkipped(db, transaction.idempotencyHash, 'pending'); result.skipped.pending += 1; continue; }
        if (transaction.amountCents === 0) { markSkipped(db, transaction.idempotencyHash, 'zero_amount'); result.skipped.zero_amount += 1; continue; }
        if (journalExists(db, transaction.idempotencyHash)) { result.skipped.duplicate += 1; continue; }
        const journal = buildJournal(config, transaction, options.overrides?.get(transaction.idempotencyHash) ?? null);
        if (postJournal(db, journal)) result.posted += 1;
        else result.skipped.duplicate += 1;
      } catch (error) {
        result.errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  });
  return result;
}

// Kept separate so importAccount reads linearly.
import { fromAkahuPayload } from './rawTransaction.ts';
function fromPayload(payload: Record<string, unknown>): RawTransaction {
  return fromAkahuPayload(payload);
}

export { accountMappingFor };
