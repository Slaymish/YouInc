import type {
  AccountTotal,
  BalanceRow,
  CategoryMonthPoint,
  DailySpendPoint,
  LedgerDashboardData,
  LiquidityTier,
  NetWorthPoint,
} from "~/components/dashboard/dashboardData";
import {
  formatMoney,
  formatMonths,
  formatPercent,
  leafAccount,
} from "./format";

type PnlRows = LedgerDashboardData["pnl"];

const ROLLING_WINDOW = 3;
const PROJECTION_MAX_MONTHS = 24;

export interface RollingPoint {
  month: string;
  incomeCents: number;
  expensesCents: number;
}

/**
 * Trailing simple moving average of income and burn. Early months average over
 * however many months exist so far (1, 2, then the full window).
 */
export function rollingAverages(
  pnl: PnlRows,
  window = ROLLING_WINDOW,
): RollingPoint[] {
  return pnl.map((point, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = pnl.slice(start, index + 1);
    const count = slice.length;
    return {
      month: point.month,
      incomeCents: Math.round(
        slice.reduce((sum, r) => sum + r.incomeCents, 0) / count,
      ),
      expensesCents: Math.round(
        slice.reduce((sum, r) => sum + r.expensesCents, 0) / count,
      ),
    };
  });
}

export interface MonthPulse {
  month: string;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
  avgIncomeCents: number;
  avgExpensesCents: number;
  incomeDelta: number | null;
  expenseDelta: number | null;
}

/**
 * Compares the most recent month against the lifetime monthly average so the
 * widget can answer "is this month tracking above or below normal?".
 */
export function monthPulse(pnl: PnlRows): MonthPulse | null {
  if (!pnl.length) return null;
  const current = pnl[pnl.length - 1];
  const avgIncomeCents = Math.round(
    pnl.reduce((sum, r) => sum + r.incomeCents, 0) / pnl.length,
  );
  const avgExpensesCents = Math.round(
    pnl.reduce((sum, r) => sum + r.expensesCents, 0) / pnl.length,
  );
  return {
    month: current.month,
    incomeCents: current.incomeCents,
    expensesCents: current.expensesCents,
    netCents: current.incomeCents - current.expensesCents,
    avgIncomeCents,
    avgExpensesCents,
    incomeDelta: avgIncomeCents
      ? (current.incomeCents - avgIncomeCents) / avgIncomeCents
      : null,
    expenseDelta: avgExpensesCents
      ? (current.expensesCents - avgExpensesCents) / avgExpensesCents
      : null,
  };
}

export interface AssetMixSlice {
  tier: LiquidityTier;
  cents: number;
  fraction: number;
}

export interface AssetMix {
  slices: AssetMixSlice[];
  totalCents: number;
}

const TIER_SEQUENCE: LiquidityTier[] = ["cash", "semi_liquid", "illiquid"];

export function assetMix(balances: BalanceRow[]): AssetMix {
  const assets = balances.filter((row) => row.accountType === "Assets");
  const totalCents = assets.reduce((sum, row) => sum + row.balanceCents, 0);
  const slices = TIER_SEQUENCE.map((tier) => {
    const cents = assets
      .filter((row) => row.liquidityTier === tier)
      .reduce((sum, row) => sum + row.balanceCents, 0);
    return { tier, cents, fraction: totalCents ? cents / totalCents : 0 };
  });
  return { slices, totalCents };
}

export interface RunwayPoint {
  monthIndex: number;
  cashCents: number;
}

export interface RunwayProjection {
  months: number | null;
  cashCents: number;
  monthlyBurnCents: number;
  points: RunwayPoint[];
}

/**
 * Straight-line cash burn-down at the current monthly overhead. Horizon is
 * capped so a near-zero burn doesn't produce an unbounded series.
 */
