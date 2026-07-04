// Pure summary math for the self-service workspace ledger. Kept dependency-free
// (no Supabase, no `~/` aliases) so it can be unit-tested under the plugin-free
// vitest config — the Postgres reads live in workspaceLedger.ts and call this.
//
// Reproduces the exact conventions of the single-tenant SQLite dashboard
// (server/ledger.ts): journal balances sum debit-positive / credit-negative;
// a manual balance SUPERSEDES the journal-derived balance for the same account
// AND any journal-derived parent prefix (e.g. a manual "Assets:Investments:
// Sharesies:Spend" overrides journal "Assets:Investments:Sharesies"); assets
// are positive, liabilities negative, net worth = assets - liabilities.
import { accountType } from "./accountType";

export interface AccountBalance {
  account: string;
  accountType: string;
  balanceCents: number;
  /** True when the balance came from a manual entry rather than the journal. */
  isManual: boolean;
}

export interface LedgerTotals {
  netWorthCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  assetLiabilityRatio: number | null;
  accountCount: number;
}

export interface JournalBalanceInput {
  account: string;
  balanceCents: number;
}
export interface ManualBalanceInput {
  account: string;
  balanceCents: number;
}

/** Every ancestor prefix of a ":"-namespaced account (excluding the leaf). */
function parentPrefixes(account: string): string[] {
  const parts = account.split(":");
  const prefixes: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    prefixes.push(parts.slice(0, i).join(":"));
  }
  return prefixes;
}

/**
 * Merge journal-derived balances with manual balances, applying the
 * manual-supersedes-journal(-and-parents) rule, and return the combined
 * per-account balances plus the rolled-up totals. Both inputs are keyed by
 * ledger account; manual balances win.
 */
export function combineBalances(
  journal: ReadonlyArray<JournalBalanceInput>,
  manual: ReadonlyArray<ManualBalanceInput>,
): { balances: AccountBalance[]; totals: LedgerTotals } {
  const manualAccounts = new Set(manual.map((m) => m.account));
  const manualParentPrefixes = new Set<string>();
  for (const m of manual) {
    for (const prefix of parentPrefixes(m.account)) manualParentPrefixes.add(prefix);
  }

  const balances: AccountBalance[] = [
    ...journal
      .filter((j) => !manualAccounts.has(j.account) && !manualParentPrefixes.has(j.account))
      .map((j) => ({
        account: j.account,
        accountType: accountType(j.account),
        balanceCents: j.balanceCents,
        isManual: false,
      })),
    ...manual.map((m) => ({
      account: m.account,
      accountType: accountType(m.account),
      balanceCents: m.balanceCents,
      isManual: true,
    })),
  ].sort((a, b) => a.account.localeCompare(b.account));

  const totalsByType = balances.reduce<Record<string, number>>((totals, row) => {
    totals[row.accountType] = (totals[row.accountType] ?? 0) + row.balanceCents;
    return totals;
  }, {});

  const assetsCents = totalsByType.Assets ?? 0;
  const liabilitiesCents = totalsByType.Liabilities ? -totalsByType.Liabilities : 0;
  const netWorthCents = assetsCents - liabilitiesCents;
  const assetLiabilityRatio = liabilitiesCents !== 0 ? assetsCents / liabilitiesCents : null;

  return {
    balances,
    totals: {
      netWorthCents,
      assetsCents,
      liabilitiesCents,
      assetLiabilityRatio,
      accountCount: balances.length,
    },
  };
}
