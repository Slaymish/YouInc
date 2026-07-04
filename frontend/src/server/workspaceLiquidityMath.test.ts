import { describe, expect, it } from "vitest";
import {
  annotateLiquidityTier,
  computeWorkspaceLiquidity,
} from "./workspaceLiquidityMath";

describe("annotateLiquidityTier", () => {
  it("tags each combined balance with its liquidity tier and the tenant currency", () => {
    const rows = annotateLiquidityTier(
      [
        {
          account: "Assets:Bank:Everyday",
          accountType: "Assets",
          balanceCents: 295_761,
          isManual: false,
        },
        {
          account: "Assets:Investments:Blossom:Growth",
          accountType: "Assets",
          balanceCents: 10_000,
          isManual: true,
        },
        {
          account: "Assets:Property:House",
          accountType: "Assets",
          balanceCents: 500_000,
          isManual: true,
        },
      ],
      "NZD",
    );

    expect(rows).toEqual([
      {
        account: "Assets:Bank:Everyday",
        accountType: "Assets",
        balanceCents: 295_761,
        isManual: false,
        currency: "NZD",
        liquidityTier: "cash",
      },
      {
        account: "Assets:Investments:Blossom:Growth",
        accountType: "Assets",
        balanceCents: 10_000,
        isManual: true,
        currency: "NZD",
        liquidityTier: "semi_liquid",
      },
      {
        account: "Assets:Property:House",
        accountType: "Assets",
        balanceCents: 500_000,
        isManual: true,
        currency: "NZD",
        liquidityTier: "illiquid",
      },
    ]);
  });
});

describe("computeWorkspaceLiquidity", () => {
  it("combines mappings + annotated balances into Phase-1 liquidity fields", () => {
    const balances = annotateLiquidityTier(
      [
        {
          account: "Assets:Bank:Everyday",
          accountType: "Assets",
          balanceCents: 200_000,
          isManual: false,
        },
        {
          account: "Liabilities:CreditCard:Visa",
          accountType: "Liabilities",
          balanceCents: 50_000,
          isManual: false,
        },
      ],
      "NZD",
    );

    const liquidity = computeWorkspaceLiquidity(
      [
        {
          accountId: "acc_visa",
          ledgerAccount: "Liabilities:CreditCard:Visa",
          creditLimitCents: 500_000,
        },
      ],
      balances,
    );

    expect(liquidity.cashCents).toBe(200_000);
    expect(liquidity.creditFacilities).toEqual([
      {
        account: "Liabilities:CreditCard:Visa",
        accountId: "acc_visa",
        limitCents: 500_000,
        drawnCents: 50_000,
        headroomCents: 450_000,
        utilization: 0.1,
      },
    ]);
    expect(liquidity.creditLimitCents).toBe(500_000);
    expect(liquidity.creditHeadroomCents).toBe(450_000);
    expect(liquidity.availableLiquidityCents).toBe(650_000);
  });

  it("is cash-only when there are no liability mappings", () => {
    const balances = annotateLiquidityTier(
      [
        {
          account: "Assets:Bank:Everyday",
          accountType: "Assets",
          balanceCents: 100_000,
          isManual: false,
        },
      ],
      "NZD",
    );
    const liquidity = computeWorkspaceLiquidity([], balances);
    expect(liquidity.creditFacilities).toEqual([]);
    expect(liquidity.availableLiquidityCents).toBe(100_000);
  });
});
