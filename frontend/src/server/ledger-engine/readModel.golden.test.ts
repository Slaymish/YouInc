import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { RulesRouter, type RulesConfig } from "./rulesRouter";
import { LedgerPipeline } from "./pipeline";
import { InMemoryLedgerStore } from "./inMemoryLedgerStore";
import { fetchBalances, fetchIncomeStatement, fetchJournalRows } from "./readModel";
import { exportHledger } from "./hledgerExport";

/**
 * Cross-language golden parity for the read-DAL — the read side of the Python
 * LedgerDatabase (fetch_balances / fetch_income_statement / fetch_journal_rows)
 * plus ledger_exporter.export_hledger. Each case replays the same
 * journal_balancing payloads through the already-ported TS pipeline, then reads
 * the materialized journals back out through the TS read-model, and deep-equals
 * the whole read surface against fixtures/read_model.json (captured from the
 * live Python engine). "Full differential harness": pipeline -> store -> read
 * -> four surfaces, all pinned in one deep-equal per case.
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

interface ReadModelCase {
  case_id: string;
  source: string;
  input: {
    payloads: Record<string, unknown>[];
    manual_classifications?: ManualClassificationInput[];
  };
  expected: unknown;
}

const cases = (
  JSON.parse(readFileSync(path.join(goldenDir, "read_model.json"), "utf-8")) as {
    cases: ReadModelCase[];
  }
).cases;

/** Replay a case through the pipeline, then assemble the Python read-DAL's
 *  snake_case output shape so a single deep-equal covers all four surfaces. */
function runCase(c: ReadModelCase): unknown {
  const store = new InMemoryLedgerStore();
  for (const entry of c.input.manual_classifications ?? []) {
    store.setManualClassification(entry.external_id, entry.target_account, entry.memo);
  }
  const pipeline = new LedgerPipeline(store, new RulesRouter(snapshotConfig), true);
  pipeline.processPayloads(c.input.payloads);

  const journals = store.orderedJournals();

  return {
    balances: fetchBalances(journals).map((b) => ({
      account: b.account,
      balance_cents: b.balanceCents,
      currency: b.currency,
    })),
    income_statement: fetchIncomeStatement(journals).map((r) => ({
      month: r.month,
      account: r.account,
      amount_cents: r.amountCents,
      currency: r.currency,
    })),
    journal_rows: fetchJournalRows(journals).map((r) => ({
      external_id: r.externalId,
      transaction_date: r.transactionDate,
      description: r.description,
      rule_id: r.ruleId,
      account: r.account,
      side: r.side,
      amount_cents: r.amountCents,
      currency: r.currency,
    })),
    hledger: exportHledger(fetchJournalRows(journals)),
  };
}

describe("read-DAL — golden parity vs Python engine", () => {
  it("has a corpus to test", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const c of cases) {
    it(`${c.case_id} (${c.source})`, () => {
      expect(runCase(c)).toEqual(c.expected);
    });
  }
});
