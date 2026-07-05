// ── Recurring & subscriptions ──────────────────────────────────────────────

export type RecurringCadence = "weekly" | "fortnightly" | "monthly";

export interface RecurringPayment {
  /** Representative display description for the group. */
  description: string;
  /** Primary expense category the group posts to. */
  account: string;
  /** Median amount across occurrences, in cents. */
  amountCents: number;
  occurrences: number;
  /** Average gap between consecutive payments, in days. */
  cadenceDays: number;
  cadence: RecurringCadence;
  /** Amount normalised to a monthly figure for the committed-spend total. */
  monthlyEquivalentCents: number;
  firstDate: string;
  lastDate: string;
}

export type RecurringQueryRow = {
  date: string;
  description: string;
  account: string | null;
  spend_cents: number | null;
};

// Subscriptions repeat on a fairly tight cadence. These windows (in days)
// classify the average gap between consecutive payments; anything outside the
// monthly window is treated as discretionary and excluded.
const CADENCE_WINDOWS: Array<{
  cadence: RecurringCadence;
  min: number;
  max: number;
  perMonth: number;
}> = [
  { cadence: "weekly", min: 5, max: 10, perMonth: 52 / 12 },
  { cadence: "fortnightly", min: 11, max: 20, perMonth: 26 / 12 },
  { cadence: "monthly", min: 21, max: 45, perMonth: 1 },
];

const MIN_OCCURRENCES = 2;
// A clean subscription has near-identical amounts. Reject noisy groups (e.g.
// groceries under one merchant) whose amounts vary too much to be a commitment.
const MAX_AMOUNT_CV = 0.4;
const MAX_RECURRING_RESULTS = 12;

/** Collapses a description to a stable merge key (first letters-only tokens). */
function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return Infinity;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function averageGapDays(dates: string[]): number {
  if (dates.length < 2) return Infinity;
  const sorted = [...dates].sort();
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = Date.parse(`${sorted[i - 1]}T00:00:00Z`);
    const curr = Date.parse(`${sorted[i]}T00:00:00Z`);
    total += (curr - prev) / 86_400_000;
  }
  return total / (sorted.length - 1);
}

function classifyCadence(gapDays: number): (typeof CADENCE_WINDOWS)[number] | null {
  return (
    CADENCE_WINDOWS.find(
      (window) => gapDays >= window.min && gapDays <= window.max,
    ) ?? null
  );
}

/**
 * Groups expense transactions by normalised description and keeps the ones that
 * look like genuine recurring commitments: enough occurrences, a recognisable
 * cadence, and stable amounts. Pure so it can be unit-tested off fixtures.
 */
export function detectRecurring(rows: RecurringQueryRow[]): RecurringPayment[] {
  const groups = new Map<
    string,
    { description: string; account: string | null; dates: string[]; amounts: number[] }
  >();

  for (const row of rows) {
    const spend = Number(row.spend_cents ?? 0);
    if (spend <= 0) continue;
    const key = normalizeDescription(row.description);
    if (!key) continue;

    const group = groups.get(key) ?? {
      description: row.description,
      account: row.account,
      dates: [],
      amounts: [],
    };
    group.dates.push(row.date);
    group.amounts.push(spend);
    groups.set(key, group);
  }

  const recurring: RecurringPayment[] = [];
  for (const group of groups.values()) {
    if (group.amounts.length < MIN_OCCURRENCES) continue;
    if (coefficientOfVariation(group.amounts) > MAX_AMOUNT_CV) continue;

    const gapDays = averageGapDays(group.dates);
    const window = classifyCadence(gapDays);
    if (!window) continue;

    const amountCents = median(group.amounts);
    const sortedDates = [...group.dates].sort();
    recurring.push({
      description: group.description,
      account: group.account ?? "Expenses:Uncategorized",
      amountCents,
      occurrences: group.amounts.length,
      cadenceDays: Math.round(gapDays),
      cadence: window.cadence,
      monthlyEquivalentCents: Math.round(amountCents * window.perMonth),
      firstDate: sortedDates[0],
      lastDate: sortedDates[sortedDates.length - 1],
    });
  }

  return recurring
    .sort((a, b) => b.monthlyEquivalentCents - a.monthlyEquivalentCents)
    .slice(0, MAX_RECURRING_RESULTS);
}

/**
 * One Expenses:%/debit posting for a non-manual transaction, ungrouped. Feeds
 * `computeRecurringGroups`, which does the per-transaction (max-account-pick
 * + sum) grouping in JS that the SQLite query used to do via a correlated
 * subquery + GROUP BY. Shared so the Postgres workspace path
 * (workspaceRecurring.ts) computes recurring payments off the identical
 * grouping logic instead of a divergent reimplementation.
 */
export interface RecurringEntryRow {
  /** Groups postings into one transaction; any stable per-transaction key. */
  transactionId: string;
  date: string;
  description: string;
  account: string;
  amountCents: number;
}