export function runwayProjection(
  cashCents: number,
  monthlyBurnCents: number,
): RunwayProjection {
  const months = monthlyBurnCents > 0 ? cashCents / monthlyBurnCents : null;
  const horizon =
    months === null
      ? 1
      : Math.min(PROJECTION_MAX_MONTHS, Math.ceil(months) + 1);
  const points: RunwayPoint[] = [];
  for (let monthIndex = 0; monthIndex <= horizon; monthIndex += 1) {
    points.push({
      monthIndex,
      cashCents: Math.max(0, cashCents - monthlyBurnCents * monthIndex),
    });
  }
  return { months, cashCents, monthlyBurnCents, points };
}

/**
 * Projects a depletion date from a fractional month count. Returns null when
 * runway is effectively infinite (no burn).
 */
export function depletionDate(
  months: number | null,
  from = new Date(),
): Date | null {
  if (months === null || !Number.isFinite(months)) return null;
  const result = new Date(from);
  const wholeMonths = Math.floor(months);
  const dayFraction = months - wholeMonths;
  result.setMonth(result.getMonth() + wholeMonths);
  result.setDate(result.getDate() + Math.round(dayFraction * 30));
  return result;
}

/** Forward analogue of {@link depletionDate} for a positive month count. */
export function projectForwardDate(months: number, from = new Date()): Date {
  const result = new Date(from);
  const wholeMonths = Math.floor(months);
  const dayFraction = months - wholeMonths;
  result.setMonth(result.getMonth() + wholeMonths);
  result.setDate(result.getDate() + Math.round(dayFraction * 30));
  return result;
}

// ── Net-worth velocity & milestones ────────────────────────────────────────

export interface NetWorthMilestone {
  targetCents: number;
  monthsAway: number | null;
  date: Date | null;
}

export interface NetWorthVelocity {
  latestCents: number;
  /** Least-squares slope of net worth per month, in cents. */
  monthlyDeltaCents: number;
  direction: "up" | "down" | "flat";
  milestones: NetWorthMilestone[];
}

// Round thresholds (in cents) net worth might cross next, ascending.
const MILESTONE_LADDER_DOLLARS = [
  10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000,
  5_000_000, 10_000_000,
];
const MILESTONE_COUNT = 3;
const FLAT_DELTA_CENTS = 50_00; // slopes under $50/mo read as flat

/** Least-squares slope of a series indexed 0..n-1. */
function slopePerStep(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((sum, v) => sum + v, 0) / n;
  let numerator = 0;
  let denominator = 0;
  values.forEach((y, i) => {
    numerator += (i - xMean) * (y - yMean);
    denominator += (i - xMean) ** 2;
  });
  return denominator ? numerator / denominator : 0;
}

/**
 * Turns the net-worth trend into a forward trajectory: a per-month slope and
 * the dates a few round milestones would be crossed at the current pace.
 */
export function netWorthVelocity(
  trend: NetWorthPoint[],
  from = new Date(),
): NetWorthVelocity | null {
  if (trend.length < 2) return null;
  const latestCents = trend[trend.length - 1].netWorthCents;
  const monthlyDeltaCents = Math.round(
    slopePerStep(trend.map((point) => point.netWorthCents)),
  );

  const direction =
    Math.abs(monthlyDeltaCents) < FLAT_DELTA_CENTS
      ? "flat"
      : monthlyDeltaCents > 0
        ? "up"
        : "down";

  const milestones: NetWorthMilestone[] = MILESTONE_LADDER_DOLLARS.map(
    (dollars) => dollars * 100,
  )
    .filter((targetCents) => targetCents > latestCents)
    .slice(0, MILESTONE_COUNT)
    .map((targetCents) => {
      const monthsAway =
        monthlyDeltaCents > 0
          ? (targetCents - latestCents) / monthlyDeltaCents
          : null;
      return {
        targetCents,
        monthsAway,
        date: monthsAway === null ? null : projectForwardDate(monthsAway, from),
      };
    });

  return { latestCents, monthlyDeltaCents, direction, milestones };
}

// ── Income concentration (client risk) ─────────────────────────────────────

