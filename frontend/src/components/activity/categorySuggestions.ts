// Which categories to offer as one-tap buttons for an unsorted transaction.
// Pure, so the ranking is unit-tested rather than eyeballed.

/** Accounts money sits in — never a category for something you spent on. */
const BALANCE_PREFIXES = ["Assets:", "Liabilities:", "Equity:"];

function isCategoryAccount(account: string): boolean {
  return !BALANCE_PREFIXES.some((prefix) => account.startsWith(prefix));
}

function isSuspense(account: string): boolean {
  return /(^|:)suspense/i.test(account);
}

/**
 * Money going out is an expense; money coming in is income. Offering "Salary"
 * for a supermarket payment is the kind of thing that makes people distrust the
 * whole screen, so direction filters the list before ranking.
 */
function matchesDirection(account: string, direction: "in" | "out"): boolean {
  const isIncome = account.startsWith("Income:");
  return direction === "in" ? isIncome : !isIncome;
}

export interface SuggestionInput {
  /** Every account the ledger already knows about. */
  knownAccounts: readonly string[];
  /** Category accounts already used, most-used first — drives the ranking. */
  usageOrder?: readonly string[];
  direction: "in" | "out";
  limit?: number;
}

/**
 * Ranks by how often the category has already been used, then alphabetically so
 * the buttons don't reshuffle between renders for no reason.
 */
export function suggestCategories({
  knownAccounts,
  usageOrder = [],
  direction,
  limit = 4,
}: SuggestionInput): string[] {
  const rank = new Map<string, number>();
  usageOrder.forEach((account, index) => {
    if (!rank.has(account)) rank.set(account, index);
  });

  return knownAccounts
    .filter(
      (account) =>
        isCategoryAccount(account) &&
        !isSuspense(account) &&
        matchesDirection(account, direction),
    )
    .sort((a, b) => {
      const rankA = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB || a.localeCompare(b);
    })
    .slice(0, limit);
}
