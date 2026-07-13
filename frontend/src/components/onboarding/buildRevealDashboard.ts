// Builds a minimal-but-valid LedgerDashboardData from anonymous quiz answers so
// the reveal renders the user's real numbers with no account/server round-trip.
import { combineBalances } from "~/server/workspaceSummary";
import type { BalanceRow, LedgerDashboardData } from "~/components/dashboard/dashboardData";
import { QUIZ_CATEGORIES, type LiquidityTier, type QuizState } from "./quizModel";
import { quizToLedger } from "./quizToLedger";

const TIER_BY_ACCOUNT = new Map<string, LiquidityTier>(
  QUIZ_CATEGORIES.map((c) => [c.account, c.liquidityTier]),
);

export function buildRevealDashboard(
  state: QuizState,
  generatedAt: string = new Date().toISOString(),
): LedgerDashboardData {
  const manual = quizToLedger(state);
  const { balances, totals } = combineBalances([], manual);

  const balanceRows: BalanceRow[] = balances.map((b) => ({
    account: b.account,
    accountType: b.accountType,
    balanceCents: b.balanceCents,
    currency: "NZD",
    isManual: true,
    liquidityTier: TIER_BY_ACCOUNT.get(b.account) ?? "illiquid",
  }));

  const cashCents = balanceRows
    .filter((b) => b.accountType === "Assets" && b.liquidityTier === "cash")
    .reduce((sum, b) => sum + b.balanceCents, 0);

  return {
    databasePath: "quiz://reveal",
    databaseExists: true,
    generatedAt,
    manualBalances: balanceRows.map((b) => ({
      account: b.account,
      balanceCents: b.balanceCents,
      asOfDate: generatedAt.slice(0, 10),
      updatedAt: generatedAt,
    })),
    totals: {
      netWorthCents: totals.netWorthCents,
      assetsCents: totals.assetsCents,
      liabilitiesCents: totals.liabilitiesCents,
      assetLiabilityRatio: totals.assetLiabilityRatio,
      incomeCents: 0,
      expensesCents: 0,
      ebitdaCents: 0,
      ebitdaMargin: null,
      averageMonthlyIncomeCents: 0,
      monthlyOverheadCents: 0,
      runwayMonths: null,
      transactionCount: 0,
      rawTransactionCount: 0,
      cashCents,
      creditHeadroomCents: 0,
      creditLimitCents: 0,
      availableLiquidityCents: cashCents,
    },
    balances: balanceRows,
    creditFacilities: [],
    pnl: [],
    incomeBreakdown: [],
    expenseBreakdown: [],
    suspenseQueue: [],
    netWorthTrend: [],
    recentTransactions: [],
    recurringPayments: [],
    categoryMonthly: [],
    dailySpend: [],
    pipeline: {
      rawCached: 0,
      posted: 0,
      pending: 0,
      zeroAmount: 0,
      unprocessed: 0,
      earliestTransactionDate: null,
      latestTransactionDate: null,
      lastSeenAt: null,
    },
    sourceAccounts: [],
    knownAccounts: balanceRows.map((b) => b.account),
    routing: {
      journalCount: 0,
      customRuleCount: 0,
      nzfccFallbackCount: 0,
      suspenseCount: 0,
      suspenseCents: 0,
      classificationRate: null,
    },
    syncState: [],
    error: null,
  };
}
