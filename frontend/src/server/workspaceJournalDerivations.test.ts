import { describe, expect, it } from "vitest";
import type { TenantJournalEntryRow } from "./workspaceJournal";
import { computeWorkspaceNetWorthTrend, toNetWorthEntryRows } from "./workspaceTrends";
import { computeWorkspaceRecentTransactions, toJournalEntryDetailRows } from "./workspaceTransactions";
import { computeWorkspaceRecurringPayments, toRecurringEntryRows } from "./workspaceRecurring";
import {
  computeWorkspaceCategoryMonthly,
  computeWorkspaceDailySpend,
  toCategoryMonthlyEntryRows,
  toDailySpendEntryRows,
} from "./workspaceSpending";

// A small realistic tenant journal: salary in, rent + groceries out, plus a
// pure asset transfer (no Income/Expense leg) and a manual-sourced posting
// that several of these transforms must exclude.
const ROWS: TenantJournalEntryRow[] = [
  {
    transactionId: "t-salary",
    externalId: "tx_salary",
    transactionDate: "2026-06-01",
    description: "ACME PAYROLL SALARY",
    ruleId: "rule_salary",
    sourceAccountId: "acc_everyday",
    account: "Assets:Bank:Everyday",
    side: "debit",
    amountCents: 500_000,
    currency: "NZD",
  },
  {
    transactionId: "t-salary",
    externalId: "tx_salary",
    transactionDate: "2026-06-01",
    description: "ACME PAYROLL SALARY",
    ruleId: "rule_salary",
    sourceAccountId: "acc_everyday",
    account: "Income:Salary",
    side: "credit",
    amountCents: 500_000,
    currency: "NZD",
  },
  {
    transactionId: "t-rent",
    externalId: "tx_rent",
    transactionDate: "2026-06-02",
    description: "CITY PROPERTY RENT",
    ruleId: "rule_rent",
    sourceAccountId: "acc_everyday",
    account: "Expenses:Housing:Rent",
    side: "debit",
    amountCents: 180_000,
    currency: "NZD",
  },
  {
    transactionId: "t-rent",
    externalId: "tx_rent",
    transactionDate: "2026-06-02",
    description: "CITY PROPERTY RENT",
    ruleId: "rule_rent",
    sourceAccountId: "acc_everyday",
    account: "Assets:Bank:Everyday",
    side: "credit",
    amountCents: 180_000,
    currency: "NZD",
  },
  {
    transactionId: "t-transfer",
    externalId: "tx_transfer",
    transactionDate: "2026-06-03",
    description: "TRANSFER TO SAVINGS",
    ruleId: null,
    sourceAccountId: "acc_everyday",
    account: "Assets:Bank:Everyday",
    side: "credit",
    amountCents: 50_000,
    currency: "NZD",
  },
  {
    transactionId: "t-transfer",
    externalId: "tx_transfer",
    transactionDate: "2026-06-03",
    description: "TRANSFER TO SAVINGS",
    ruleId: null,
    sourceAccountId: "acc_everyday",
    account: "Assets:Bank:Savings",
    side: "debit",
    amountCents: 50_000,
    currency: "NZD",
  },
  {
    transactionId: "t-manual-opening",
    externalId: "tx_manual_opening",
    transactionDate: "2026-05-01",
    description: "Opening balance",
    ruleId: "manual:opening_balance",
    sourceAccountId: "manual",
    account: "Expenses:Groceries",
    side: "debit",
    amountCents: 9_999,
    currency: "NZD",
  },
];

describe("workspaceTrends transforms", () => {
  it("keeps only Assets:/Liabilities: postings, signed debit-positive", () => {
    const rows = toNetWorthEntryRows(ROWS);
    expect(rows).toEqual([
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: 500_000 },
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: -180_000 },
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: -50_000 },
      { month: "2026-06", account: "Assets:Bank:Savings", amountCents: 50_000 },
    ]);
  });

  it("computes an accumulated net-worth trend", () => {
    const trend = computeWorkspaceNetWorthTrend(ROWS);
    expect(trend).toEqual([
      { month: "2026-06", assetsCents: 320_000, liabilitiesCents: 0, netWorthCents: 320_000 },
    ]);
  });
});

describe("workspaceTransactions transforms", () => {
  it("maps every posting regardless of account/source", () => {
    expect(toJournalEntryDetailRows(ROWS)).toHaveLength(ROWS.length);
  });

  it("reconstructs recent transactions newest-first", () => {
    const transactions = computeWorkspaceRecentTransactions(ROWS, 12);
    expect(transactions.map((t) => t.externalId)).toEqual([
      "tx_transfer",
      "tx_rent",
      "tx_salary",
      "tx_manual_opening",
    ]);
  });
});

describe("workspaceRecurring transforms", () => {
  it("keeps only Expenses:%/debit postings from non-manual transactions", () => {
    const rows = toRecurringEntryRows(ROWS);
    expect(rows).toEqual([
      { transactionId: "t-rent", date: "2026-06-02", description: "CITY PROPERTY RENT", account: "Expenses:Housing:Rent", amountCents: 180_000 },
    ]);
  });

  it("does not flag a single-occurrence expense as recurring", () => {
    expect(computeWorkspaceRecurringPayments(ROWS)).toEqual([]);
  });
});

describe("workspaceSpending transforms", () => {
  it("keeps only Expenses:% postings for category-monthly", () => {
    const rows = toCategoryMonthlyEntryRows(ROWS);
    expect(rows).toEqual([
      { month: "2026-06", account: "Expenses:Housing:Rent", side: "debit", amountCents: 180_000 },
      { month: "2026-05", account: "Expenses:Groceries", side: "debit", amountCents: 9_999 },
    ]);
  });

  it("computes category-monthly totals", () => {
    expect(computeWorkspaceCategoryMonthly(ROWS)).toEqual([
      { month: "2026-05", account: "Expenses:Groceries", amountCents: 9_999 },
      { month: "2026-06", account: "Expenses:Housing:Rent", amountCents: 180_000 },
    ]);
  });

  it("excludes manual-sourced transactions but includes pure transfers for daily spend", () => {
    const rows = toDailySpendEntryRows(ROWS);
    // 6 non-manual postings (the manual opening-balance transaction's 1
    // posting is excluded); the transfer's 2 postings ARE included.
    expect(rows).toHaveLength(6);
    expect(rows.some((r) => r.transactionId === "t-manual-opening")).toBe(false);
    expect(rows.some((r) => r.transactionId === "t-transfer")).toBe(true);
  });

  it("counts the transfer-only day as an active day with zero spend/income", () => {
    const points = computeWorkspaceDailySpend(ROWS);
    const transferDay = points.find((p) => p.date === "2026-06-03");
    expect(transferDay).toEqual({
      date: "2026-06-03",
      spendCents: 0,
      incomeCents: 0,
      netCents: 0,
      count: 1,
    });
  });
});
