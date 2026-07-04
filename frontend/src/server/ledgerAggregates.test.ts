import { describe, expect, it } from "vitest";
import {
  computeAccountBreakdowns,
  computeCashCents,
  computeCreditFacilities,
  computeIncomeStatementTotals,
  computeLiquidityTotals,
  computeNetWorthTrend,
  computeRecentTransactions,
  computeRunwayMonths,
  liquidityTierForAccount,
} from "./ledgerAggregates";

describe("liquidityTierForAccount", () => {
  it("classifies bank/treasury/internal accounts as cash", () => {
    expect(liquidityTierForAccount("Assets:Bank:Everyday")).toBe("cash");
    expect(liquidityTierForAccount("Assets:Treasury:BondLadder")).toBe("cash");
    expect(liquidityTierForAccount("Assets:Internal:Suspense")).toBe("cash");
  });

  it("classifies the Sharesies spend sub-account as cash", () => {
    expect(liquidityTierForAccount("Assets:Investments:Sharesies:Spend")).toBe(
      "cash",
    );
  });

  it("classifies Blossom and Sharesies emergencies as semi-liquid", () => {
    expect(liquidityTierForAccount("Assets:Investments:Blossom:Growth")).toBe(
      "semi_liquid",
    );
    expect(
      liquidityTierForAccount("Assets:Investments:Sharesies:Emergencies"),
    ).toBe("semi_liquid");
  });

  it("falls back to illiquid for anything else", () => {
    expect(liquidityTierForAccount("Assets:Property:House")).toBe("illiquid");
    expect(liquidityTierForAccount("Liabilities:CreditCard")).toBe("illiquid");
  });
});

describe("computeIncomeStatementTotals", () => {
  it("nets income/expenses per month and rolls up totals", () => {
    const result = computeIncomeStatementTotals([
      { month: "2026-06", account: "Income:Salary", amountCents: 500_000 },
      {
        month: "2026-06",
        account: "Expenses:Housing:Rent",
        amountCents: -180_000,
      },
      {
        month: "2026-06",
        account: "Expenses:Groceries",
        amountCents: -15_240,
      },
      { month: "2026-07", account: "Income:Salary", amountCents: 500_000 },
      {
        month: "2026-07",
        account: "Expenses:Housing:Rent",
        amountCents: -180_000,
      },
    ]);

    expect(result.pnl).toEqual([
      {
        month: "2026-06",
        incomeCents: 500_000,
        expensesCents: 195_240,
        ebitdaCents: 304_760,
        ebitdaMargin: 304_760 / 500_000,
      },
      {
        month: "2026-07",
        incomeCents: 500_000,
        expensesCents: 180_000,
        ebitdaCents: 320_000,
        ebitdaMargin: 320_000 / 500_000,
      },
    ]);
    expect(result.incomeCents).toBe(1_000_000);
    expect(result.expensesCents).toBe(375_240);
    expect(result.ebitdaCents).toBe(624_760);
    expect(result.ebitdaMargin).toBeCloseTo(624_760 / 1_000_000);
    expect(result.averageMonthlyIncomeCents).toBe(500_000);
    expect(result.monthlyOverheadCents).toBe(Math.round(375_240 / 2));
  });

  it("returns nulls/zeros for an empty statement", () => {
    const result = computeIncomeStatementTotals([]);
    expect(result.pnl).toEqual([]);
    expect(result.incomeCents).toBe(0);
    expect(result.ebitdaMargin).toBeNull();
    expect(result.averageMonthlyIncomeCents).toBe(0);
    expect(result.monthlyOverheadCents).toBe(0);
  });

  it("gives a null ebitdaMargin for a month with zero income", () => {
    const result = computeIncomeStatementTotals([
      { month: "2026-06", account: "Expenses:Software", amountCents: -1_000 },
    ]);
    expect(result.pnl[0].ebitdaMargin).toBeNull();
  });
});

describe("computeRunwayMonths", () => {
  it("divides assets by monthly overhead", () => {
    expect(computeRunwayMonths(295_761, 204_239)).toBeCloseTo(1.4482, 3);
  });

  it("returns null when there is no overhead to divide by", () => {
    expect(computeRunwayMonths(100_000, 0)).toBeNull();
  });
});