/**
 * Groups Expenses:%/debit postings by transaction, summing to a per-transaction
 * spend total and picking the largest-amount leg as the representative
 * account (ties broken by first-seen order) — verbatim semantics of the old
 * `GROUP BY jt.id` + correlated-subquery SQL, just expressed in JS so both
 * backends share it.
 */
export function computeRecurringGroups(
  rows: readonly RecurringEntryRow[],
): RecurringQueryRow[] {
  const groups = new Map<
    string,
    { date: string; description: string; topAccount: string; topAmount: number; spendCents: number }
  >();

  for (const row of rows) {
    const group = groups.get(row.transactionId) ?? {
      date: row.date,
      description: row.description,
      topAccount: row.account,
      topAmount: row.amountCents,
      spendCents: 0,
    };
    group.spendCents += row.amountCents;
    if (row.amountCents > group.topAmount) {
      group.topAmount = row.amountCents;
      group.topAccount = row.account;
    }
    groups.set(row.transactionId, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.spendCents > 0)
    .map((group) => ({
      date: group.date,
      description: group.description,
      account: group.topAccount,
      spend_cents: group.spendCents,
    }));
}

/** Composed: group raw postings into per-transaction spend, then detect recurrence. */
export function computeRecurringPayments(
  rows: readonly RecurringEntryRow[],
): RecurringPayment[] {
  return detectRecurring(computeRecurringGroups(rows));
}

// ── Per-category monthly spend (for anomaly detection) ─────────────────────

export interface CategoryMonthPoint {
  account: string;
  /** YYYY-MM */
  month: string;
  /** Net expense magnitude for the category in that month, in cents. */
  amountCents: number;
}

/**
 * One Expenses:% posting, ungrouped. Feeds `computeCategoryMonthly`, which
 * does the (month, account) grouping in JS — shared so the Postgres
 * workspace path (workspaceSpending.ts) computes this off identical logic.
 */
export interface CategoryMonthlyEntryRow {
  month: string;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
}

/**
 * Nets debit-positive/credit-negative postings per (month, account), drops
 * zero-sum groups, sorts by month then account. Verbatim semantics of the
 * old `GROUP BY month, je.account` SQL — summing is associative, so grouping
 * here instead of in SQL yields identical totals.
 */
export function computeCategoryMonthly(
  rows: readonly CategoryMonthlyEntryRow[],
): CategoryMonthPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.month} ${row.account}`;
    const delta = row.side === "debit" ? row.amountCents : -row.amountCents;
    totals.set(key, (totals.get(key) ?? 0) + delta);
  }

  return Array.from(totals.entries())
    .map(([key, amountCents]) => {
      const [month, ...accountParts] = key.split(" ");
      const account = accountParts.join(" ");
      return { month, account, amountCents };
    })
    .filter((row) => row.amountCents !== 0)
    .sort((a, b) =>
      a.month === b.month
        ? a.account.localeCompare(b.account)
        : a.month.localeCompare(b.month),
    );
}

// ── Daily spend (for the calendar heatmap) ─────────────────────────────────

export interface DailySpendPoint {
  /** YYYY-MM-DD */
  date: string;
  spendCents: number;
  incomeCents: number;
  netCents: number;
  count: number;
}

/**
 * One posting for a non-manual transaction (ANY account, not just
 * Income:%/Expenses:%) — the distinct-transaction count needs every
 * transaction represented, even pure transfers with no Income/Expense leg,
 * to match the SQL's `COUNT(DISTINCT jt.id)` over the full join. Feeds
 * `computeDailySpend`. Shared so the Postgres workspace path
 * (workspaceSpending.ts) computes this off identical logic.
 */
export interface DailySpendEntryRow {
  /** YYYY-MM-DD */
  date: string;
  /** Groups postings into one transaction; any stable per-transaction key. */
  transactionId: string;
  account: string;
  side: "debit" | "credit";
  amountCents: number;
}

/**
 * Sums Expenses:%/Income:% postings per day and counts DISTINCT transactions
 * per day (including transfer-only transactions with no Income/Expense leg —
 * mirrors `COUNT(DISTINCT jt.id)` over the unfiltered join). Verbatim
 * semantics of the old `GROUP BY jt.transaction_date` SQL.
 */
export function computeDailySpend(
  rows: readonly DailySpendEntryRow[],
): DailySpendPoint[] {
  const byDate = new Map<
    string,
    { spendCents: number; incomeCents: number; transactionIds: Set<string> }
  >();

  for (const row of rows) {
    const bucket = byDate.get(row.date) ?? {
      spendCents: 0,
      incomeCents: 0,
      transactionIds: new Set<string>(),
    };
    if (row.account.startsWith("Expenses:")) {
      bucket.spendCents += row.side === "debit" ? row.amountCents : -row.amountCents;
    }
    if (row.account.startsWith("Income:")) {
      bucket.incomeCents += row.side === "credit" ? row.amountCents : -row.amountCents;
    }
    bucket.transactionIds.add(row.transactionId);
    byDate.set(row.date, bucket);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      spendCents: bucket.spendCents,
      incomeCents: bucket.incomeCents,
      netCents: bucket.incomeCents - bucket.spendCents,
      count: bucket.transactionIds.size,
    }));
}

