import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { RulesRouter, type RulesConfig } from "./rulesRouter";
import { LedgerPipeline } from "./pipeline";
import { InMemoryLedgerStore } from "./inMemoryLedgerStore";

/**
 * Cross-language golden parity for the double-entry pipeline. The TS port must
 * reproduce the Python LedgerPipeline.process_payloads end to end: the
 * PipelineResult counters, the debit/credit sign convention, manual-override
 * precedence, and duplicate/pending/zero-amount handling — evaluated against
 * the frozen rules_snapshot.yaml. Every posted journal must also balance.
 *
 * The Python golden runner drives a temp SQLite DB and reads the journals back
 * ordered by (transaction_date, jt.id, je.id). InMemoryLedgerStore below
 * reproduces exactly those semantics (insert-vs-duplicate, existence checks,
 * insertion sequence) so the outcome can be deep-equal'd against the fixture.
 */

const goldenDir = path.resolve(process.cwd(), "../tests/golden/fixtures");

const snapshotConfig = yaml.load(
  readFileSync(path.join(goldenDir, "rules_snapshot.yaml"), "utf-8"),
) as RulesConfig;

interface ManualClassificationInput {
  external_id: string;
  target_account: string;
  memo: string | null;
}

interface PipelineCase {
  case_id: string;
  source: string;
  input: {
    payloads: Record<string, unknown>[];
    manual_classifications?: ManualClassificationInput[];
  };
  expected: unknown;
}

const cases = (
  JSON.parse(readFileSync(path.join(goldenDir, "journal_balancing.json"), "utf-8")) as {
    cases: PipelineCase[];
  }
).cases;

/** Assemble the same snake_case outcome shape the Python runner returns, so a
 *  single deep-equal covers counters, ordering, postings, and field names. */
function runCase(c: PipelineCase): unknown {
  const store = new InMemoryLedgerStore();
  for (const entry of c.input.manual_classifications ?? []) {
    store.setManualClassification(entry.external_id, entry.target_account, entry.memo);
  }
  const pipeline = new LedgerPipeline(store, new RulesRouter(snapshotConfig), true);
  const result = pipeline.processPayloads(c.input.payloads);

  return {
    result: {
      seen: result.seen,
      raw_inserted: result.rawInserted,
      posted: result.posted,
      skipped_pending: result.skippedPending,
      skipped_duplicate: result.skippedDuplicate,
      skipped_zero_amount: result.skippedZeroAmount,
      errors: result.errors,
    },
    journal_transactions: store.orderedJournals().map((jt) => ({
      external_id: jt.externalId,
      transaction_date: jt.transactionDate,
      description: jt.description,
      source_account_id: jt.sourceAccountId,
      status: jt.status,
      rule_id: jt.ruleId,
      postings: jt.postings.map((p) => ({
        account: p.account,
        side: p.side,
        amount_cents: p.amountCents,
        currency: p.currency,
      })),
    })),
  };
}

describe("LedgerPipeline.processPayloads — golden parity vs Python engine", () => {
  it("has a corpus to test", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.case_id} (${c.source})`, () => {
      const outcome = runCase(c);
      // The hard gate: one deep-equal over the whole outcome (counters +
      // ordered journals + nested postings + field names).
      expect(outcome).toEqual(c.expected);

      // Independent invariant: every posted journal balances and is positive.
      const journals = (outcome as { journal_transactions: Array<{ postings: Array<{ side: string; amount_cents: number }> }> })
        .journal_transactions;
      for (const jt of journals) {
        const debit = jt.postings
          .filter((p) => p.side === "debit")
          .reduce((sum, p) => sum + p.amount_cents, 0);
        const credit = jt.postings
          .filter((p) => p.side === "credit")
          .reduce((sum, p) => sum + p.amount_cents, 0);
        expect(debit).toBe(credit);
        expect(debit).toBeGreaterThan(0);
      }
    });
  }
});
