import { describe, expect, it } from "vitest";
import {
  centsToDollarsInput,
  dollarsToCents,
  normalizeAccountMappingInput,
  AccountMappingValidationError,
  type AccountMappingInput,
} from "./accountMappingValidation";

function base(overrides: Partial<AccountMappingInput> = {}): AccountMappingInput {
  return {
    akahuAccountId: "acc_123",
    ledgerAccount: "Assets:Bank:Everyday",
    accountType: "asset",
    creditLimitCents: null,
    ...overrides,
  };
}

describe("dollarsToCents / centsToDollarsInput", () => {
  it("round-trips whole and fractional dollar amounts", () => {
    expect(dollarsToCents(1250)).toBe(125000);
    expect(dollarsToCents(19.999)).toBe(2000);
    expect(centsToDollarsInput(125000)).toBe("1250.00");
    expect(centsToDollarsInput(2050)).toBe("20.50");
  });
});

describe("normalizeAccountMappingInput", () => {
  it("trims the akahu account id and ledger account", () => {
    const out = normalizeAccountMappingInput(
      base({ akahuAccountId: "  acc_123  ", ledgerAccount: "  Assets:Bank  " }),
    );
    expect(out.akahuAccountId).toBe("acc_123");
    expect(out.ledgerAccount).toBe("Assets:Bank");
  });

  it("requires a non-empty akahu account id", () => {
    expect(() => normalizeAccountMappingInput(base({ akahuAccountId: "   " }))).toThrow(
      /akahu account/i,
    );
  });

  it("requires a namespaced ledger account", () => {
    expect(() => normalizeAccountMappingInput(base({ ledgerAccount: "Checking" }))).toThrow(
      /namespaced/i,
    );
  });

  it("rejects an invalid account type", () => {
    expect(() =>
      normalizeAccountMappingInput(
        base({ accountType: "other" as AccountMappingInput["accountType"] }),
      ),
    ).toThrow(AccountMappingValidationError);
  });

  it("drops the credit limit for asset accounts even if provided", () => {
    const out = normalizeAccountMappingInput(
      base({ accountType: "asset", creditLimitCents: 500000 }),
    );
    expect(out.creditLimitCents).toBeNull();
  });

  it("keeps a valid credit limit for liability accounts", () => {
    const out = normalizeAccountMappingInput(
      base({ accountType: "liability", creditLimitCents: 500000 }),
    );
    expect(out.creditLimitCents).toBe(500000);
  });

  it("rejects a negative credit limit", () => {
    expect(() =>
      normalizeAccountMappingInput(
        base({ accountType: "liability", creditLimitCents: -100 }),
      ),
    ).toThrow(/positive/i);
  });
});
