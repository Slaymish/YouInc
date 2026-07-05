import { describe, expect, it } from "vitest";
import {
  RECLASSIFY_RULE_ID,
  computeRoutingHealth,
  computeSuspenseQueue,
  isSuspenseAccount,
  reclassifyExternalId,
  rootExternalId,
  type SuspenseSourceEntry,
} from "./workspaceSuspenseMath";

const SUSPENSE = "Expenses:Uncategorized:Suspense";

function txn(
  transactionId: string,
  externalId: string,
  ruleId: string | null,
  postings: Array<Pick<SuspenseSourceEntry, "account" | "side" | "amountCents">>,
  overrides: Partial<Pick<SuspenseSourceEntry, "transactionDate" | "description" | "sourceAccountId">> = {},
): SuspenseSourceEntry[] {
  return postings.map((p) => ({
    transactionId,
    externalId,
    transactionDate: overrides.transactionDate ?? "2026-06-01",
    description: overrides.description ?? "Test transaction",
    ruleId,
    sourceAccountId: overrides.sourceAccountId ?? "acc_test",
    ...p,
  }));
}

describe("rootExternalId / reclassifyExternalId", () => {
  it("round-trips: rootExternalId strips the reclassify suffix reclassifyExternalId adds", () => {
    const correctionId = reclassifyExternalId("abc123", "corr-1");
    expect(correctionId).toBe("abc123::reclass::corr-1");
    expect(rootExternalId(correctionId)).toBe("abc123");
  });

  it("is the identity for a plain (non-correction) external id", () => {
    expect(rootExternalId("abc123")).toBe("abc123");
  });
});

describe("isSuspenseAccount", () => {
  it("matches the exact suspense account and its sub-accounts, not unrelated accounts", () => {
    expect(isSuspenseAccount(SUSPENSE, SUSPENSE)).toBe(true);
    expect(isSuspenseAccount(`${SUSPENSE}:Unknown`, SUSPENSE)).toBe(true);
    expect(isSuspenseAccount("Expenses:Groceries", SUSPENSE)).toBe(false);
    // Prefix-but-not-boundary should not match (avoid accidental substring hits).
    expect(isSuspenseAccount("Expenses:Uncategorized:SuspenseAccountX", SUSPENSE)).toBe(false);
  });
});

describe("computeSuspenseQueue", () => {
  it("returns an empty queue when there are no entries", () => {
    expect(computeSuspenseQueue([], SUSPENSE)).toEqual([]);
  });

  it("surfaces an unresolved money-out transaction with direction 'out' and negative amount", () => {
    // Money out: target (suspense) debited, source credited.
    const entries = txn(
      "t1",
      "ext-1",
      null,
      [
        { account: SUSPENSE, side: "debit", amountCents: 4000 },
        { account: "Assets:Bank:Everyday", side: "credit", amountCents: 4000 },
      ],
      { description: "ATM WITHDRAWAL", transactionDate: "2026-06-07" },
    );

    const queue = computeSuspenseQueue(entries, SUSPENSE);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual({
      externalId: "ext-1",
      transactionDate: "2026-06-07",
      description: "ATM WITHDRAWAL",
      amountCents: -4000,
      direction: "out",
      counterAccount: "Assets:Bank:Everyday",
    });
  });

  it("surfaces an unresolved money-in transaction with direction 'in' and positive amount", () => {
    // Money in: source debited, target (suspense) credited.
    const entries = txn("t2", "ext-2", null, [
      { account: "Assets:Bank:Everyday", side: "debit", amountCents: 2500 },
      { account: SUSPENSE, side: "credit", amountCents: 2500 },
    ]);

    const queue = computeSuspenseQueue(entries, SUSPENSE);
    expect(queue).toHaveLength(1);
    expect(queue[0].direction).toBe("in");
    expect(queue[0].amountCents).toBe(2500);
    expect(queue[0].counterAccount).toBe("Assets:Bank:Everyday");
  });

  it("drops an item from the queue once a reclassify correction nets its suspense postings to zero", () => {
    const original = txn("t1", "ext-1", null, [
      { account: SUSPENSE, side: "debit", amountCents: 4000 },
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 4000 },
    ]);
    // Correction reverses the suspense debit (credit) and posts the same side
    // (debit) to the new target account — exactly what tenantReclassify.ts builds.
    const correction = txn(
      "t1-correction",
      reclassifyExternalId("ext-1", "corr-1"),
      RECLASSIFY_RULE_ID,
      [
        { account: SUSPENSE, side: "credit", amountCents: 4000 },
        { account: "Expenses:Cash", side: "debit", amountCents: 4000 },
      ],
    );

    const queue = computeSuspenseQueue([...original, ...correction], SUSPENSE);
    expect(queue).toEqual([]);
  });

  it("ignores non-suspense entries entirely", () => {
    const entries = txn("t1", "ext-1", "rule:groceries", [
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 1000 },
      { account: "Expenses:Groceries", side: "debit", amountCents: 1000 },
    ]);
    expect(computeSuspenseQueue(entries, SUSPENSE)).toEqual([]);
  });

  it("orders newest transaction date first", () => {
    const older = txn("t1", "ext-1", null, [
      { account: SUSPENSE, side: "debit", amountCents: 1000 },
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 1000 },
    ], { transactionDate: "2026-06-01" });
    const newer = txn("t2", "ext-2", null, [
      { account: SUSPENSE, side: "debit", amountCents: 2000 },
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 2000 },
    ], { transactionDate: "2026-06-05" });

    const queue = computeSuspenseQueue([...older, ...newer], SUSPENSE);
    expect(queue.map((item) => item.externalId)).toEqual(["ext-2", "ext-1"]);
  });
});

