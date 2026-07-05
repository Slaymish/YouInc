import { describe, it, expect } from "vitest";
import {
  stepRank,
  canTransition,
  firstStep,
  isValidEmail,
  normalizeEmail,
  SIGNUP_STEPS,
  SIGNIN_STEPS,
} from "./authFlowSteps";

describe("stepRank", () => {
  it("ranks signup steps in order", () => {
    expect(stepRank("signup", "email")).toBe(0);
    expect(stepRank("signup", "name")).toBe(1);
    expect(stepRank("signup", "credential")).toBe(2);
    expect(stepRank("signup", "password")).toBe(3);
  });

  it("ranks signin steps in order", () => {
    expect(stepRank("signin", "email")).toBe(0);
    expect(stepRank("signin", "password")).toBe(1);
  });

  it("returns null for steps that don't belong to the kind", () => {
    expect(stepRank("signin", "credential")).toBeNull();
    expect(stepRank("signin", "name")).toBeNull();
    expect(stepRank("signup", "bogus")).toBeNull();
  });
});

describe("firstStep", () => {
  it("is always email", () => {
    expect(firstStep("signup")).toBe("email");
    expect(firstStep("signin")).toBe("email");
  });
});

describe("canTransition", () => {
  it("allows advancing exactly one step", () => {
    expect(canTransition("signup", "email", "name")).toBe(true);
    expect(canTransition("signup", "credential", "password")).toBe(true);
    expect(canTransition("signin", "email", "password")).toBe(true);
  });

  it("allows staying or going back", () => {
    expect(canTransition("signup", "name", "name")).toBe(true);
    expect(canTransition("signup", "credential", "name")).toBe(true);
    expect(canTransition("signup", "password", "email")).toBe(true);
  });

  it("forbids skipping ahead more than one step", () => {
    expect(canTransition("signup", "email", "credential")).toBe(false);
    expect(canTransition("signup", "email", "password")).toBe(false);
    expect(canTransition("signup", "name", "password")).toBe(false);
  });

  it("forbids transitions to steps invalid for the kind", () => {
    expect(canTransition("signin", "email", "credential")).toBe(false);
    expect(canTransition("signup", "email", "nope")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts well-formed addresses", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("  ada@example.com ")).toBe(true);
  });

  it("rejects malformed addresses", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("returns null for blank input", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});

describe("step constants", () => {
  it("expose the canonical step orderings", () => {
    expect([...SIGNUP_STEPS]).toEqual([
      "email",
      "name",
      "credential",
      "password",
    ]);
    expect([...SIGNIN_STEPS]).toEqual(["email", "password"]);
  });
});
