import type { DatabaseSync } from 'node:sqlite';
import { atomic, rows, execute } from './database.ts';
import { fromAkahuPayload, type RawTransaction } from './rawTransaction.ts';
import { markSkipped, postJournal, recordTransferPair, transferJournal, journalExists } from './import.ts';
import { accountMappingFor, type RoutingConfig } from './routing.ts';

/**
 * Transfer pairing: one movement between his own accounts, two feeds.
 *
 * A transfer from BNZ Operating to Sharesies Spend appears as an outflow on
 * one account and an inflow on the other. Routed independently — which is what
 * the dashboard did — the books either cancel the movement to nothing or book
 * a transfer as spending. Neither is acceptable, so a matched pair posts ONE
 * balanced journal (debit destination, credit source) and consumes both raw
 * rows.
 *
 * Matching is deliberately strict, because a false pair silently corrupts two
 * balances at once:
 *   - opposite signs, exactly equal absolute amount, one asset/liability each
 *     side, both legs mapped (never a guess at `Assets:Unmapped:*`)
 *   - on different bank connections, or the same connection with different
 *     formatted account numbers (a BNZ internal transfer between two BNZ
 *     accounts is still a transfer)
 *   - within `windowDays` (default 3): the legs settle on different days
 *   - neither leg already paired or already posted with a different journal
 */

export interface TransferCandidate {
  hash: string;
  akahuAccountId: string;
  ledgerAccount: string;
  connectionId: string | null;
  /** A feed exists somewhere under this authorisation, so absence of a
   *  transaction is evidence rather than silence. */
  connectionHasFeed: boolean;
  formattedAccount: string | null;
  transactionDate: string;
  amountCents: number;
  description: string;
}

export interface ProposedPair {
  from: TransferCandidate;
  to: TransferCandidate;
  amountCents: number;
  transferDate: string;
  dayGap: number;
}

export interface PairOptions {
  windowDays?: number;
  /** Restrict pairing to transactions on or after this date. */
  since?: string;
}

export interface PairResult {
  pairs: ProposedPair[];
  unpaired: TransferCandidate[];
}

interface MappingMeta {
  ledger_account: string;
  account_type: 'asset' | 'liability';
  has_feed: number;
  connection_id: string | null;
  connection_has_feed: number;
  formatted_account: string | null;
}

interface CandidateRow {
  hash: string;
  date: string;
  raw: string;
}

/**
 * Build candidates from raw transactions that are not yet posted and not yet
 * skipped for any other reason.
 */
export function candidates(db: DatabaseSync, options: PairOptions = {}): TransferCandidate[] {
  const mappings = new Map<string, MappingMeta>(
    rows<{ akahu_account_id: string; ledger_account: string; account_type: 'asset' | 'liability'; has_feed: number; connection_id: string | null; connection_has_feed: number; formatted_account: string | null }>(
      db,
      'SELECT akahu_account_id, ledger_account, account_type, has_feed, connection_id, connection_has_feed, formatted_account FROM account_mappings',
    ).map((m) => [m.akahu_account_id, m]),
  );
  const since = options.since ?? '0000-01-01';
  const posted = rows<CandidateRow>(
    db,
    `SELECT r.idempotency_hash AS hash, r.transaction_date AS date, r.raw_json AS raw
       FROM raw_transactions r
      WHERE r.processed_at IS NOT NULL AND r.skipped_reason IS NULL
        AND NOT EXISTS (SELECT 1 FROM transfer_pairs p WHERE p.from_hash = r.idempotency_hash OR p.to_hash = r.idempotency_hash)`,
  );
  const out: TransferCandidate[] = [];
  for (const row of posted) {
    const raw = JSON.parse(row.raw) as Record<string, unknown>;
    const transaction: RawTransaction = fromAkahuPayload(raw);
    const meta = mappings.get(transaction.accountId);
    if (!meta) continue;
    if (transaction.transactionDate < since) continue;
    // Connection identity: Akahu's per-account connection object is not stored
    // on the mapping; two accounts on the same institution share `institution`.
    out.push({
      hash: transaction.idempotencyHash,
      akahuAccountId: transaction.accountId,
      ledgerAccount: meta.ledger_account,
      connectionId: meta.connection_id,
      connectionHasFeed: Boolean(meta.connection_has_feed),
      formattedAccount: meta.formatted_account,
      transactionDate: transaction.transactionDate,
      amountCents: transaction.amountCents,
      description: transaction.description,
    });
  }
  return out;
}

export function sameFixture(a: TransferCandidate, b: TransferCandidate): boolean {
  if (a.akahuAccountId === b.akahuAccountId) return false;
  const sameAuthorisation = Boolean(a.connectionId && b.connectionId && a.connectionId === b.connectionId);
  if (!sameAuthorisation) return true;
  // Same authorisation at the same institution. Two transfers matter here:
  // an internal transfer between two bank accounts, and a move inside an
  // investment provider. The second is only verifiable when that
  // authorisation exposes a feed at all — otherwise neither side would show a
  // transaction and equal amounts prove nothing.
  if (!a.connectionHasFeed && !b.connectionHasFeed) return false;
  if (!a.formattedAccount || !b.formattedAccount) return false;
  return a.formattedAccount !== b.formattedAccount;
}

