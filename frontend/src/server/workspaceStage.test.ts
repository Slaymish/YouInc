import { describe, expect, it } from "vitest";
import { isFirstRun, workspaceStage } from "./workspaceStage";

describe("workspaceStage", () => {
  it("is 'empty' with no accounts and no journal balances", () => {
    expect(
      workspaceStage({ accountCount: 0, hasJournalBalances: false }),
    ).toBe("empty");
  });

  it("is 'has-accounts' with manual accounts but no journal balances", () => {
    expect(
      workspaceStage({ accountCount: 3, hasJournalBalances: false }),
    ).toBe("has-accounts");
  });

  it("is 'synced' whenever journal balances exist", () => {
    expect(
      workspaceStage({ accountCount: 5, hasJournalBalances: true }),
    ).toBe("synced");
  });

  it("prefers 'synced' over 'has-accounts' even with zero counted accounts", () => {
    // Journal balances can exist before the manual account count reflects them.
    expect(
      workspaceStage({ accountCount: 0, hasJournalBalances: true }),
    ).toBe("synced");
  });
});

describe("isFirstRun", () => {
  it("is true only for the empty stage", () => {
    expect(isFirstRun({ accountCount: 0, hasJournalBalances: false })).toBe(
      true,
    );
    expect(isFirstRun({ accountCount: 1, hasJournalBalances: false })).toBe(
      false,
    );
    expect(isFirstRun({ accountCount: 0, hasJournalBalances: true })).toBe(
      false,
    );
  });
});