describe("computeRoutingHealth", () => {
  it("returns a null classification rate when there are no journal transactions", () => {
    const health = computeRoutingHealth([], SUSPENSE);
    expect(health).toEqual({
      journalCount: 0,
      customRuleCount: 0,
      nzfccFallbackCount: 0,
      suspenseCount: 0,
      suspenseCents: 0,
      classificationRate: null,
    });
  });

  it("classifies rule-routed, nzfcc-routed, and suspense-routed transactions", () => {
    const ruleTxn = txn("t1", "ext-1", "rule:groceries", [
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 1000 },
      { account: "Expenses:Groceries", side: "debit", amountCents: 1000 },
    ]);
    const nzfccTxn = txn("t2", "ext-2", "nzfcc:groceries", [
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 500 },
      { account: "Expenses:Groceries", side: "debit", amountCents: 500 },
    ]);
    const suspenseTxn = txn("t3", "ext-3", null, [
      { account: SUSPENSE, side: "debit", amountCents: 4000 },
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 4000 },
    ]);

    const health = computeRoutingHealth([...ruleTxn, ...nzfccTxn, ...suspenseTxn], SUSPENSE);
    expect(health.journalCount).toBe(3);
    expect(health.customRuleCount).toBe(1);
    expect(health.nzfccFallbackCount).toBe(1);
    expect(health.suspenseCount).toBe(1);
    expect(health.suspenseCents).toBe(4000);
    expect(health.classificationRate).toBeCloseTo(2 / 3);
  });

  it("excludes manual-sourced and reclassify-correction transactions from every count", () => {
    const manualTxn = txn(
      "t-manual",
      "ext-manual",
      "manual:opening_balance",
      [
        { account: "Assets:Bank:Everyday", side: "debit", amountCents: 100 },
        { account: "Equity:OpeningBalance", side: "credit", amountCents: 100 },
      ],
      { sourceAccountId: "manual" },
    );
    const original = txn("t1", "ext-1", null, [
      { account: SUSPENSE, side: "debit", amountCents: 4000 },
      { account: "Assets:Bank:Everyday", side: "credit", amountCents: 4000 },
    ]);
    const correction = txn(
      "t1-correction",
      reclassifyExternalId("ext-1", "corr-1"),
      RECLASSIFY_RULE_ID,
      [
        { account: SUSPENSE, side: "credit", amountCents: 4000 },
        { account: "Expenses:Cash", side: "debit", amountCents: 4000 },
      ],
    );

    const health = computeRoutingHealth([...manualTxn, ...original, ...correction], SUSPENSE);
    // Only "t1" (now resolved, net zero) counts toward journalCount; the
    // manual seed and the correction transaction are excluded.
    expect(health.journalCount).toBe(1);
    expect(health.suspenseCount).toBe(0);
    expect(health.classificationRate).toBe(1);
  });
});
