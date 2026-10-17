import type { DatabaseSync } from 'node:sqlite';
import { atomic, execute, rows } from './database.ts';
import { fromAkahuPayload } from './rawTransaction.ts';
import { buildJournal, type RoutingConfig } from './routing.ts';
import { markSkipped, postJournal } from './import.ts';
import { applyPairs, candidates, proposePairs, type PairResult } from './transfers.ts';

/**
 * Repost: rebuild every derived journal from the stored raw transactions.
 *
 * Why this exists. Classification lives in `classification_rules`, and the
 * target account of every posting was decided when it was imported. Adding or
 * changing a rule therefore does nothing until the postings are built again.
 * Reposting is the honest way to apply a rule set: same raw evidence, current
 * rules, one fresh derivation — rather than patching account strings in place,
 * which would leave no record of what the books said before.
 *
 * What is preserved, because it is a decision and not a derivation:
 *   - journals with a `manual:*` rule id (a hand-set route, a reclassification)
 *   - the raw rows those journals consumed, which stay marked as processed
 *   - every statement in `account_balances` and every anchor in `account_basis`
 *
 * What is rebuilt: auto-routed journals, transfer pairs, and the skipped/
 * processed marks on the raw rows they came from. Anchors are *not* re-taken,
 * so balances keep agreeing: postings dated before an anchor never enter the
 * ledger figure anyway (see balances.ts).
 *
 * Idempotent by construction: it deletes the derived set and derives it again.
 */

export interface RepostResult {
  kept: number;
  cleared: number;
  posted: number;
  pairs: PairResult;
  appliedPairs: number;
  pairErrors: string[];
  skipped: { pending: number; zero_amount: number; errors: number };
}

export function repost(db: DatabaseSync, config: RoutingConfig, options: { dryRun?: boolean } = {}): RepostResult {
  const keepSql = "rule_id LIKE 'manual:%'";
  const kept = rows<{ n: number }>(db, `SELECT COUNT(*) AS n FROM journal_transactions WHERE ${keepSql}`)[0]?.n ?? 0;
  const cleared = rows<{ n: number }>(db, `SELECT COUNT(*) AS n FROM journal_transactions WHERE NOT (${keepSql})`)[0]?.n ?? 0;

  const result: RepostResult = {
    kept,
    cleared,
    posted: 0,
    pairs: { pairs: [], unpaired: [] },
    appliedPairs: 0,
    pairErrors: [],
    skipped: { pending: 0, zero_amount: 0, errors: 0 },
  };

  if (options.dryRun) {
    // Report what would happen without touching a row.
    const fresh = rows<{ raw_json: string }>(
      db,
      `SELECT r.raw_json FROM raw_transactions r
        WHERE r.idempotency_hash NOT IN (SELECT external_id FROM journal_transactions WHERE ${keepSql})`,
    );
    result.posted = fresh.length;
    result.pairs = proposePairs(candidates(db), 3);
    return result;
  }

  atomic(db, () => {
    // transfer_pairs references journal_transactions, so it goes first.
    execute(db, 'DELETE FROM transfer_pairs');
    execute(db, `DELETE FROM journal_entries WHERE journal_transaction_id NOT IN (SELECT id FROM journal_transactions WHERE ${keepSql})`);
    // COALESCE: `NULL NOT LIKE 'manual:%'` is NULL, which would silently keep
    // every auto-routed journal (rule_id is NULL when no rule matched).
    execute(db, `DELETE FROM journal_transactions WHERE NOT (COALESCE(rule_id,'') LIKE 'manual:%')`);
    execute(
      db,
      `UPDATE raw_transactions SET processed_at = NULL, skipped_reason = NULL
        WHERE idempotency_hash NOT IN (SELECT external_id FROM journal_transactions)`,
    );
  });

  const pending = rows<{ idempotency_hash: string; raw_json: string }>(
    db,
    'SELECT idempotency_hash, raw_json FROM raw_transactions WHERE processed_at IS NULL ORDER BY transaction_date, idempotency_hash',
  );

  for (const row of pending) {
    try {
      const transaction = fromAkahuPayload(JSON.parse(row.raw_json) as Record<string, unknown>);
      if (transaction.isPending) { markSkipped(db, transaction.idempotencyHash, 'pending'); result.skipped.pending += 1; continue; }
      if (transaction.amountCents === 0) { markSkipped(db, transaction.idempotencyHash, 'zero_amount'); result.skipped.zero_amount += 1; continue; }
      if (postJournal(db, buildJournal(config, transaction))) result.posted += 1;
    } catch (error) {
      result.skipped.errors += 1;
      if (result.pairErrors.length < 5) {
        result.pairErrors.push(`${row.idempotency_hash.slice(0, 12)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Pairing runs over the whole re-derived set, exactly as sync does.
  const proposed = proposePairs(candidates(db), 3);
  const applied = applyPairs(db, config, proposed.pairs);
  result.appliedPairs = applied.applied;
  result.pairErrors.push(...applied.errors);
  result.pairs = proposePairs(candidates(db), 3);
  return result;
}
