import { describe, expect, it } from "vitest";
import { combineBalances } from "./workspaceSummary";

describe("combineBalances", () => {
  it("sums assets positive, liabilities negative, and derives net worth", () => {
    const { totals } = combineBalances(
      [],
      [
        { account: "Assets:Bank:Everyday", balanceCents: 1_250_000 },
        { account: "Liabilities:CreditCard", balanceCents: -250_000 },
      ],
    );
    expect(totals.assetsCents).toBe(1_250_000);
    expect(totals.liabilitiesCents).toBe(250_000); // surfaced as positive magnitude
    expect(totals.netWorthCents).toBe(1_000_000);
    expect(totals.assetLiabilityRatio).toBeCloseTo(5);
    expect(totals.accountCount).toBe(2);
  });

  it("has a null asset/liability ratio when there are no liabilities", () => {
    const { totals } = combineBalances([{ account: "Assets:Cash", balanceCents: 500 }], []);
    expect(totals.assetLiabilityRatio).toBeNull();
  });

  it("combines journal-derived and manual balances", () => {
    const { balances, totals } = combineBalances(
      [{ account: "Assets:Bank:Everyday", balanceCents: 300_000 }],
      [{ account: "Assets:Investments:Sharesies", balanceCents: 700_000 }],
    );
    expect(totals.assetsCents).toBe(1_000_000);
    expect(balances.find((b) => b.account === "Assets:Bank:Everyday")?.isManual).toBe(false);
    expect(balances.find((b) => b.account === "Assets:Investments:Sharesies")?.isManual).toBe(true);
  });

  it("lets a manual balance supersede the same journal account", () => {
    const { balances, totals } = combineBalances(
      [{ account: "Assets:Bank:Everyday", balanceCents: 100_000 }],
      [{ account: "Assets:Bank:Everyday", balanceCents: 999_999 }],
    );
    // Only the manual value counts; the journal one is dropped.
    expect(totals.assetsCents).toBe(999_999);
    expect(balances).toHaveLength(1);
    expect(balances[0].isManual).toBe(true);
  });

  it("lets a manual child supersede a journal-derived PARENT prefix", () => {
    // Journal has the parent; manual has a child under it → parent is dropped so
    // the balance is not double-counted (mirrors the SQLite dashboard rule).
    const { balances, totals } = combineBalances(
      [{ account: "Assets:Investments:Sharesies", balanceCents: 500_000 }],
      [{ account: "Assets:Investments:Sharesies:Spend", balanceCents: 120_000 }],
    );
    expect(totals.assetsCents).toBe(120_000);
    expect(balances.map((b) => b.account)).toEqual(["Assets:Investments:Sharesies:Spend"]);
  });

  it("sorts combined balances by account name", () => {
    const { balances } = combineBalances(
      [{ account: "Assets:Zeta", balanceCents: 1 }],
      [{ account: "Assets:Alpha", balanceCents: 1 }],
    );
    expect(balances.map((b) => b.account)).toEqual(["Assets:Alpha", "Assets:Zeta"]);
  });
});
