import { describe, expect, it } from "vitest";
import {
  computeCategoryMonthly,
  computeDailySpend,
  computeRecurringGroups,
  computeRecurringPayments,
  detectRecurring,
} from "./analytics";

describe("computeCategoryMonthly", () => {
  it("nets debit-positive/credit-negative postings per (month, account)", () => {
    const points = computeCategoryMonthly([
      { month: "2026-06", account: "Expenses:Groceries", side: "debit", amountCents: 15_240 },
      { month: "2026-06", account: "Expenses:Groceries", side: "debit", amountCents: 4_000 },
      // A partial refund credits the expense account back down.
      { month: "2026-06", account: "Expenses:Groceries", side: "credit", amountCents: 4_000 },
      { month: "2026-07", account: "Expenses:Housing:Rent", side: "debit", amountCents: 180_000 },
    ]);

    expect(points).toEqual([
      { month: "2026-06", account: "Expenses:Groceries", amountCents: 15_240 },
      { month: "2026-07", account: "Expenses:Housing:Rent", amountCents: 180_000 },
    ]);
  });

  it("drops a (month, account) group that nets to exactly zero", () => {
    const points = computeCategoryMonthly([
      { month: "2026-06", account: "Expenses:Refunded", side: "debit", amountCents: 5_000 },
      { month: "2026-06", account: "Expenses:Refunded", side: "credit", amountCents: 5_000 },
    ]);
    expect(points).toEqual([]);
  });

  it("sorts by month then account", () => {
    const points = computeCategoryMonthly([
      { month: "2026-07", account: "Expenses:Zoo", side: "debit", amountCents: 100 },
      { month: "2026-06", account: "Expenses:Zoo", side: "debit", amountCents: 100 },
      { month: "2026-06", account: "Expenses:Alpha", side: "debit", amountCents: 100 },
    ]);
    expect(points.map((p) => `${p.month}/${p.account}`)).toEqual([
      "2026-06/Expenses:Alpha",
      "2026-06/Expenses:Zoo",
      "2026-07/Expenses:Zoo",
    ]);
  });
});

describe("computeDailySpend", () => {
  it("sums Expenses:%/Income:% postings per day and counts distinct transactions", () => {
    const points = computeDailySpend([
      // Two entries, same transaction: expense debit + asset credit.
      { date: "2026-06-02", transactionId: "tx1", account: "Expenses:Housing:Rent", side: "debit", amountCents: 180_000 },
      { date: "2026-06-02", transactionId: "tx1", account: "Assets:Bank:Everyday", side: "credit", amountCents: 180_000 },
      // A second, independent transaction on the same day.
      { date: "2026-06-02", transactionId: "tx2", account: "Expenses:Groceries", side: "debit", amountCents: 4_000 },
      { date: "2026-06-02", transactionId: "tx2", account: "Assets:Bank:Everyday", side: "credit", amountCents: 4_000 },
      // Salary on a different day.
      { date: "2026-06-01", transactionId: "tx0", account: "Income:Salary", side: "credit", amountCents: 500_000 },
      { date: "2026-06-01", transactionId: "tx0", account: "Assets:Bank:Everyday", side: "debit", amountCents: 500_000 },
    ]);

    expect(points).toEqual([
      { date: "2026-06-01", spendCents: 0, incomeCents: 500_000, netCents: 500_000, count: 1 },
      { date: "2026-06-02", spendCents: 184_000, incomeCents: 0, netCents: -184_000, count: 2 },
    ]);
  });

  it("counts a pure transfer (no Income/Expense leg) toward the day's distinct-transaction count", () => {
    // Regression: the SQL counts COUNT(DISTINCT jt.id) over the WHOLE join,
    // not just rows matching the Income:%/Expenses:% CASE filters, so a
    // transfer between two asset accounts still counts as an active day.
    const points = computeDailySpend([
      { date: "2026-06-03", transactionId: "tx-transfer", account: "Assets:Bank:Everyday", side: "credit", amountCents: 50_000 },
      { date: "2026-06-03", transactionId: "tx-transfer", account: "Assets:Bank:Savings", side: "debit", amountCents: 50_000 },
    ]);

    expect(points).toEqual([
      { date: "2026-06-03", spendCents: 0, incomeCents: 0, netCents: 0, count: 1 },
    ]);
  });

  it("returns an empty list for no rows", () => {
    expect(computeDailySpend([])).toEqual([]);
  });
});

