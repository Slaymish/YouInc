// Pure account classification helper, kept dependency-free so it can be unit
// tested without pulling in the Supabase server client (the vitest config
// deliberately omits the app's Vite plugins, so `~/` aliases and
// `import.meta.env` do not resolve in tests).
//
// The "type" of a ledger account is the first ":"-segment of its path — e.g.
// "Assets:Bank:Everyday" -> "Assets". Mirrors accountType() in server/ledger.ts;
// the two must stay in lockstep.
export function accountType(account: string): string {
  return account.includes(":") ? account.split(":", 1)[0] : "Other";
}