/**
 * Propose transfer pairs for a candidate set. Pure: no database writes, so a
 * dry run is trivially safe and the UI/CLI prints exactly what would post.
 *
 * Greedy nearest-date matching: sort by absolute amount, then date, and pair
 * the closest unmatched counterpart inside the window. Amounts must match
 * exactly — FX and fee-adjusted transfers are left unpaired rather than
 * fuzzily booked.
 */
export function proposePairs(candidates: ReadonlyArray<TransferCandidate>, windowDays = 3): PairResult {
  const used = new Set<string>();
  const pairs: ProposedPair[] = [];
  const ordered = [...candidates].sort(
    (a, b) => Math.abs(b.amountCents) - Math.abs(a.amountCents) || (a.transactionDate < b.transactionDate ? -1 : 1),
  );

  for (const source of ordered) {
    if (used.has(source.hash) || source.amountCents >= 0) continue;
    let best: { candidate: TransferCandidate; gap: number } | null = null;
    for (const target of ordered) {
      if (used.has(target.hash) || target.hash === source.hash) continue;
      if (target.amountCents !== -source.amountCents) continue;
      if (!sameFixture(source, target)) continue;
      const gap = Math.abs(Date.parse(target.transactionDate) - Date.parse(source.transactionDate)) / 86_400_000;
      if (!Number.isFinite(gap) || gap > windowDays) continue;
      if (!best || gap < best.gap) best = { candidate: target, gap };
    }
    if (!best) continue;
    used.add(source.hash);
    used.add(best.candidate.hash);
    pairs.push({
      from: source,
      to: best.candidate,
      amountCents: Math.abs(source.amountCents),
      transferDate: source.transactionDate,
      dayGap: Math.round(best.gap * 10) / 10,
    });
  }

  const unpaired = ordered.filter((c) => !used.has(c.hash)).sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1));
  return { pairs, unpaired };
}

export interface ApplyPairResult {
  applied: number;
  errors: string[];
}

/**
 * Post the proposed pairs.
 *
 * Import already posted each leg independently, because at import time the
 * account is known and the counterpart is not. Pairing therefore corrects the
 * books rather than mutating history: the lone leg's journal is removed and one
 * balanced transfer journal replaces both, inside a single transaction. A leg
 * whose routing was set by hand (`rule_id = 'manual:override'`) is never
 * removed, so a deliberate decision is not undone by a later match.
 *
 * Idempotent: a pair that already has its journal and row is skipped, and both
 * raw hashes are marked `transfer_counterpart` so they cannot post again.
 */
export function applyPairs(
  db: DatabaseSync,
  config: RoutingConfig,
  pairs: ReadonlyArray<ProposedPair>,
): ApplyPairResult {
  const result: ApplyPairResult = { applied: 0, errors: [] };
  for (const pair of pairs) {
    try {
      atomic(db, () => {
        removeSingleLeg(db, pair.from.hash);
        removeSingleLeg(db, pair.to.hash);
        const legFor = (c: TransferCandidate) => ({
          transaction: legTransaction(db, c),
          mapping: accountMappingFor(config, c.akahuAccountId),
        });
        const journal = transferJournal(legFor(pair.from), legFor(pair.to), `${pair.from.hash.slice(0, 12)}-${pair.to.hash.slice(0, 12)}`);
        if (journalExists(db, journal.externalId)) return;
        postJournal(db, journal);
        recordTransferPair(db, {
          fromAkahuAccountId: pair.from.akahuAccountId,
          toAkahuAccountId: pair.to.akahuAccountId,
          amountCents: pair.amountCents,
          transferDate: pair.transferDate,
          fromHash: pair.from.hash,
          toHash: pair.to.hash,
          journalId: journal.externalId,
        });
        markSkipped(db, pair.from.hash, 'transfer_counterpart');
        markSkipped(db, pair.to.hash, 'transfer_counterpart');
        result.applied += 1;
      });
    } catch (error) {
      result.errors.push(`${pair.from.description}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}

/** Delete the auto-posted single-leg journal for a hash, if it is still a lone leg. */
function removeSingleLeg(db: DatabaseSync, hash: string): void {
  const paired = rows(db, 'SELECT 1 FROM transfer_pairs WHERE from_hash = ? OR to_hash = ?', hash, hash).length > 0;
  if (paired) return;
  const journal = rows<{ rule_id: string | null }>(db, 'SELECT rule_id FROM journal_transactions WHERE external_id = ?', hash)[0];
  // A hand-set route is a decision; never silently replace it with a pair.
  if (journal && journal.rule_id === 'manual:override') {
    throw new Error(`refusing to pair ${hash.slice(0, 12)}: its category was set by hand`);
  }
  execute(db, 'DELETE FROM journal_entries WHERE journal_transaction_id = ?', hash);
  execute(db, 'DELETE FROM journal_transactions WHERE external_id = ?', hash);
  execute(db, 'UPDATE raw_transactions SET processed_at = NULL WHERE idempotency_hash = ?', hash);
}

function legTransaction(db: DatabaseSync, candidate: TransferCandidate): RawTransaction {
  const row = rows<{ raw_json: string }>(db, 'SELECT raw_json FROM raw_transactions WHERE idempotency_hash = ?', candidate.hash)[0];
  if (!row) throw new Error(`raw transaction ${candidate.hash.slice(0, 12)} is missing`);
  return fromAkahuPayload(JSON.parse(row.raw_json) as Record<string, unknown>);
}