describe("computeCreditFacilities", () => {
  const balances = [
    { account: "Liabilities:CreditCard:Visa", balanceCents: -50_000 },
    { account: "Assets:Bank:Everyday", balanceCents: 200_000 },
  ];

  it("computes drawn/headroom/utilization for mapped liabilities with a limit", () => {
    const facilities = computeCreditFacilities(
      [
        {
          accountId: "acc_visa",
          ledgerAccount: "Liabilities:CreditCard:Visa",
          creditLimitCents: 500_000,
        },
      ],
      balances,
    );
    expect(facilities).toEqual([
      {
        account: "Liabilities:CreditCard:Visa",
        accountId: "acc_visa",
        limitCents: 500_000,
        drawnCents: -50_000,
        headroomCents: 550_000,
        utilization: -0.1,
      },
    ]);
  });

  it("excludes mappings without a configured credit limit", () => {
    const facilities = computeCreditFacilities(
      [
        {
          accountId: "acc_checking",
          ledgerAccount: "Assets:Bank:Everyday",
          creditLimitCents: null,
        },
      ],
      balances,
    );
    expect(facilities).toEqual([]);
  });

  it("floors headroom at zero when fully drawn beyond the limit", () => {
    const facilities = computeCreditFacilities(
      [
        {
          accountId: "acc_visa",
          ledgerAccount: "Liabilities:CreditCard:Visa",
          creditLimitCents: 30_000,
        },
      ],
      [{ account: "Liabilities:CreditCard:Visa", balanceCents: 50_000 }],
    );
    expect(facilities[0].headroomCents).toBe(0);
  });
});

describe("computeCashCents", () => {
  it("sums only Assets accounts tagged as the cash tier", () => {
    const cashCents = computeCashCents([
      {
        account: "Assets:Bank:Everyday",
        accountType: "Assets",
        balanceCents: 200_000,
        liquidityTier: "cash",
      },
      {
        account: "Assets:Investments:Blossom",
        accountType: "Assets",
        balanceCents: 50_000,
        liquidityTier: "semi_liquid",
      },
      {
        account: "Liabilities:CreditCard",
        accountType: "Liabilities",
        balanceCents: -10_000,
        liquidityTier: "cash",
      },
    ]);
    expect(cashCents).toBe(200_000);
  });
});

describe("computeLiquidityTotals", () => {
  it("sums facility limits/headroom and adds headroom to cash", () => {
    const totals = computeLiquidityTotals(200_000, [
      {
        account: "Liabilities:CreditCard:Visa",
        accountId: "acc_visa",
        limitCents: 500_000,
        drawnCents: 50_000,
        headroomCents: 450_000,
        utilization: 0.1,
      },
    ]);
    expect(totals).toEqual({
      creditLimitCents: 500_000,
      creditHeadroomCents: 450_000,
      availableLiquidityCents: 650_000,
    });
  });

  it("returns cash-only availability with no facilities", () => {
    const totals = computeLiquidityTotals(200_000, []);
    expect(totals).toEqual({
      creditLimitCents: 0,
      creditHeadroomCents: 0,
      availableLiquidityCents: 200_000,
    });
  });
});

describe("computeAccountBreakdowns", () => {
  it("nets per-account totals across months, drops zero, sorts desc", () => {
    const { incomeBreakdown, expenseBreakdown } = computeAccountBreakdowns([
      { month: "2026-06", account: "Income:Salary", amountCents: 500_000 },
      { month: "2026-07", account: "Income:Salary", amountCents: 500_000 },
      { month: "2026-06", account: "Income:Freelance", amountCents: 20_000 },
      { month: "2026-06", account: "Expenses:Housing:Rent", amountCents: -180_000 },
      { month: "2026-07", account: "Expenses:Housing:Rent", amountCents: -180_000 },
      { month: "2026-06", account: "Expenses:Groceries", amountCents: -15_240 },
      // A wash account that nets to zero should be dropped entirely.
      { month: "2026-06", account: "Expenses:Refunded", amountCents: -5_000 },
      { month: "2026-07", account: "Expenses:Refunded", amountCents: 5_000 },
    ]);

    expect(incomeBreakdown).toEqual([
      { account: "Income:Salary", amountCents: 1_000_000 },
      { account: "Income:Freelance", amountCents: 20_000 },
    ]);
    expect(expenseBreakdown).toEqual([
      { account: "Expenses:Housing:Rent", amountCents: 360_000 },
      { account: "Expenses:Groceries", amountCents: 15_240 },
    ]);
  });

  it("returns empty breakdowns for no rows", () => {
    expect(computeAccountBreakdowns([])).toEqual({
      incomeBreakdown: [],
      expenseBreakdown: [],
    });
  });
});

