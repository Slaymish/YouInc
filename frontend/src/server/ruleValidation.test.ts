import { describe, expect, it } from "vitest";
import {
  assertValidRegex,
  normalizeRuleInput,
  normalizeRuleKey,
  RuleValidationError,
  type RuleInput,
} from "./ruleValidation";

function base(overrides: Partial<RuleInput> = {}): RuleInput {
  return {
    ruleKey: "My Rule",
    priority: 100,
    isEnabled: true,
    matchDescriptionRegex: "coffee",
    matchMerchantRegex: null,
    matchAmountGreaterThan: null,
    matchAmountAbsGreaterThan: null,
    targetAccount: "Expenses:Coffee",
    memo: null,
    ...overrides,
  };
}

describe("normalizeRuleKey", () => {
  it("lowercases and collapses non-alphanumerics to underscores", () => {
    expect(normalizeRuleKey("AI & Coding Tools!")).toBe("ai_coding_tools");
    expect(normalizeRuleKey("  Spark NZ  ")).toBe("spark_nz");
    expect(normalizeRuleKey("already_ok")).toBe("already_ok");
  });
});

describe("assertValidRegex", () => {
  it("accepts a plain pattern and a leading inline (?i) flag group", () => {
    expect(() => assertValidRegex("payroll|salary", "description")).not.toThrow();
    expect(() => assertValidRegex("(?i)spark|vodafone", "description")).not.toThrow();
  });

  it("ignores a null pattern", () => {
    expect(() => assertValidRegex(null, "description")).not.toThrow();
  });

  it("throws on an invalid regex", () => {
    expect(() => assertValidRegex("([unclosed", "merchant")).toThrow(RuleValidationError);
  });
});

describe("normalizeRuleInput", () => {
  it("normalizes the key and trims the target account", () => {
    const out = normalizeRuleInput(base({ ruleKey: "Coffee Rule", targetAccount: "  Expenses:Coffee  " }));
    expect(out.ruleKey).toBe("coffee_rule");
    expect(out.targetAccount).toBe("Expenses:Coffee");
  });

  it("requires a non-empty key", () => {
    expect(() => normalizeRuleInput(base({ ruleKey: "  !!  " }))).toThrow(/name/i);
  });

  it("requires a namespaced target account", () => {
    expect(() => normalizeRuleInput(base({ targetAccount: "Coffee" }))).toThrow(/namespaced/i);
  });

  it("requires at least one match condition", () => {
    expect(() =>
      normalizeRuleInput(
        base({ matchDescriptionRegex: null, matchMerchantRegex: null }),
      ),
    ).toThrow(/match condition/i);
  });

  it("accepts an amount-only condition (no regex)", () => {
    const out = normalizeRuleInput(
      base({ matchDescriptionRegex: null, matchAmountAbsGreaterThan: 1000 }),
    );
    expect(out.matchAmountAbsGreaterThan).toBe(1000);
  });

  it("rejects an invalid description regex", () => {
    expect(() => normalizeRuleInput(base({ matchDescriptionRegex: "([bad" }))).toThrow(
      /regular expression/i,
    );
  });
});
