import type { RawTransaction } from "./rawTransaction";
import { validateBalanced, type JournalTransaction } from "./journal";
import type { LedgerStore } from "./pipeline";

/**
 * In-memory LedgerStore faithful to the SQLite semantics the golden fixtures
 * pin: raw upsert reports newly-inserted, journals dedupe on external_id and
 * preserve insertion order, manual classifications override. Used by the
 * pipeline/sync golden tests as a stand-in for LedgerDatabase; also a usable
 * dry-run/test double for the real (Supabase-backed) store.
 */

interface StoredJournal {
  seq: number;
  journal: JournalTransaction;
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly rawHashes = new Set<string>();
  private readonly journals = new Map<string, StoredJournal>();
  private readonly manual = new Map<string, [string, string | null]>();
  private nextSeq = 0;

  setManualClassification(externalId: string, targetAccount: string, memo: string | null): void {
    this.manual.set(externalId, [targetAccount, memo]);
  }

  upsertRawTransaction(transaction: RawTransaction): boolean {
    const isNew = !this.rawHashes.has(transaction.idempotencyHash);
    this.rawHashes.add(transaction.idempotencyHash);
    return isNew;
  }

  markRawSkipped(): void {
    // No-op: skipped_reason is not part of the pinned outcome.
  }

  journalExists(externalId: string): boolean {
    return this.journals.has(externalId);
  }

  insertJournalTransaction(transaction: JournalTransaction): boolean {
    validateBalanced(transaction); // Mirrors LedgerDatabase.insert_journal_transaction.
    if (this.journals.has(transaction.externalId)) return false;
    this.journals.set(transaction.externalId, { seq: this.nextSeq++, journal: transaction });
    return true;
  }

  getManualClassification(externalId: string): [string, string | null] | null {
    return this.manual.get(externalId) ?? null;
  }

  /** Journals ordered by (transaction_date, insertion seq), postings in
   *  insertion order — matches the golden runner's ORDER BY. */
  orderedJournals(): JournalTransaction[] {
    return [...this.journals.values()]
      .sort((a, b) => {
        if (a.journal.transactionDate !== b.journal.transactionDate) {
          return a.journal.transactionDate < b.journal.transactionDate ? -1 : 1;
        }
        return a.seq - b.seq;
      })
      .map((stored) => stored.journal);
  }
}