describe("computeNetWorthTrend", () => {
  it("accumulates assets/liabilities month over month into a running net worth", () => {
    const trend = computeNetWorthTrend([
      // June: salary in, rent + groceries out of the same asset account.
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: 500_000 },
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: -180_000 },
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: -15_240 },
      // July: dining on credit card (liability increases).
      { month: "2026-07", account: "Assets:Bank:Everyday", amountCents: -8_000 },
      { month: "2026-07", account: "Liabilities:CreditCard:Visa", amountCents: -8_000 },
    ]);

    expect(trend).toEqual([
      {
        month: "2026-06",
        assetsCents: 304_760,
        liabilitiesCents: 0,
        netWorthCents: 304_760,
      },
      {
        month: "2026-07",
        assetsCents: 296_760,
        liabilitiesCents: 8_000,
        netWorthCents: 288_760,
      },
    ]);
  });

  it("returns an empty trend for no rows", () => {
    expect(computeNetWorthTrend([])).toEqual([]);
  });

  it("ignores accounts outside Assets:/Liabilities:", () => {
    const trend = computeNetWorthTrend([
      { month: "2026-06", account: "Income:Salary", amountCents: 500_000 },
      { month: "2026-06", account: "Assets:Bank:Everyday", amountCents: 100_000 },
    ]);
    expect(trend).toEqual([
      { month: "2026-06", assetsCents: 100_000, liabilitiesCents: 0, netWorthCents: 100_000 },
    ]);
  });
});

describe("computeRecentTransactions", () => {
  const rows = [
    // Same day as tx_rent — the externalId tiebreak decides relative order.
    {
      externalId: "tx_groceries",
      transactionDate: "2026-06-02",
      description: "COUNTDOWN SUPERMARKET",
      ruleId: "rule_groceries",
      account: "Expenses:Groceries",
      side: "debit" as const,
      amountCents: 15_240,
      currency: "NZD",
    },
    {
      externalId: "tx_groceries",
      transactionDate: "2026-06-02",
      description: "COUNTDOWN SUPERMARKET",
      ruleId: "rule_groceries",
      account: "Assets:Bank:Everyday",
      side: "credit" as const,
      amountCents: 15_240,
      currency: "NZD",
    },
    {
      externalId: "tx_rent",
      transactionDate: "2026-06-02",
      description: "CITY PROPERTY RENT",
      ruleId: "rule_rent",
      account: "Expenses:Housing:Rent",
      side: "debit" as const,
      amountCents: 180_000,
      currency: "NZD",
    },
    {
      externalId: "tx_rent",
      transactionDate: "2026-06-02",
      description: "CITY PROPERTY RENT",
      ruleId: "rule_rent",
      account: "Assets:Bank:Everyday",
      side: "credit" as const,
      amountCents: 180_000,
      currency: "NZD",
    },
    {
      externalId: "tx_salary",
      transactionDate: "2026-06-01",
      description: "ACME PAYROLL SALARY",
      ruleId: "rule_salary",
      account: "Assets:Bank:Everyday",
      side: "debit" as const,
      amountCents: 500_000,
      currency: "NZD",
    },
    {
      externalId: "tx_salary",
      transactionDate: "2026-06-01",
      description: "ACME PAYROLL SALARY",
      ruleId: "rule_salary",
      account: "Income:Salary",
      side: "credit" as const,
      amountCents: 500_000,
      currency: "NZD",
    },
  ];

  it("groups postings by externalId, newest-date first, with a stable tiebreak", () => {
    const transactions = computeRecentTransactions(rows, 12);
    expect(transactions.map((t) => t.externalId)).toEqual([
      "tx_groceries",
      "tx_rent",
      "tx_salary",
    ]);
    expect(transactions[0].postings).toHaveLength(2);
    expect(transactions[0].amountCents).toBe(0); // balanced double-entry nets to 0
    expect(transactions[2].description).toBe("ACME PAYROLL SALARY");
  });

  it("is insensitive to input row order (both backends can feed rows unsorted)", () => {
    const shuffled = [...rows].reverse();
    expect(computeRecentTransactions(shuffled, 12)).toEqual(
      computeRecentTransactions(rows, 12),
    );
  });

  it("limits to the requested count", () => {
    expect(computeRecentTransactions(rows, 2)).toHaveLength(2);
  });

  it("returns an empty list for no rows", () => {
    expect(computeRecentTransactions([], 12)).toEqual([]);
  });
});
