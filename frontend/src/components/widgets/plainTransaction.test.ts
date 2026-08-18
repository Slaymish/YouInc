import { describe, expect, it } from "vitest";
import { sortPlainTransactions, toPlainTransaction } from "./plainTransaction";

const groceries = {
  externalId: "t1",
  transactionDate: "2026-08-01",
  description: "COUNTDOWN WELLINGTON",
  postings: [
    { account: "Expenses:Groceries", side: "debit" as const, amountCents: 15240 },
    { account: "Assets:Bank:Everyday", side: "credit" as const, amountCents: 15240 },
  ],
};

describe("toPlainTransaction", () => {
  it("reads the category off the non-balance leg", () => {
    // Act
    const plain = toPlainTransaction(groceries);

    // Assert
    expect(plain.category).toBe("Groceries");
    expect(plain.categoryAccount).toBe("Expenses:Groceries");
    expect(plain.amountCents).toBe(15240);
    expect(plain.direction).toBe("out");
    expect(plain.needsCategory).toBe(false);
  });

  it("treats a credit to income as money arriving", () => {
    // Arrange
    const salary = {
      ...groceries,
      description: "SALARY",
      postings: [
        { account: "Income:Salary", side: "credit" as const, amountCents: 500000 },
        { account: "Assets:Bank:Everyday", side: "debit" as const, amountCents: 500000 },
      ],
    };

    // Act
    const plain = toPlainTransaction(salary);

    // Assert
    expect(plain.direction).toBe("in");
    expect(plain.category).toBe("Salary");
  });

  it("flags a suspense posting as needing a category, and shows none", () => {
    // Arrange
    const unsorted = {
      ...groceries,
      description: "ATM WITHDRAWAL QUEEN STREET",
      postings: [
        { account: "Expenses:Suspense", side: "debit" as const, amountCents: 4000 },
        { account: "Assets:Bank:Everyday", side: "credit" as const, amountCents: 4000 },
      ],
    };

    // Act
    const plain = toPlainTransaction(unsorted);

    // Assert
    expect(plain.needsCategory).toBe(true);
    expect(plain.category).toBeNull();
  });

  it("has no category for a transfer between your own accounts", () => {
    // Arrange
    const transfer = {
      ...groceries,
      description: "TO SAVINGS",
      postings: [
        { account: "Assets:Bank:Savings", side: "debit" as const, amountCents: 20000 },
        { account: "Assets:Bank:Everyday", side: "credit" as const, amountCents: 20000 },
      ],
    };

    // Act
    const plain = toPlainTransaction(transfer);

    // Assert
    expect(plain.category).toBeNull();
    expect(plain.amountCents).toBe(20000);
    expect(plain.direction).toBe("out");
  });
});

describe("sortPlainTransactions", () => {
  it("puts the newest first and breaks ties on description", () => {
    // Arrange
    const rows = [
      toPlainTransaction({ ...groceries, transactionDate: "2026-08-01", description: "B" }),
      toPlainTransaction({ ...groceries, transactionDate: "2026-08-03", description: "C" }),
      toPlainTransaction({ ...groceries, transactionDate: "2026-08-01", description: "A" }),
    ];

    // Act
    const sorted = sortPlainTransactions(rows);

    // Assert
    expect(sorted.map((r) => r.description)).toEqual(["C", "A", "B"]);
  });
});