export interface IncomeShare {
  account: string;
  cents: number;
  share: number;
}

export interface IncomeConcentration {
  totalCents: number;
  /** Herfindahl-Hirschman index of income shares, 0..1. */
  hhi: number;
  /** Effective number of independent income sources (1 / hhi). */
  effectiveSources: number;
  topShare: number;
  topAccount: string;
  level: "diversified" | "moderate" | "concentrated";
  shares: IncomeShare[];
}

const HHI_DIVERSIFIED = 0.25;
const HHI_MODERATE = 0.5;

/**
 * Measures single-source dependency in income — the personal-Inc analogue of
 * customer-concentration risk — via an HHI gauge over the income breakdown.
 */
export function incomeConcentration(
  incomeBreakdown: AccountTotal[],
): IncomeConcentration | null {
  const sources = incomeBreakdown.filter((row) => row.amountCents > 0);
  const totalCents = sources.reduce((sum, row) => sum + row.amountCents, 0);
  if (!totalCents) return null;

  const shares: IncomeShare[] = sources
    .map((row) => ({
      account: row.account,
      cents: row.amountCents,
      share: row.amountCents / totalCents,
    }))
    .sort((a, b) => b.share - a.share);

  const hhi = shares.reduce((sum, row) => sum + row.share ** 2, 0);
  const top = shares[0];
  const level =
    hhi < HHI_DIVERSIFIED
      ? "diversified"
      : hhi < HHI_MODERATE
        ? "moderate"
        : "concentrated";

  return {
    totalCents,
    hhi,
    effectiveSources: hhi ? 1 / hhi : 0,
    topShare: top.share,
    topAccount: top.account,
    level,
    shares,
  };
}

// ── Cashflow waterfall ─────────────────────────────────────────────────────

export interface WaterfallStep {
  label: string;
  account: string | null;
  kind: "income" | "expense" | "net";
  deltaCents: number;
  startCents: number;
  endCents: number;
}

export interface CashflowWaterfall {
  month: string;
  steps: WaterfallStep[];
  incomeCents: number;
  expensesCents: number;
  netCents: number;
  /** Largest running value, for SVG scaling. */
  maxCents: number;
}

const WATERFALL_MAX_CATEGORIES = 6;

/**
 * Builds a bridge from the latest month's income down through each expense
 * category to the net result — linking the income and expense breakdowns into
 * one "where did the money go" view.
 */
