import { fromAkahuPayload, type RawTransaction } from "./rawTransaction";
import { RulesRouter, type RouteDecision } from "./rulesRouter";
import {
  posting,
  validateBalanced,
  type JournalTransaction,
  type Posting,
} from "./journal";

/**
 * TypeScript port of youinc_ledger.ledger_pipeline.pipeline.LedgerPipeline
 * (process_payloads path) — P2 ledger port. Proven at parity against the
 * Python engine by tests/golden/fixtures/journal_balancing.json (see
 * pipeline.golden.test.ts).
 *
 * The pipeline is pure orchestration over a persistence port (LedgerStore).
 * The Python engine drove SQLite directly; here the store is an interface so
 * the multi-tenant target can back it with the (deferred) Supabase DAL, while
 * the golden test supplies an in-memory store that mirrors the exact SQLite
 * semantics the fixture pins (upsert insert/duplicate, journal existence,
 * manual-classification override).
 *
 * reclassify_existing_journals is intentionally not ported — no fixture pins
 * it, and it depends on a read path (fetch_journaled_raw_transactions) that
 * belongs to the DAL slice, not this one.
 */

/** Persistence port. Method contracts mirror LedgerDatabase exactly:
 *  - upsertRawTransaction returns true only when the hash was newly inserted.
 *  - insertJournalTransaction returns true when inserted, false if a journal
 *    with the same external_id already exists.
 *  - getManualClassification returns [targetAccount, memo] or null. */
export interface LedgerStore {
  upsertRawTransaction(transaction: RawTransaction): boolean;
  markRawSkipped(externalId: string, reason: string): void;
  journalExists(externalId: string): boolean;
  insertJournalTransaction(transaction: JournalTransaction): boolean;
  getManualClassification(externalId: string): [string, string | null] | null;
}

export interface PipelineResult {
  seen: number;
  rawInserted: number;
  posted: number;
  skippedPending: number;
  skippedDuplicate: number;
  skippedZeroAmount: number;
  errors: ReadonlyArray<string>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class LedgerPipeline {
  constructor(
    private readonly store: LedgerStore,
    private readonly router: RulesRouter,
    private readonly discardPending: boolean = true,
  ) {}

  processPayloads(payloads: Iterable<Record<string, unknown>>): PipelineResult {
    const result = {
      seen: 0,
      rawInserted: 0,
      posted: 0,
      skippedPending: 0,
      skippedDuplicate: 0,
      skippedZeroAmount: 0,
      errors: [] as string[],
    };

    for (const payload of payloads) {
      result.seen += 1;
      try {
        const transaction = fromAkahuPayload(payload);
        const inserted = this.store.upsertRawTransaction(transaction);
        if (inserted) result.rawInserted += 1;

        if (transaction.isPending && this.discardPending) {
          this.store.markRawSkipped(transaction.idempotencyHash, "pending");
          result.skippedPending += 1;
          continue;
        }

        if (transaction.amountCents === 0) {
          this.store.markRawSkipped(transaction.idempotencyHash, "zero_amount");
          result.skippedZeroAmount += 1;
          continue;
        }

        if (this.store.journalExists(transaction.idempotencyHash)) {
          result.skippedDuplicate += 1;
          continue;
        }

        const journalTransaction = this.buildJournalTransaction(transaction);
        if (this.store.insertJournalTransaction(journalTransaction)) {
          result.posted += 1;
        } else {
          result.skippedDuplicate += 1;
        }
      } catch (error: unknown) {
        // Keep the batch running and report per transaction (parity with the
        // Python engine's broad per-payload except).
        result.errors.push(getErrorMessage(error));
      }
    }

    return result;
  }

  /** Manual per-transaction classifications win over rule/nzfcc routing. */
  private resolveRoute(transaction: RawTransaction): RouteDecision {
    const override = this.store.getManualClassification(transaction.idempotencyHash);
    if (override !== null) {
      const [targetAccount, memo] = override;
      return {
        targetAccount,
        ruleId: "manual:override",
        memo,
        matchedBy: "manual",
      };
    }
    return this.router.route(transaction);
  }

  private buildJournalTransaction(transaction: RawTransaction): JournalTransaction {
    const accountMapping = this.router.accountMappingFor(transaction.accountId);
    const route = this.resolveRoute(transaction);
    const amountCents = Math.abs(transaction.amountCents);

    // Positive amount (money in): source account DEBITed, target CREDITed.
    // Negative amount (money out): target DEBITed, source CREDITed.
    // Both legs use abs(amount_cents).
    const postings: [Posting, Posting] =
      transaction.amountCents > 0
        ? [
            posting(accountMapping.ledgerAccount, "debit", amountCents),
            posting(route.targetAccount, "credit", amountCents),
          ]
        : [
            posting(route.targetAccount, "debit", amountCents),
            posting(accountMapping.ledgerAccount, "credit", amountCents),
          ];

    const journalTransaction: JournalTransaction = {
      externalId: transaction.idempotencyHash,
      transactionDate: transaction.settlementDate
        ? transaction.settlementDate.slice(0, 10)
        : transaction.transactionDate,
      description: transaction.description,
      sourceAccountId: transaction.accountId,
      status: transaction.status,
      ruleId: route.ruleId,
      postings,
    };
    validateBalanced(journalTransaction);
    return journalTransaction;
  }
}
