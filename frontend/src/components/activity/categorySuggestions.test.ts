import { describe, expect, it } from "vitest";
import { suggestCategories } from "./categorySuggestions";

const KNOWN = [
  "Assets:Bank:Everyday",
  "Liabilities:CreditCard",
  "Expenses:Groceries",
  "Expenses:Rent",
  "Expenses:Suspense",
  "Income:Salary",
];

describe("suggestCategories", () => {
  it("offers expense categories for money going out", () => {
    // Act
    const suggestions = suggestCategories({ knownAccounts: KNOWN, direction: "out" });

    // Assert
    expect(suggestions).toEqual(["Expenses:Groceries", "Expenses:Rent"]);
  });

  it("offers income categories for money coming in", () => {
    // Act
    const suggestions = suggestCategories({ knownAccounts: KNOWN, direction: "in" });

    // Assert
    expect(suggestions).toEqual(["Income:Salary"]);
  });

  it("never offers the suspense account or a balance account", () => {
    // Act
    const suggestions = suggestCategories({
      knownAccounts: KNOWN,
      direction: "out",
      limit: 10,
    });

    // Assert
    expect(suggestions).not.toContain("Expenses:Suspense");
    expect(suggestions).not.toContain("Assets:Bank:Everyday");
    expect(suggestions).not.toContain("Liabilities:CreditCard");
  });

  it("puts the most-used categories first", () => {
    // Arrange
    const usageOrder = ["Expenses:Rent"];

    // Act
    const suggestions = suggestCategories({
      knownAccounts: KNOWN,
      usageOrder,
      direction: "out",
    });

    // Assert
    expect(suggestions[0]).toBe("Expenses:Rent");
  });

  it("caps the list so the row stays one tap wide", () => {
    // Arrange
    const many = Array.from({ length: 12 }, (_, i) => `Expenses:Cat${i}`);

    // Act
    const suggestions = suggestCategories({ knownAccounts: many, direction: "out" });

    // Assert
    expect(suggestions).toHaveLength(4);
  });
});
