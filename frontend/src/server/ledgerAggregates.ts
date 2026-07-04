// Pure Phase-1 dashboard aggregation math, extracted VERBATIM from the inline
// logic in `readLedgerDashboard()` (server/ledger.ts). These functions take
// plain row arrays — no SQLite, no Supabase — so both the single-tenant
// SQLite dashboard AND the per-tenant Postgres workspace dashboard
// (workspacePnl.ts, workspaceLiquidity.ts) compute Phase-1 fields off the
// exact same code path. Do NOT re-express any of this as SQL: the
// differential parity test (see ledgerPostgresParity.integration.test.ts)
// exists specifically to catch drift if the two callers ever diverge on the
// rows they feed in.
export type LiquidityTier = "cash" | "semi_liquid" | "illiquid";

/** Verbatim from server/ledger.ts. Keep the two in lockstep. */
export function liquidityTierForAccount(account: string): LiquidityTier {
  if (
    account.startsWith("Assets:Bank:") ||
    account.startsWith("Assets:Treasury:") ||
    account.startsWith("Assets:Internal:")
  ) {
    return "cash";
  }
  if (account === "Assets:Investments:Sharesies:Spend") {
    return "cash";
  }
  if (
    account.startsWith("Assets:Investments:Blossom") ||
    // Confirmed: withdrawal from Sharesies Emergencies takes a couple of days.
    account === "Assets:Investments:Sharesies:Emergencies"
  ) {
    return "semi_liquid";
  }
  return "illiquid";
}

export interface PnlRow {
  month: string;
  incomeCents: number;
  expensesCents: number;
  ebitdaCents: number;
  ebitdaMargin: number | null;
}

/**
 * One (month, account) net-amount bucket, credit-positive/debit-negative,
 * ALREADY aggregated per account per month by the caller's query. This is
 * the exact shape the SQLite `incomeStatement` query rows are mapped into,
 * and what the Postgres fetch must reproduce bit-for-bit (sign convention +
 * grouping) before calling this function.
 */
export interface IncomeStatementRow {
  month: string;
  account: string;
  amountCents: number;
}

export interface IncomeStatementTotals {
  pnl: PnlRow[];
  incomeCents: number;
  expensesCents: number;
  ebitdaCents: number;
  ebitdaMargin: number | null;
  averageMonthlyIncomeCents: number;
  monthlyOverheadCents: number;
}

export function computeIncomeStatementTotals(
  rows: readonly IncomeStatementRow[],
): IncomeStatementTotals {
  const monthly = rows.reduce<
    Record<string, { incomeCents: number; expensesCents: number }>
  >((months, row) => {
    const bucket = months[row.month] ?? { incomeCents: 0, expensesCents: 0 };
    if (row.account.startsWith("Income:")) {
      bucket.incomeCents += row.amountCents;
    }
    if (row.account.startsWith("Expenses:")) {
      bucket.expensesCents += -row.amountCents;
    }
    months[row.month] = bucket;
    return months;
  }, {});

  const pnl = Object.entries(monthly)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, values]) => {
      const ebitdaCents = values.incomeCents - values.expensesCents;
      return {
        month,
        incomeCents: values.incomeCents,
        expensesCents: values.expensesCents,
        ebitdaCents,
        ebitdaMargin: values.incomeCents
          ? ebitdaCents / values.incomeCents
          : null,
      };
    });

  const incomeCents = pnl.reduce((total, month) => total + month.incomeCents, 0);
  const expensesCents = pnl.reduce(
    (total, month) => total + month.expensesCents,
    0,
  );
  const ebitdaCents = incomeCents - expensesCents;
  const averageMonthlyIncomeCents = pnl.length
    ? Math.round(incomeCents / pnl.length)
    : 0;
  const monthlyOverheadCents = pnl.length
    ? Math.round(expensesCents / pnl.length)
    : 0;

  return {
    pnl,
    incomeCents,
    expensesCents,
    ebitdaCents,
    ebitdaMargin: incomeCents ? ebitdaCents / incomeCents : null,
    averageMonthlyIncomeCents,
    monthlyOverheadCents,
  };
}

/** Verbatim from server/ledger.ts: assetsCents / monthlyOverheadCents, or null. */
export function computeRunwayMonths(
  assetsCents: number,
  monthlyOverheadCents: number,
): number | null {
  return monthlyOverheadCents ? assetsCents / monthlyOverheadCents : null;
}

