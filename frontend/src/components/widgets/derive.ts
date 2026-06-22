import type { BalanceRow, LedgerDashboardData, LiquidityTier } from "~/server/ledger";

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
export function rollingAverages(pnl: PnlRows, window = ROLLING_WINDOW): RollingPoint[] {
  return pnl.map((point, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = pnl.slice(start, index + 1);
    const count = slice.length;
    return {
      month: point.month,
      incomeCents: Math.round(slice.reduce((sum, r) => sum + r.incomeCents, 0) / count),
      expensesCents: Math.round(slice.reduce((sum, r) => sum + r.expensesCents, 0) / count),
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
    months === null ? 1 : Math.min(PROJECTION_MAX_MONTHS, Math.ceil(months) + 1);
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
export function depletionDate(months: number | null, from = new Date()): Date | null {
  if (months === null || !Number.isFinite(months)) return null;
  const result = new Date(from);
  const wholeMonths = Math.floor(months);
  const dayFraction = months - wholeMonths;
  result.setMonth(result.getMonth() + wholeMonths);
  result.setDate(result.getDate() + Math.round(dayFraction * 30));
  return result;
}
