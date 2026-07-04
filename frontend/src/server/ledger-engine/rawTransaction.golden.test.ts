import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fromAkahuPayload } from "./rawTransaction";

/**
 * Cross-language golden parity: the TS port must reproduce the Python engine's
 * output byte-for-byte on the pinned corpus. idempotency_hash equality is the
 * HARD P2 acceptance gate (see tests/golden/README.md).
 */

interface ExpectedFields {
  idempotency_hash: string;
  amount_cents: number;
  account_id: string;
  status: string;
  transaction_date: string;
  settlement_date: string | null;
  description: string;
  merchant_name: string | null;
  nzfcc: string | null;
  currency: string;
  is_pending: boolean;
  raw_json: string;
  hash_input?: string;
}

interface GoldenCase {
  case_id: string;
  source: string;
  input: Record<string, unknown>;
  expect_error: boolean;
  expected?: ExpectedFields;
}

const fixturePath = path.resolve(
  process.cwd(),
  "../tests/golden/fixtures/idempotency_hash.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8")) as { cases: GoldenCase[] };

describe("RawTransaction.fromAkahuPayload — golden parity vs Python engine", () => {
  it("has a corpus to test", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  for (const c of fixture.cases) {
    it(`${c.case_id} (${c.source})`, () => {
      if (c.expect_error) {
        expect(() => fromAkahuPayload(c.input)).toThrow();
        return;
      }

      const e = c.expected!;
      const got = fromAkahuPayload(c.input);

      // The hard gate first.
      expect(got.idempotencyHash, "idempotency_hash").toBe(e.idempotency_hash);

      expect(got.amountCents, "amount_cents").toBe(e.amount_cents);
      expect(got.accountId, "account_id").toBe(e.account_id);
      expect(got.status, "status").toBe(e.status);
      expect(got.transactionDate, "transaction_date").toBe(e.transaction_date);
      expect(got.settlementDate, "settlement_date").toBe(e.settlement_date);
      expect(got.description, "description").toBe(e.description);
      expect(got.merchantName, "merchant_name").toBe(e.merchant_name);
      expect(got.nzfcc, "nzfcc").toBe(e.nzfcc);
      expect(got.currency, "currency").toBe(e.currency);
      expect(got.isPending ? true : false, "is_pending").toBe(e.is_pending);

      // raw_json: assert SEMANTIC parity (same data), not byte-parity. Byte
      // equality with Python's stable_json is provably unachievable when a
      // payload carries a bare integer-valued float — JS's JSON number model
      // has no int/float distinction, so JSON.parse("-10.0") === -10 and it
      // re-serializes as "-10" where Python keeps "-10.0". This is harmless:
      // raw_json is NEVER hashed (the hash uses akahu:{id} or the pipe-join),
      // and it is stored as Postgres jsonb (keys reordered, whitespace stripped)
      // so byte-identity to Python is not preserved in the DB regardless.
      // Round-tripping the fixture string through JS's own number model is the
      // honest equivalence class.
      expect(JSON.parse(got.rawJson), "raw_json (semantic)").toEqual(
        JSON.parse(e.raw_json),
      );
    });
  }
});