export function cashflowWaterfall(
  pnl: PnlRows,
  categoryMonthly: CategoryMonthPoint[],
): CashflowWaterfall | null {
  if (!pnl.length) return null;
  const month = pnl[pnl.length - 1].month;
  const incomeCents = pnl[pnl.length - 1].incomeCents;

  const monthCategories = categoryMonthly
    .filter((row) => row.month === month && row.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  if (!incomeCents && !monthCategories.length) return null;

  const visible = monthCategories.slice(0, WATERFALL_MAX_CATEGORIES);
  const restCents = monthCategories
    .slice(WATERFALL_MAX_CATEGORIES)
    .reduce((sum, row) => sum + row.amountCents, 0);

  const steps: WaterfallStep[] = [];
  let running = 0;

  steps.push({
    label: "Income",
    account: null,
    kind: "income",
    deltaCents: incomeCents,
    startCents: 0,
    endCents: incomeCents,
  });
  running = incomeCents;

  for (const category of visible) {
    const start = running;
    running -= category.amountCents;
    steps.push({
      label: category.account,
      account: category.account,
      kind: "expense",
      deltaCents: -category.amountCents,
      startCents: start,
      endCents: running,
    });
  }

  if (restCents > 0) {
    const start = running;
    running -= restCents;
    steps.push({
      label: "Other",
      account: null,
      kind: "expense",
      deltaCents: -restCents,
      startCents: start,
      endCents: running,
    });
  }

  const expensesCents = incomeCents - running;
  steps.push({
    label: "Net",
    account: null,
    kind: "net",
    deltaCents: running,
    startCents: 0,
    endCents: running,
  });

  const maxCents = Math.max(
    incomeCents,
    ...steps.map((step) => Math.max(step.startCents, step.endCents)),
    1,
  );

  return {
    month,
    steps,
    incomeCents,
    expensesCents,
    netCents: running,
    maxCents,
  };
}

// ── Spending anomalies (per-category z-score) ──────────────────────────────

export interface CategoryAnomaly {
  account: string;
  currentCents: number;
  meanCents: number;
  /** z-score of the current month against the category's prior history. */
  z: number;
  deltaCents: number;
}

export interface SpendingAnomalies {
  month: string | null;
  hasEnoughHistory: boolean;
  anomalies: CategoryAnomaly[];
}

// A z-score needs a few prior points to mean anything.
const MIN_PRIOR_MONTHS = 3;
const ANOMALY_Z_THRESHOLD = 1.5;

/**
 * Flags expense categories whose latest month runs well above their own
 * history (z-score over prior months), turning passive reporting into an alert.
 */
export function spendingAnomalies(
  categoryMonthly: CategoryMonthPoint[],
): SpendingAnomalies {
  const months = Array.from(
    new Set(categoryMonthly.map((row) => row.month)),
  ).sort();
  if (months.length < MIN_PRIOR_MONTHS + 1) {
    return {
      month: months.length ? months[months.length - 1] : null,
      hasEnoughHistory: false,
      anomalies: [],
    };
  }

  const currentMonth = months[months.length - 1];
  const priorMonths = months.slice(0, -1);

  const byAccount = new Map<string, Map<string, number>>();
  for (const row of categoryMonthly) {
    const series = byAccount.get(row.account) ?? new Map<string, number>();
    series.set(row.month, row.amountCents);
    byAccount.set(row.account, series);
  }

  const anomalies: CategoryAnomaly[] = [];
  for (const [account, series] of byAccount) {
    const currentCents = series.get(currentMonth) ?? 0;
    const priorValues = priorMonths.map((month) => series.get(month) ?? 0);
    const meanCents =
      priorValues.reduce((sum, v) => sum + v, 0) / priorValues.length;
    const variance =
      priorValues.reduce((sum, v) => sum + (v - meanCents) ** 2, 0) /
      priorValues.length;
    const std = Math.sqrt(variance);
    if (std <= 0) continue;

    const z = (currentCents - meanCents) / std;
    if (z >= ANOMALY_Z_THRESHOLD) {
      anomalies.push({
        account,
        currentCents,
        meanCents: Math.round(meanCents),
        z,
        deltaCents: Math.round(currentCents - meanCents),
      });
    }
  }

  anomalies.sort((a, b) => b.z - a.z);
  return { month: currentMonth, hasEnoughHistory: true, anomalies };
}

// ── Daily spend calendar ───────────────────────────────────────────────────

export interface CalendarCell {
  date: string;
  spendCents: number;
  netCents: number;
  count: number;
  /** 0..1 spend intensity relative to the busiest day. */
  intensity: number;
  inRange: boolean;
}

export interface SpendCalendar {
  /** Weeks as columns; each column is Mon..Sun (7 cells). */
  weeks: CalendarCell[][];
  maxSpendCents: number;
  totalSpendCents: number;
  dayCount: number;
}

/** Days since the Unix epoch for a YYYY-MM-DD date, in UTC. */
function epochDay(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function isoDate(epochDays: number): string {
  return new Date(epochDays * 86_400_000).toISOString().slice(0, 10);
}

/** Mon=0 .. Sun=6 for a YYYY-MM-DD date. */
function weekdayIndex(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

/**
 * Lays out daily spend into a GitHub-style heatmap: weeks down the columns,
 * weekdays down the rows, padded to whole-week boundaries.
 */
export function spendCalendar(
  dailySpend: DailySpendPoint[],
): SpendCalendar | null {
  if (!dailySpend.length) return null;

  const byDate = new Map(dailySpend.map((row) => [row.date, row]));
  const sortedDates = dailySpend.map((row) => row.date).sort();
  const first = sortedDates[0];
  const last = sortedDates[sortedDates.length - 1];

  const startEpoch = epochDay(first) - weekdayIndex(first);
  const endEpoch = epochDay(last) + (6 - weekdayIndex(last));
  const firstEpoch = epochDay(first);
  const lastEpoch = epochDay(last);

  const maxSpendCents = Math.max(1, ...dailySpend.map((row) => row.spendCents));
  const totalSpendCents = dailySpend.reduce(
    (sum, row) => sum + row.spendCents,
    0,
  );

  const weeks: CalendarCell[][] = [];
  let week: CalendarCell[] = [];
  for (let day = startEpoch; day <= endEpoch; day += 1) {
    const date = isoDate(day);
    const point = byDate.get(date);
    const spendCents = point?.spendCents ?? 0;
    week.push({
      date,
      spendCents,
      netCents: point?.netCents ?? 0,
      count: point?.count ?? 0,
      intensity: spendCents > 0 ? spendCents / maxSpendCents : 0,
      inRange: day >= firstEpoch && day <= lastEpoch,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push(week);

  return {
    weeks,
    maxSpendCents,
    totalSpendCents,
    dayCount: dailySpend.length,
  };
}

// ── Attention / Action Center ──────────────────────────────────────────────

export type AttentionSeverity = "critical" | "action" | "review";
export type AttentionTargetView =
  | "this-week"
  | "cash-flow"
  | "wealth"
  | "books";

export interface AttentionItem {
  /** Stable key per signal type. */
  id: string;
  severity: AttentionSeverity;
  /** Headline: the count or value that earned the row a place. */
  label: string;
  /** One line on why it matters / what to do. */
  detail: string;
  /** Tab the row deep-links to. */
  targetView: AttentionTargetView;
}

// What earns a place in the Action Center.
const RUNWAY_CRITICAL_MONTHS = 3;
const RUNWAY_WARN_MONTHS = 6;
const STALE_SYNC_DAYS = 7;
const NEW_RECURRING_DAYS = 35;
const CREDIT_UTILIZATION_WARN = 0.7;

/**
 * A suspense backlog at or under this size reads as routine cleanup, not an
 * exception — shared by the Action Center severity below and the Control
 * Brief / Ledger Confidence banners (`ControlBriefWidget`,
 * `LedgerConfidenceWidget`) so "books not decision-grade" language only
 * appears once the backlog is actually large enough to matter.
 */
export const SUSPENSE_MINOR_THRESHOLD = 10;

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  action: 1,
  review: 2,
};

/** Whole days from `iso` until `now`, or null if `iso` is missing/unparseable. */
function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * Collapses every attention signal the dashboard already computes into one
 * prioritized triage list — the answer to "does anything need me this week?".
 * Pure: pushes rows in a deliberate signal order, then a stable sort by
 * severity preserves that order within each tier. Empty array = all clear.
 */
export function buildAttentionItems(
  dashboard: LedgerDashboardData,
  now = new Date(),
): AttentionItem[] {
  if (!dashboard.databaseExists) {
    return [
      {
        id: "no-database",
        severity: "critical",
        label: "No ledger database",
        detail: "Run an ingestion before anything else can report.",
        targetView: "books",
      },
    ];
  }

  const items: AttentionItem[] = [];
  const { totals, routing, pipeline, sourceAccounts } = dashboard;
  const runway = totals.runwayMonths;

  if (runway !== null && runway < RUNWAY_CRITICAL_MONTHS) {
    items.push({
      id: "runway",
      severity: "critical",
      label: `Runway ${formatMonths(runway)}`,
      detail: "Below threshold — preserve liquidity before any allocation.",
      targetView: "wealth",
    });
  }

  if (routing.suspenseCount > 0) {
    const n = routing.suspenseCount;
    const isMinor = n <= SUSPENSE_MINOR_THRESHOLD;
    items.push({
      id: "suspense",
      severity: isMinor ? "review" : "action",
      label: `${n.toLocaleString()} ${n === 1 ? "transaction" : "transactions"} to classify`,
      detail: isMinor
        ? "A small backlog — route these whenever convenient."
        : "Books aren't decision-grade until these are routed.",
      targetView: "books",
    });
  }

  const unmapped = sourceAccounts.filter(
    (account) => account.mappingStatus === "unmapped",
  ).length;
  if (unmapped > 0) {
    items.push({
      id: "unmapped",
      severity: "action",
      label: `${unmapped} source ${unmapped === 1 ? "account" : "accounts"} unmapped`,
      detail: "Map them so their balances post to the ledger.",
      targetView: "books",
    });
  }

  const staleDays = daysSince(
    pipeline.lastSeenAt ?? pipeline.latestTransactionDate,
    now,
  );
  if (staleDays !== null && staleDays >= STALE_SYNC_DAYS) {
    items.push({
      id: "stale-sync",
      severity: "action",
      label: `Last sync ${staleDays} days ago`,
      detail: "Refresh ingestion so figures reflect recent activity.",
      targetView: "books",
    });
  }

  const { anomalies } = spendingAnomalies(dashboard.categoryMonthly);
  if (anomalies.length > 0) {
    const top = anomalies[0];
    const overshoot = top.meanCents ? top.deltaCents / top.meanCents : null;
    const lift = overshoot === null ? null : `+${formatPercent(overshoot)}`;
    items.push({
      id: "anomalies",
      severity: "review",
      label:
        anomalies.length === 1
          ? `${leafAccount(top.account)} ${lift ?? "above normal"}`
          : `${anomalies.length} categories above normal`,
      detail:
        anomalies.length === 1
          ? "Spending well above this category's own history."
          : `Led by ${leafAccount(top.account)}${lift ? ` (${lift})` : ""}.`,
      targetView: "cash-flow",
    });
  }

  const newRecurring = dashboard.recurringPayments.filter((payment) => {
    const age = daysSince(payment.firstDate, now);
    return age !== null && age <= NEW_RECURRING_DAYS;
  });
  if (newRecurring.length > 0) {
    const first = newRecurring[0];
    items.push({
      id: "new-recurring",
      severity: "review",
      label:
        newRecurring.length === 1
          ? `New recurring: ${first.description}`
          : `${newRecurring.length} new recurring payments`,
      detail:
        newRecurring.length === 1
          ? `${formatMoney(first.monthlyEquivalentCents)}/mo of committed spend — confirm it's intended.`
          : "Recently started commitments — confirm they're intended.",
      targetView: "cash-flow",
    });
  }

  if (
    runway !== null &&
    runway >= RUNWAY_CRITICAL_MONTHS &&
    runway < RUNWAY_WARN_MONTHS
  ) {
    items.push({
      id: "runway-warn",
      severity: "review",
      label: `Runway ${formatMonths(runway)}`,
      detail: "Getting tight — watch burn over the next few months.",
      targetView: "wealth",
    });
  }

  const hotFacilities = dashboard.creditFacilities.filter(
    (facility) => (facility.utilization ?? 0) >= CREDIT_UTILIZATION_WARN,
  );
  if (hotFacilities.length > 0) {
    const top = hotFacilities[0];
    items.push({
      id: "credit-utilization",
      severity: "review",
      label:
        hotFacilities.length === 1
          ? `${leafAccount(top.account)} at ${formatPercent(top.utilization)}`
          : `${hotFacilities.length} facilities above ${formatPercent(CREDIT_UTILIZATION_WARN)}`,
      detail:
        "High utilization shrinks available liquidity and headroom for timing gaps.",
      targetView: "wealth",
    });
  }

  return [...items].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}
