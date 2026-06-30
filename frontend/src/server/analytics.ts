import type BetterSqlite3 from "better-sqlite3";

type DB = BetterSqlite3.Database;

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

type RecurringQueryRow = {
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

export function readRecurringPayments(db: DB): RecurringPayment[] {
  const rows = db
    .prepare(
      `
      SELECT
        jt.transaction_date AS date,
        jt.description AS description,
        (
          SELECT je2.account
          FROM journal_entries je2
          WHERE je2.journal_transaction_id = jt.id
            AND je2.account LIKE 'Expenses:%'
            AND je2.side = 'debit'
          ORDER BY je2.amount_cents DESC
          LIMIT 1
        ) AS account,
        SUM(
          CASE WHEN je.account LIKE 'Expenses:%' AND je.side = 'debit'
            THEN je.amount_cents ELSE 0 END
        ) AS spend_cents
      FROM journal_transactions jt
      JOIN journal_entries je ON je.journal_transaction_id = jt.id
      WHERE jt.source_account_id != 'manual'
      GROUP BY jt.id
      HAVING spend_cents > 0
      ORDER BY jt.transaction_date
    `,
    )
    .all() as RecurringQueryRow[];

  return detectRecurring(rows);
}

// ── Per-category monthly spend (for anomaly detection) ─────────────────────

export interface CategoryMonthPoint {
  account: string;
  /** YYYY-MM */
  month: string;
  /** Net expense magnitude for the category in that month, in cents. */
  amountCents: number;
}

type CategoryMonthQueryRow = {
  month: string;
  account: string;
  amount_cents: number | null;
};

export function readCategoryMonthly(db: DB): CategoryMonthPoint[] {
  const rows = db
    .prepare(
      `
      SELECT
        substr(jt.transaction_date, 1, 7) AS month,
        je.account AS account,
        SUM(CASE WHEN je.side = 'debit' THEN je.amount_cents ELSE -je.amount_cents END) AS amount_cents
      FROM journal_entries je
      JOIN journal_transactions jt ON jt.id = je.journal_transaction_id
      WHERE je.account LIKE 'Expenses:%'
      GROUP BY month, je.account
      ORDER BY month, je.account
    `,
    )
    .all() as CategoryMonthQueryRow[];

  return rows
    .map((row) => ({
      account: row.account,
      month: row.month,
      amountCents: Number(row.amount_cents ?? 0),
    }))
    .filter((row) => row.amountCents !== 0);
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

type DailySpendQueryRow = {
  date: string;
  spend_cents: number | null;
  income_cents: number | null;
  count: number | null;
};

export function readDailySpend(db: DB): DailySpendPoint[] {
  const rows = db
    .prepare(
      `
      SELECT
        jt.transaction_date AS date,
        SUM(
          CASE WHEN je.account LIKE 'Expenses:%'
            THEN (CASE WHEN je.side = 'debit' THEN je.amount_cents ELSE -je.amount_cents END)
            ELSE 0 END
        ) AS spend_cents,
        SUM(
          CASE WHEN je.account LIKE 'Income:%'
            THEN (CASE WHEN je.side = 'credit' THEN je.amount_cents ELSE -je.amount_cents END)
            ELSE 0 END
        ) AS income_cents,
        COUNT(DISTINCT jt.id) AS count
      FROM journal_transactions jt
      JOIN journal_entries je ON je.journal_transaction_id = jt.id
      WHERE jt.source_account_id != 'manual'
      GROUP BY jt.transaction_date
      ORDER BY jt.transaction_date
    `,
    )
    .all() as DailySpendQueryRow[];

  return rows.map((row) => {
    const spendCents = Number(row.spend_cents ?? 0);
    const incomeCents = Number(row.income_cents ?? 0);
    return {
      date: row.date,
      spendCents,
      incomeCents,
      netCents: incomeCents - spendCents,
      count: Number(row.count ?? 0),
    };
  });
}
