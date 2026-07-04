import { describe, expect, it } from "vitest";
import { accountType } from "./accountType";

// The full DAL functions hit Supabase (integration-tested via the signup e2e);
// here we pin the pure classification helper that the net-worth math depends on,
// mirroring accountType() in server/ledger.ts so the two stay in lockstep.
describe("accountType", () => {
  it("takes the first ':'-segment of a namespaced account", () => {
    expect(accountType("Assets:Bank:Everyday")).toBe("Assets");
    expect(accountType("Liabilities:CreditCard")).toBe("Liabilities");
    expect(accountType("Income:Salary")).toBe("Income");
  });

  it("falls back to 'Other' for an unnamespaced account", () => {
    expect(accountType("Cash")).toBe("Other");
    expect(accountType("")).toBe("Other");
  });
});