export interface CreditFacilityRow {
  account: string;
  accountId: string | null;
  limitCents: number | null;
  drawnCents: number;
  headroomCents: number | null;
  utilization: number | null;
}

/** A liability account mapping that may carry a revolving credit limit. */
export interface CreditFacilityMapping {
  accountId: string;
  ledgerAccount: string;
  creditLimitCents: number | null;
}

export interface BalanceLike {
  account: string;
  balanceCents: number;
}

/**
 * Revolving credit facilities: liability accounts with a configured credit
 * limit are treated as float, not just debt. Headroom (limit - drawn) is
 * available short-term liquidity, distinct from net worth, which still fully
 * reflects the drawn balance as a liability. Verbatim from server/ledger.ts.
 */
export function computeCreditFacilities(
  mappings: readonly CreditFacilityMapping[],
  balances: readonly BalanceLike[],
): CreditFacilityRow[] {
  return mappings
    .filter((mapping) => mapping.creditLimitCents !== null)
    .map((mapping) => {
      const drawnCents = balances
        .filter((row) => row.account === mapping.ledgerAccount)
        .reduce((sum, row) => sum + row.balanceCents, 0);
      const limitCents = mapping.creditLimitCents;
      const headroomCents =
        limitCents !== null ? Math.max(0, limitCents - drawnCents) : null;
      const utilization = limitCents ? drawnCents / limitCents : null;
      return {
        account: mapping.ledgerAccount,
        accountId: mapping.accountId,
        limitCents,
        drawnCents,
        headroomCents,
        utilization,
      };
    });
}

export interface LiquidityBalance extends BalanceLike {
  accountType: string;
  liquidityTier: LiquidityTier;
}

/** Verbatim from server/ledger.ts: sum of Assets balances tagged "cash". */
export function computeCashCents(balances: readonly LiquidityBalance[]): number {
  return balances
    .filter(
      (row) => row.accountType === "Assets" && row.liquidityTier === "cash",
    )
    .reduce((sum, row) => sum + row.balanceCents, 0);
}

export interface LiquidityTotals {
  creditLimitCents: number;
  creditHeadroomCents: number;
  availableLiquidityCents: number;
}

/** Verbatim from server/ledger.ts: facility roll-ups + cash-plus-headroom. */
export function computeLiquidityTotals(
  cashCents: number,
  creditFacilities: readonly CreditFacilityRow[],
): LiquidityTotals {
  const creditLimitCents = creditFacilities.reduce(
    (sum, facility) => sum + (facility.limitCents ?? 0),
    0,
  );
  const creditHeadroomCents = creditFacilities.reduce(
    (sum, facility) => sum + (facility.headroomCents ?? 0),
    0,
  );
  return {
    creditLimitCents,
    creditHeadroomCents,
    availableLiquidityCents: cashCents + creditHeadroomCents,
  };
}

// ── Phase 2+3: account breakdowns, net-worth trend, recent transactions ────
// Extracted verbatim from the inline logic in `readLedgerDashboard()` so both
// the SQLite dashboard and the per-tenant Postgres workspace dashboard
// (workspaceBreakdowns.ts, workspaceTrends.ts, workspaceTransactions.ts)
// compute these fields off the exact same code path.

export interface AccountTotal {
  account: string;
  amountCents: number;
}

/**
 * Per-account income/expense totals (ignoring month), sorted desc. Operates
 * on the SAME `IncomeStatementRow[]` shape `computeIncomeStatementTotals`
 * consumes — summing is associative, so pre-grouped-by-(month,account) SQL
 * rows or raw per-entry rows both produce identical totals here.
 */
export function computeAccountBreakdowns(
  rows: readonly IncomeStatementRow[],
): { incomeBreakdown: AccountTotal[]; expenseBreakdown: AccountTotal[] } {
  const incomeTotals = new Map<string, number>();
  const expenseTotals = new Map<string, number>();
  for (const row of rows) {
    if (row.account.startsWith("Income:")) {
      incomeTotals.set(
        row.account,
        (incomeTotals.get(row.account) ?? 0) + row.amountCents,
      );
    } else if (row.account.startsWith("Expenses:")) {
      expenseTotals.set(
        row.account,
        (expenseTotals.get(row.account) ?? 0) - row.amountCents,
      );
    }
  }

  const toSortedTotals = (totals: Map<string, number>): AccountTotal[] =>
    Array.from(totals.entries())
      .map(([account, amountCents]) => ({ account, amountCents }))
      .filter((row) => row.amountCents !== 0)
      .sort((a, b) => b.amountCents - a.amountCents);

  return {
    incomeBreakdown: toSortedTotals(incomeTotals),
    expenseBreakdown: toSortedTotals(expenseTotals),
  };
}