describe("computeRecurringGroups", () => {
  it("sums per-transaction spend and picks the largest-amount leg as the account", () => {
    const groups = computeRecurringGroups([
      // One transaction with two Expenses:%/debit legs (a split purchase):
      // the larger one should be picked as the representative account.
      { transactionId: "tx1", date: "2026-06-01", description: "SUPERMARKET", account: "Expenses:Groceries", amountCents: 12_000 },
      { transactionId: "tx1", date: "2026-06-01", description: "SUPERMARKET", account: "Expenses:Household", amountCents: 3_000 },
      { transactionId: "tx2", date: "2026-06-15", description: "NETFLIX", account: "Expenses:Subscriptions", amountCents: 1_999 },
    ]);

    expect(groups).toEqual([
      { date: "2026-06-01", description: "SUPERMARKET", account: "Expenses:Groceries", spend_cents: 15_000 },
      { date: "2026-06-15", description: "NETFLIX", account: "Expenses:Subscriptions", spend_cents: 1_999 },
    ]);
  });

  it("excludes a transaction whose spend nets to zero or less", () => {
    // Defensive: computeRecurringGroups only ever receives positive debit
    // amounts in practice, but a zero-spend group should still be dropped.
    const groups = computeRecurringGroups([
      { transactionId: "tx1", date: "2026-06-01", description: "ZERO", account: "Expenses:Zero", amountCents: 0 },
    ]);
    expect(groups).toEqual([]);
  });
});

describe("computeRecurringPayments", () => {
  it("detects a monthly subscription spanning 3 occurrences", () => {
    const payments = computeRecurringPayments([
      { transactionId: "tx-may", date: "2026-05-15", description: "NETFLIX.COM", account: "Expenses:Subscriptions", amountCents: 1_999 },
      { transactionId: "tx-jun", date: "2026-06-14", description: "NETFLIX.COM", account: "Expenses:Subscriptions", amountCents: 1_999 },
      { transactionId: "tx-jul", date: "2026-07-15", description: "NETFLIX.COM", account: "Expenses:Subscriptions", amountCents: 1_999 },
    ]);

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      description: "NETFLIX.COM",
      account: "Expenses:Subscriptions",
      amountCents: 1_999,
      occurrences: 3,
      cadence: "monthly",
    });
  });

  it("matches detectRecurring fed the equivalent already-grouped rows", () => {
    const entryRows = [
      { transactionId: "tx-may", date: "2026-05-15", description: "NETFLIX.COM", account: "Expenses:Subscriptions", amountCents: 1_999 },
      { transactionId: "tx-jun", date: "2026-06-14", description: "NETFLIX.COM", account: "Expenses:Subscriptions", amountCents: 1_999 },
    ];
    const grouped = [
      { date: "2026-05-15", description: "NETFLIX.COM", account: "Expenses:Subscriptions", spend_cents: 1_999 },
      { date: "2026-06-14", description: "NETFLIX.COM", account: "Expenses:Subscriptions", spend_cents: 1_999 },
    ];
    expect(computeRecurringPayments(entryRows)).toEqual(detectRecurring(grouped));
  });

  it("does not flag a single occurrence as recurring", () => {
    const payments = computeRecurringPayments([
      { transactionId: "tx1", date: "2026-06-01", description: "ONE OFF PURCHASE", account: "Expenses:Misc", amountCents: 5_000 },
    ]);
    expect(payments).toEqual([]);
  });
});
