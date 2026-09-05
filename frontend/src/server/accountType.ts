// Derive account type from its ledger path.
export function accountType(account: string): string {
  return account.includes(":") ? account.split(":", 1)[0] : "Other";
}