export interface NetWorthPoint {
  month: string;
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
}

/**
 * One journal entry contributing to net worth: `amountCents` is ALREADY
 * signed in the balance convention (debit-positive / credit-negative), the
 * same convention `computeCashCents` / balances use. Rows may be raw
 * per-entry (one per posting) or pre-summed per (month, account) — summing
 * is associative, so either works identically.
 */
export interface NetWorthEntryRow {
  month: string;
  account: string;
  amountCents: number;
}

/**
 * Buckets Assets:/Liabilities: deltas by month, then walks months in order
 * accumulating a running (cumulative) assets/liabilities balance so each
 * point is a net-worth snapshot as of that month, not a monthly delta.
 * Verbatim from server/ledger.ts.
 */
export function computeNetWorthTrend(
  rows: readonly NetWorthEntryRow[],
): NetWorthPoint[] {
  const byMonth = new Map<string, { assetsDelta: number; liabilitiesDelta: number }>();
  for (const row of rows) {
    const bucket = byMonth.get(row.month) ?? { assetsDelta: 0, liabilitiesDelta: 0 };
    if (row.account.startsWith("Assets:")) {
      bucket.assetsDelta += row.amountCents;
    } else if (row.account.startsWith("Liabilities:")) {
      bucket.liabilitiesDelta += row.amountCents;
    }
    byMonth.set(row.month, bucket);
  }

  const months = Array.from(byMonth.keys()).sort((a, b) => a.localeCompare(b));

  let cumulativeAssets = 0;
  let cumulativeLiabilitiesSigned = 0;
  return months.map((month) => {
    const bucket = byMonth.get(month)!;
    cumulativeAssets += bucket.assetsDelta;
    cumulativeLiabilitiesSigned += bucket.liabilitiesDelta;
    // `|| 0` normalizes -0 (from `-0` when the running signed total is
    // exactly zero) to a plain 0 so equality checks and UI formatting never
    // see a negative-zero value.
    const liabilitiesCents = -cumulativeLiabilitiesSigned || 0;
    return {
      month,
      assetsCents: cumulativeAssets,
      liabilitiesCents,
      netWorthCents: cumulativeAssets - liabilitiesCents,
    };
  });
}

export interface JournalPosting {
  account: string;
  side: "debit" | "credit";
  amountCents: number;
}

export interface JournalTransactionRow {
  externalId: string;
  transactionDate: string;
  description: string;
  ruleId: string | null;
  amountCents: number;
  currency: string;
  postings: JournalPosting[];
}

/** One posting row, already mapped into camelCase. */
export interface JournalEntryDetailRow {
  externalId: string;
  transactionDate: string;
  description: string;
  ruleId: string | null;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
  currency: string;
}

/**
 * Groups postings by `externalId` into reconstructed double-entry
 * transactions, newest first, limited to `limit`. Rows are sorted internally
 * (by transaction date desc, then externalId, then account) rather than
 * relying on the caller's fetch order — SQLite and Postgres have different
 * native row-ordering guarantees (no sequential id in Postgres), so the sort
 * happens here to keep the two backends deterministic and comparable.
 */
export function computeRecentTransactions(
  rows: readonly JournalEntryDetailRow[],
  limit = 12,
): JournalTransactionRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.transactionDate !== b.transactionDate) {
      return b.transactionDate.localeCompare(a.transactionDate);
    }
    if (a.externalId !== b.externalId) {
      return a.externalId.localeCompare(b.externalId);
    }
    return a.account.localeCompare(b.account);
  });

  const grouped = new Map<string, JournalTransactionRow>();
  for (const row of sorted) {
    const amountCents = row.side === "debit" ? row.amountCents : -row.amountCents;
    const existing = grouped.get(row.externalId);
    if (existing) {
      existing.postings.push({
        account: row.account,
        side: row.side,
        amountCents: row.amountCents,
      });
      existing.amountCents += amountCents;
      continue;
    }
    grouped.set(row.externalId, {
      externalId: row.externalId,
      transactionDate: row.transactionDate,
      description: row.description,
      ruleId: row.ruleId,
      amountCents,
      currency: row.currency,
      postings: [
        { account: row.account, side: row.side, amountCents: row.amountCents },
      ],
    });
  }

  return Array.from(grouped.values()).slice(0, limit);
}
